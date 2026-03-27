# Design: Add Quote Screen — Issue #186

**Issue:** Add Quote screen: adapt existing screen to match Invoice upload UX and form parity  
**Date:** 2026-03-27  
**Status:** Draft — awaiting LGTB approval

---

## 1. User Story

As a builder, when I tap "Add Quote" from the Dashboard, I want to:
1. Optionally upload a PDF quote document and have the form pre-filled via OCR.
2. Edit the populated (or blank) quote form — with a minimal, clean set of fields.
3. Save the quote, which is auto-referenced if I leave the reference field blank.

---

## 2. Scope

**Included:**
- Adapt `QuotationScreen` + `QuotationForm` to match Invoice upload UX layout.
- Add PDF upload Pressable at the top of the `QuotationScreen`, with `QuotationForm` always visible below.
- Hide `currency`, `subtotal`, and `tax` fields in `QuotationForm` UI (retained in data model).
- Make `quoteReference` optional in UI; auto-generate `QUO-YYYYMMDD-XXXXXX` in `QuotationEntity.create()` when empty.
- Add `normalizedInvoiceToQuotationFormValues` utility to pre-fill form from OCR output.
- Add a new `ProcessQuoteUploadUseCase` for the OCR/normalization pipeline.
- Align `SnapReceiptScreen` upload/camera button style to the standardised Pressable.

**Not Included:**
- New database table — uses the existing `quotations` table and `DrizzleQuotationRepository`.
- Changes to `InvoiceScreen` layout (its own upload-view is not in scope for this issue).
- Quotation list page, detail page, or status management.

---

## 3. Current State Analysis

| Component | Current Behaviour | Gap |
|-----------|-------------------|-----|
| `QuotationScreen` | Internal `<Modal>` wrapping `QuotationForm`; no upload path | Missing upload Pressable and OCR pipeline |
| `QuotationForm` | Shows `reference` (required), `currency`, `subtotal`, `tax`, `status` | Must hide currency/subtotal/tax; reference must be optional in UI |
| `QuotationEntity.create()` | Throws `'Quotation reference is required'` when reference is blank | Must auto-generate `QUO-YYYYMMDD-XXXXXX` when absent |
| `ProcessQuoteUploadUseCase` | Doesn't exist yet | We need a dedicated use case for processing quote uploads. |
| `normalizedInvoiceToFormValues` | Maps `NormalizedInvoice` → `Partial<Invoice>` | Need parallel mapper `NormalizedInvoice` → `Partial<Quotation>` |
| `SnapReceiptScreen` | Camera button uses `bg-primary p-4 rounded-xl` styling | Should match standardised `bg-card border border-border` Pressable style |

---

## 4. Target UX Layout

```
┌────────────────────────────────────┐
│  Add Quote                  [✕]    │  ← Modal header (existing)
├────────────────────────────────────┤
│ ┌──────────────────────────────┐   │
│ │  📎 Upload Quote PDF         │   │  ← Always-visible Pressable (NEW)
│ │     "No file selected"       │   │     bg-card, border-border, rounded-xl
│ └──────────────────────────────┘   │     testID="upload-quote-pdf-button"
├────────────────────────────────────┤
│  QuotationForm (always rendered)   │  ← Adapted form (always visible below)
│  • Reference (optional, hint auto) │
│  • Client / Vendor                 │
│  • Vendor Email                    │
│  • Vendor Address                  │
│  • Issue Date (default: today)     │
│  • Expiry Date                     │
│  • Total (required)                │
│  • Line Items                       │
│  • Notes                           │
│  [Cancel]    [Save Quotation]      │
└────────────────────────────────────┘

Hidden (not rendered):
  - Currency field
  - Subtotal field
  - Tax field
  - Status field (defaults to 'draft')
```

---

## 5. Architecture Plan

### 5.1 Domain Layer — `src/domain/entities/Quotation.ts`

**Change:** Make `reference` auto-generated when blank or empty, mirroring `InvoiceEntity.create()`.

```typescript
// Before:
if (!quotation.reference || quotation.reference.trim().length === 0) {
  throw new Error('Quotation reference is required');
}

// After:
const baseDate = payload.date ? new Date(payload.date) : new Date();
const yyyymmdd = baseDate.toISOString().slice(0, 10).replace(/-/g, '');
const autoRef = `QUO-${yyyymmdd}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
const reference =
  payload.reference && payload.reference.trim().length > 0
    ? payload.reference.trim()
    : autoRef;
// reference is then placed in the quotation object
```

**Contract change:** `reference` field in the domain payload type changes from effectively required to optional. Domain still returns a `reference` on every created entity.

---

### 5.2 Application Layer — New Utility

**New file:** `src/utils/normalizedInvoiceToQuotationFormValues.ts`

Maps `NormalizedInvoice` (OCR output) to `Partial<Quotation>` for pre-filling `QuotationForm`.

| NormalizedInvoice field | → Quotation field | Notes |
|-------------------------|--------------------|-------|
| `vendor` | `vendorName` | Optional; skip if null |
| `invoiceNumber` | `reference` | Optional; skip if null — domain will auto-generate if not provided |
| `invoiceDate` | `date` | ISO string |
| `dueDate` | `expiryDate` | ISO string |
| `total` | `total` | |
| `currency` | `currency` | Keep internally even though field is hidden in UI |
| `lineItems[]` | `lineItems[]` | Map `unitPrice` → `unitPrice`, `description`, `quantity`, `total` |

We will also introduce a `ProcessQuoteUploadUseCase` specifically handling the upload and OCR pipeline for Quote PDFs, keeping concerns separate from Invoice uploads.

---

### 5.3 UI Components Layer

#### `src/components/quotations/QuotationForm.tsx`

**Changes:**
1. Add `embedded?: boolean` prop — reduces padding when rendered inline inside `QuotationScreen`.
2. Add `pdfFile?: PdfFileMetadata` prop — shows "📄 PDF Attached: filename" indicator (same as `InvoiceForm`).
3. Remove `currency` field from render (state stays; default `'AUD'`; default currency changes from `'USD'` to `'AUD'` to align with Australian construction context).
4. Remove `subtotal` field from render (state stays, computed from line items internally).
5. Remove `tax` field from render (state stays).
6. Remove `status` field from render (defaults to `'draft'`; not editable in Add Quote flow).
7. Validation: Remove the `if (!reference.trim())` error — reference is now optional in the UI. Domain auto-generates when blank.
8. Update `reference` placeholder to `"Leave blank to auto-generate"` and label to `"Reference (optional)"`.
9. `date` already defaults to `new Date()` — no change needed.

#### `src/pages/quotations/QuotationScreen.tsx`

**Full redesign of component body** (keep file, change internals):

```typescript
type ProcessingStep = 'idle' | 'copying' | 'ocr' | 'error';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (quotation: Quotation) => void;
  // Dependency injection for testing
  filePickerAdapter?: IFilePickerAdapter;
  fileSystemAdapter?: IFileSystemAdapter;
  ocrAdapter?: IOcrAdapter;
  invoiceNormalizer?: IInvoiceNormalizer;
  pdfConverter?: IPdfConverter;
}
```

**State:**
- `processingStep: ProcessingStep` — upload/OCR progress
- `processingError: string | null`
- `formInitialValues: Partial<Quotation> | undefined` — pre-filled after OCR
- `formPdfFile: PdfFileMetadata | undefined` — selected file metadata

**Layout:** Always show Upload Pressable + `QuotationForm` together (no navigation between views).

**Upload flow:**
1. Tap "Upload Quote PDF" → call `filePicker.pickDocument()`
2. Validate + copy to app storage (same as `InvoiceScreen.handleUploadPdf`)
3. Run `ProcessInvoiceUploadUseCase` if OCR adapters injected; otherwise skip OCR and enter form with no pre-fill
4. Map output with `normalizedInvoiceToQuotationFormValues` → update `formInitialValues`
5. Update `formPdfFile` → `QuotationForm` shows PDF indicator

**Save flow:**
- `QuotationForm.onSubmit(data)` → `QuotationEntity.create(data)` auto-generates reference if blank
- Call `createQuotation(validated)`
- On success: `onSuccess?.(created)` then `onClose()`

**Error handling:**
- OCR failure: show inline error banner below Upload Pressable; form remains editable for manual entry.

#### `src/pages/receipts/SnapReceiptScreen.tsx`

**Minor style change** to camera button:
```diff
- className="bg-primary p-4 rounded-xl items-center flex-row justify-center active:opacity-80 mb-6"
+ className="bg-card border border-border rounded-xl p-4 items-center flex-row justify-center active:opacity-80 mb-4"
```
Rationale: aligns visual weight (`bg-card border`) with the standardised upload Pressable used in `QuotationScreen`, reducing vertical space difference between the screens.

---

### 5.4 Database

No schema changes required. The `quotations` table in `schema.ts` already has a `reference` column (text, no NOT NULL constraint enforced at DB level — constraint is domain logic). `DrizzleQuotationRepository` is unchanged.

---

## 6. Dependency Injection Contracts

To keep the new `QuotationScreen` fully testable without real native modules:

```typescript
// Props for QuotationScreen (test-injectable)
filePickerAdapter?: IFilePickerAdapter;    // default: MobileFilePickerAdapter
fileSystemAdapter?: IFileSystemAdapter;    // default: MobileFileSystemAdapter
ocrAdapter?: IOcrAdapter;                  // default: none (skip OCR)
invoiceNormalizer?: IInvoiceNormalizer;    // default: none (skip normalisation)
pdfConverter?: IPdfConverter;              // default: none
```

When `ocrAdapter` and `invoiceNormalizer` are absent, the upload still works — file is copied and form is shown without pre-fill (graceful degradation, identical to current `InvoiceScreen` behaviour).

---

## 7. Test Plan (TDD)

All tests written **red-first** before implementation.

### 7.1 Unit Tests

#### `__tests__/unit/QuotationEntity.autoReference.test.ts` (new file)

| # | Scenario | Expected |
|---|----------|----------|
| 1 | `reference` is empty string | Auto-generates `QUO-YYYYMMDD-XXXXXX` |
| 2 | `reference` is undefined/null | Auto-generates `QUO-YYYYMMDD-XXXXXX` |
| 3 | `reference` is provided | Uses provided reference as-is |
| 4 | Generated ref uses `date` field for YYYYMMDD | Date matches payload.date |
| 5 | Generated ref falls back to today when no date | Date matches today |
| 6 | Generated ref suffix is uppercase alphanumeric 6 chars | Matches `/^[A-Z0-9]{6}$/` |
| 7 | Two calls produce different references | References are unique |

#### `__tests__/unit/normalizedInvoiceToQuotationFormValues.test.ts` (new file)

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Full normalized invoice | All mapped fields populated correctly |
| 2 | `vendor` is null | `vendorName` absent |
| 3 | `invoiceNumber` is null | `reference` absent (not pre-filled) |
| 4 | `invoiceDate` is null | `date` absent |
| 5 | `dueDate` is null | `expiryDate` absent |
| 6 | Line items mapped | `unitPrice`, `quantity`, `description`, `total` correct |
| 7 | Empty line items | `lineItems` absent |
| 8 | `currency` always mapped | Even when other fields are null |

#### `__tests__/unit/QuotationForm.test.tsx` (update existing)

New test cases to add:

| # | Scenario | Expected |
|---|----------|----------|
| A | Render — `currency` input absent | `quotation-currency-input` not found |
| B | Render — `subtotal` input absent | `quotation-subtotal-input` not found |
| C | Render — `tax` input absent | `quotation-tax-input` not found |
| D | Submit with empty reference | `onSubmit` called (reference is optional) |
| E | `pdfFile` prop set | Shows PDF indicator with filename |
| F | `embedded` prop true | Renders without full-screen padding |

#### `__tests__/unit/QuotationScreen.upload.test.tsx` (new file)

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Default render | Upload Pressable visible (`testID="upload-quote-pdf-button"`) |
| 2 | Default render | `QuotationForm` visible (no navigation required) |
| 3 | Upload tapped → picker cancelled | Form unchanged, no error shown |
| 4 | Upload tapped → invalid file type | Alert shown, form unchanged |
| 5 | Upload tapped → OCR adapters absent | Form shown without pre-fill, no error |
| 6 | Upload with OCR adapters → success | `formInitialValues` pre-fills form fields |
| 7 | Upload with OCR → failure | Error banner shown, form still editable |
| 8 | Submit with empty reference | `createQuotation` called; domain entity auto-generates ref |
| 9 | `onSuccess` called after save | Receives created `Quotation` |
| 10 | `onClose` called after save | Modal dismissed |

### 7.2 Integration Tests

#### `__tests__/integration/QuotationScreen.integration.test.tsx` (update existing)

Add:
- Full upload → OCR mock → form pre-fill → save flow
- No-OCR upload flow (file selected, form shown blank)
- Auto-reference generation persisted to in-memory DB

---

## 8. File Change Map

```
MODIFY  src/domain/entities/Quotation.ts
        └─ QuotationEntity.create(): make reference auto-generated when blank

CREATE  src/utils/normalizedInvoiceToQuotationFormValues.ts
        └─ Pure function: NormalizedInvoice → Partial<Quotation>

MODIFY  src/components/quotations/QuotationForm.tsx
        ├─ Add: embedded, pdfFile props
        ├─ Hide: currency, subtotal, tax, status fields
        ├─ Change: reference validation (no longer required in UI)
        └─ Change: reference label/placeholder

MODIFY  src/pages/quotations/QuotationScreen.tsx
        ├─ Add: upload state + handlers (mirroring InvoiceScreen)
        ├─ Add: ProcessInvoiceUploadUseCase wiring
        ├─ Add: normalizedInvoiceToQuotationFormValues integration
        ├─ Layout: always-visible Upload Pressable + QuotationForm
        └─ Add: DI props for filePickerAdapter, fileSystemAdapter, ocrAdapter, etc.

MODIFY  src/pages/receipts/SnapReceiptScreen.tsx
        └─ Camera button: change bg-primary → bg-card border-border, mb-6 → mb-4

CREATE  __tests__/unit/QuotationEntity.autoReference.test.ts
CREATE  __tests__/unit/normalizedInvoiceToQuotationFormValues.test.ts
MODIFY  __tests__/unit/QuotationForm.test.tsx  (add new cases A–F)
CREATE  __tests__/unit/QuotationScreen.upload.test.tsx
MODIFY  __tests__/integration/QuotationScreen.integration.test.tsx
```

---

## 9. Key Invariants

- `QuotationEntity.create()` **always** returns an entity with a non-empty `reference`.
- The `reference` is user-provided or auto-generated `QUO-YYYYMMDD-XXXXXX`; never null in persistence.
- `currency`, `subtotal`, `tax` are **not rendered** in the UI but remain in the data model and are persisted.
- `date` defaults to today (ISO) when not explicitly set by the user or OCR.
- OCR failure is non-blocking: user can always manually enter data.
- `ProcessInvoiceUploadUseCase` is re-used without modification.
- No new DB migrations are required.

---

## 10. Open Questions

1. **Default currency**: The existing `QuotationForm` defaults to `'USD'`. This is misaligned with the rest of the app (`Invoice` defaults to `'AUD'`). Should we change default to `'AUD'` as part of this issue, or defer?

2. **SnapReceiptScreen button icon**: Should the button keep the `Camera` icon with the new border style, or switch to a `Upload` icon consistent with the Quote/Invoice upload Pressable?

3. **Status field**: Hiding `status` defaults it to `'draft'`. Is there a need to expose status in a later step (e.g., after save)?

---

## 11. Handoff Notes for Developer

- Read `src/domain/entities/Invoice.ts` → `InvoiceEntity.create()` for the exact auto-reference pattern to mirror.
- Read `src/pages/invoices/InvoiceScreen.tsx` for the upload pipeline pattern (`handleUploadPdf`, `runProcessingPipeline`).
- Read `src/utils/normalizedInvoiceToFormValues.ts` for the invoice mapper pattern.
- The `QuotationScreen` keeps its internal `<Modal>` wrapper — do **not** remove it (Dashboard uses `visible` prop pattern).
- The `QuotationForm` Drizzle/repository integration is unchanged; only the UI presentation and domain entity change.
- Run `npx tsc --noEmit` after all changes before PR.
