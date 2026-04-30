# Design: Issue #215 — Image OCR Flow for Receipts, Invoices, and Quotations

**Date:** 2026-04-29
**Branch:** `issue-215-image-ocr`
**Author:** Architect agent
**Reviewed by:** mobile-ui agent (see §8 — UI Constraints)
**Status:** Draft — Pending LGTB

---

## 1. Summary

Add an image-based OCR flow that routes uploaded/captured images through the same
ML Kit → LLM pipeline already established for PDFs. The goal is to prefill the
Receipt, Invoice, and Quotation forms from images without duplicating parsing logic.

---

## 2. User Story

> As a builder, when I want to record a Receipt, Invoice, or Quotation, I can:
> 1. **Snap a photo** with my camera, or
> 2. **Upload an image** from my device
> and have the app extract the relevant data and pre-fill the form for review.

---

## 3. Current State Analysis

### 3.1 Existing OCR Pipeline (shared)

```
IOcrAdapter.extractText(imageUri)   ← MobileOcrAdapter (ML Kit, on-device)
        ↓
OcrResult { fullText, tokens }
        ↓
IXxxParsingStrategy.parse(ocrResult) ← LlmXxxParser (Groq API, remote)
        ↓
NormalizedXxx → normalizedXxxToFormValues() → Form prefill
```

### 3.2 Gap Matrix

| Feature | File Picker (image) | Camera Capture | LLM Parsing for Images |
|---------|-------------------|----------------|------------------------|
| **Receipt** | ✅ `ProcessReceiptUploadUseCase` image path → `IReceiptParsingStrategy.parse()` | ❌ routes to `DeterministicReceiptNormalizer` (not LLM) | ✅ strategy wired when provided |
| **Invoice** | ⚠️ `ProcessInvoiceUploadUseCase` image path → `IInvoiceNormalizer.normalize()` (deterministic, not LLM) | ❌ no camera capture | ❌ no `IInvoiceParsingStrategy` exists |
| **Quotation** | ✅ `ProcessQuotationUploadUseCase` image path → `IQuotationParsingStrategy.parse()` | ❌ no camera capture | ✅ strategy wired when provided |

### 3.3 Key Finding: Invoice Uses a Different Parsing Contract

The invoice feature uses `IInvoiceNormalizer` (two-phase: `extractCandidates()` + `normalize()`)
rather than the single-phase `parse(ocrResult)` contract used by Receipt and Quotation. This
divergence must be resolved to keep downstream form-filling logic consistent.

---

## 4. Scope

### In Scope
- Add `IInvoiceParsingStrategy` interface (aligns with `IReceiptParsingStrategy` / `IQuotationParsingStrategy`)
- Add `LlmInvoiceParser` infrastructure adapter (Groq API, mirrors `LlmReceiptParser` / `LlmQuotationParser`)
- Update `ProcessInvoiceUploadUseCase` image path to use `IInvoiceParsingStrategy` (with fallback to `IInvoiceNormalizer` for backward compat)
- Add camera capture option to `InvoiceScreen` and `QuotationScreen`
- Fix receipt camera path to route through `ProcessReceiptUploadUseCase` + LLM when a parsing strategy is provided
- Form prefill for Receipt, Invoice, Quotation from image OCR results
- Preserve all existing PDF OCR flows unchanged
- TypeScript strict-mode compliance throughout

### Out of Scope
- Replacing `IInvoiceNormalizer` / `InvoiceNormalizer` (kept for PDF backward compat)
- Changing `DeterministicReceiptNormalizer` (used when no LLM strategy provided)
- Multi-image upload (select multiple images for one document)
- On-device LLM inference

---

## 5. Acceptance Criteria

| # | Criterion |
|---|-----------|
| AC1 | Camera-captured images can be processed through the OCR/LLM pipeline for Receipts, Invoices, and Quotations |
| AC2 | Gallery-picked image files can be processed through the OCR/LLM pipeline for all three features |
| AC3 | Parsed image data populates Receipt form fields |
| AC4 | Parsed image data populates Invoice form fields |
| AC5 | Parsed image data populates Quotation form fields |
| AC6 | Existing PDF OCR behavior is unchanged |
| AC7 | `npx tsc --noEmit` passes with no new errors |

---

## 6. Architectural Decisions

### AD1 — Add `IInvoiceParsingStrategy` (Align Contract)

**Decision:** Introduce `IInvoiceParsingStrategy` with a single `parse(ocrResult: OcrResult): Promise<NormalizedInvoice>` method, mirroring `IReceiptParsingStrategy` and `IQuotationParsingStrategy`.

**Rationale:** Keeps the parsing contract consistent across all three features. Downstream `normalizedXxxToFormValues()` utilities can remain unchanged since they consume `NormalizedXxx` types, not strategies.

**New file:** `src/features/invoices/application/IInvoiceParsingStrategy.ts`

### AD2 — `ProcessInvoiceUploadUseCase`: Strategy Takes Priority for Images

**Decision:** Accept an optional `parsingStrategy?: IInvoiceParsingStrategy` constructor parameter. For the image path: if `parsingStrategy` is provided, call `parsingStrategy.parse(ocrResult)` and return; otherwise fall back to `normalizer.extractCandidates()` + `normalizer.normalize()`.

**Rationale:** Zero breaking change — existing callers wired without a strategy still work. New callers pass the LLM strategy.

**Modified file:** `src/features/invoices/application/ProcessInvoiceUploadUseCase.ts`

### AD3 — Receipt Camera Path: LLM When Strategy Provided

**Decision:** In `useSnapReceiptScreen.handleSnapPhoto()`, when a `receiptParsingStrategy` is provided, call `processPdfReceipt({ fileUri: cameraUri, mimeType: 'image/jpeg', ... })` instead of `processReceipt(cameraUri)`. This routes the camera image through `ProcessReceiptUploadUseCase` → image path → LLM.

**Rationale:** `ProcessReceiptUploadUseCase` image path already calls `parsingStrategy.parse(ocrResult)` — no use-case changes needed. Only the hook routing changes.

**Modified file:** `src/features/receipts/hooks/useSnapReceiptScreen.ts`

### AD4 — Camera Capture for Invoice and Quotation

**Decision:** Add `handleSnapPhoto()` to `useInvoiceUpload` and `useQuotationUpload` hooks. Each handler:
1. Calls `ICameraAdapter.capturePhoto()`
2. Uses the captured `imageUri` + `'image/jpeg'` mimeType
3. Passes to `ProcessXxxUploadUseCase.execute()` (existing use case, image path)
4. Sets form initial values from normalized result

**Rationale:** Reuses existing camera adapter (`ICameraAdapter` / `MobileCameraAdapter`) and the existing use-case image path — no new application-layer changes.

**Modified files:** 
- `src/features/invoices/hooks/useInvoiceUpload.ts`
- `src/features/quotations/hooks/useQuotationUpload.ts`

### AD5 — `LlmInvoiceParser` (Groq, mirrors `LlmReceiptParser`)

**Decision:** Add `LlmInvoiceParser` implementing `IInvoiceParsingStrategy`. Uses the same Groq Chat Completions API, same error-handling pattern, same JSON schema approach. Returns `NormalizedInvoice`.

**New file:** `src/features/invoices/infrastructure/LlmInvoiceParser.ts`

### AD6 — UI: Minimal Camera Addition

**Decision (pending mobile-ui review):** Add a "Snap Photo" pressable button alongside the existing upload button in `InvoiceScreen` and `QuotationScreen`. Styling follows the existing card/chip pattern used in `SnapReceiptScreen`.

**UI States (for both Invoice and Quotation):**
- `idle` — shows both "Snap Photo" and "Upload File" options
- `processing` (new) — shows loading indicator while camera → OCR → LLM runs
- `form` — shows form pre-filled with parsed data (existing)

**Modified files:**
- `src/features/invoices/screens/InvoiceScreen.tsx`
- `src/features/quotations/screens/QuotationScreen.tsx`

### AD7 — No Changes to `validatePdfFile()`

`validatePdfFile()` already supports image MIME types (`image/jpeg`, `image/png`, `image/heic`, `image/webp`). No changes needed.

### AD8 — No New Camera Adapter

`ICameraAdapter` / `MobileCameraAdapter` is already used by the receipt flow. Invoice and Quotation hooks will accept it via DI (optional param with `MobileCameraAdapter` as default).

---

## 7. Layer-by-Layer Changes

### 7.1 Application Layer — New Interface

**`src/features/invoices/application/IInvoiceParsingStrategy.ts`** (NEW)
```typescript
import { OcrResult } from '../../../application/services/IOcrAdapter';
import { NormalizedInvoice } from './IInvoiceNormalizer';

export type InvoiceParsingStrategyType = 'llm';

export interface IInvoiceParsingStrategy {
  readonly strategyType: InvoiceParsingStrategyType;
  parse(ocrResult: OcrResult): Promise<NormalizedInvoice>;
}
```

### 7.2 Application Layer — Updated Use Case

**`src/features/invoices/application/ProcessInvoiceUploadUseCase.ts`** (MODIFIED)

Constructor change:
```typescript
constructor(
  private readonly ocrAdapter?: IOcrAdapter,
  private readonly normalizer?: IInvoiceNormalizer,
  private readonly pdfConverter?: IPdfConverter,
  private readonly fileSystemAdapter?: IFileSystemAdapter,
  private readonly parsingStrategy?: IInvoiceParsingStrategy,  // NEW
) { ... }
```

Image path change (after `mimeType === 'application/pdf'` block):
```typescript
// ── Image path ────────────────────────────────────────────────────────────
try {
  const ocrResult = await this.ocrAdapter.extractText(localUri);
  const rawOcrText = ocrResult.fullText;

  // Prefer LLM strategy (new); fall back to deterministic normalizer (legacy)
  if (this.parsingStrategy) {
    const normalized = await this.parsingStrategy.parse(ocrResult);
    return { normalized, documentRef, rawOcrText };
  }

  const candidates = this.normalizer.extractCandidates(rawOcrText);
  const normalized = await this.normalizer.normalize(candidates, ocrResult);
  return { normalized, documentRef, rawOcrText };
} catch (err: any) { ... }
```

### 7.3 Infrastructure Layer — New LLM Parser

**`src/features/invoices/infrastructure/LlmInvoiceParser.ts`** (NEW)

- Implements `IInvoiceParsingStrategy`
- Calls Groq Chat Completions with a system prompt defining the `NormalizedInvoice` JSON schema
- Parses response, maps to `NormalizedInvoice`
- Mirrors `LlmReceiptParser` structure exactly

System prompt extracts: vendor, invoiceNumber, invoiceDate, dueDate, subtotal, tax, total, currency, lineItems[]

### 7.4 Hooks Layer

**`src/features/receipts/hooks/useSnapReceiptScreen.ts`** (MODIFIED)

In `handleSnapPhoto()`, add strategy routing:
```typescript
const handleSnapPhoto = async () => {
  ...
  const result = await camera.capturePhoto({ quality: 0.85 });
  if (result.cancelled) return;

  if (receiptParsingStrategy) {
    // Route through ProcessReceiptUploadUseCase → LLM path
    const normalized = await processPdfReceipt({
      fileUri: result.uri,
      filename: 'receipt.jpg',
      mimeType: 'image/jpeg',
      fileSize: result.fileSize,
    });
    if (normalized) {
      setNormalizedData(normalized);
      setFormInitialValues(normalizedReceiptToFormValues(normalized));
      setView('form');
    }
  } else {
    // Existing deterministic path
    const normalized = await processReceipt(result.uri);
    ...
  }
};
```

**`src/features/invoices/hooks/useInvoiceUpload.ts`** (MODIFIED)

- Add `cameraAdapter?: ICameraAdapter` to `InvoiceUploadOptions`
- Add `handleSnapPhoto: () => Promise<void>` to `InvoiceUploadViewModel`
- Implementation: capture photo → call `ProcessInvoiceUploadUseCase.execute()` with image mimeType → set form values

**`src/features/quotations/hooks/useQuotationUpload.ts`** (MODIFIED)

- Add `cameraAdapter?: ICameraAdapter` to `QuotationUploadOptions`
- Add `handleSnapPhoto: () => Promise<void>` to `QuotationUploadViewModel`
- Implementation: capture photo → call `ProcessQuotationUploadUseCase.execute()` with image mimeType → set form values

### 7.5 UI Layer

**`src/features/invoices/screens/InvoiceScreen.tsx`** (MODIFIED)

Add a "Snap Photo" pressable button above the existing "Upload File" button. When tapped, calls `vm.handleSnapPhoto()`. Disabled while `vm.isProcessing`.

**`src/features/quotations/screens/QuotationScreen.tsx`** (MODIFIED)

Add a "Snap Photo" pressable button above the existing "Upload PDF" button. When tapped, calls `vm.handleSnapPhoto()`. Disabled while `vm.isProcessing`.

---

## 8. UI Design (mobile-ui Agent Review Required)

> **Note:** The following UI recommendations are based on the existing component patterns
> observed in the codebase. The `mobile-ui` agent must confirm or adjust before implementation.
> All styling MUST use existing NativeWind tokens. No new design tokens or layout patterns
> may be introduced without mobile-ui approval.

### 8.1 Existing Patterns Observed

| Screen | Upload Button Style | Form Visibility |
|--------|--------------------|-----------------| 
| `SnapReceiptScreen` | Three full-width stacked cards (`bg-card border border-border rounded-2xl p-5 mb-4 flex-row items-center`) | Form shown only after capture |
| `QuotationScreen` | Single full-width pressable (`bg-card border border-border rounded-xl p-4 items-center flex-row justify-center`) | QuotationForm always visible below upload section |
| `InvoiceScreen` | Single full-width pressable (`bg-primary/10 border border-primary/30 p-4 rounded-xl flex-row items-center justify-center`) | Form only shown after processing completes |

### 8.2 QuotationScreen — Architect Recommendation (mobile-ui to confirm)

**Proposed:** Replace the single upload button with two compact side-by-side buttons to avoid
taking too much vertical space from the always-visible form.

```
[Header: "New Quotation" | Close ×]
[━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━]
[ Row: [📷 Snap Photo] [📎 Upload] ]   ← NEW row of equal-width pressable cards
[━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━]
[ QuotationForm (always visible)   ]
```

Style: `bg-card border border-border rounded-xl p-4 flex-row items-center justify-center`  
Both buttons disabled + single `ActivityIndicator` on active button when `isProcessing`.  
`testID`: `"snap-quote-photo-button"` | `"upload-quote-file-button"` (rename from `"upload-quote-pdf-button"`)

**Open Question Q1 for mobile-ui:** Side-by-side or stacked (full-width) for the two buttons?

### 8.3 InvoiceScreen — Architect Recommendation (mobile-ui to confirm)

**Proposed:** Replace the single upload button with two side-by-side buttons, matching the
QuotationScreen pattern. The InvoiceForm appears below only after OCR completes.

```
[Header: "New Invoice"]
[━━━━━━━━━━━━━━━━━━━━━]
[ Row: [📷 Snap Photo] [📎 Upload] ]   ← NEW two-button row
[━━━━━━━━━━━━━━━━━━━━━]
[ InvoiceForm (after processing)   ]
```

`testID`: `"snap-invoice-photo-button"` | `"upload-invoice-file-button"` (rename from `"upload-pdf-button"`)

**Open Question Q2 for mobile-ui:** When camera capture is processing (OCR + LLM), should InvoiceScreen show a full-screen loading overlay or just a spinner on the button?

### 8.4 SnapReceiptScreen — No Visual Change

The three-option layout (Snap Photo / Upload PDF / Enter Manually) is **unchanged visually**.
The routing change (camera image → LLM when strategy provided) is entirely invisible to the user.

**Open Question Q3 for mobile-ui:** Should the "Snap Photo" card in `SnapReceiptScreen` display
any visual indicator distinguishing LLM-mode vs deterministic-mode? (Architect recommendation: No — keep UI simple and consistent regardless of backend path.)

### 8.5 ExtractionResultsPanel for Image OCR (Invoice)

The existing `ExtractionResultsPanel` component in the Invoice feature shows extracted data for user review before accepting. 

**Open Question Q4 for mobile-ui:** Should image-based invoice OCR results also go through `ExtractionResultsPanel` (review step), or go directly to the `InvoiceForm`? Current PDF flow uses review step.

---

## 9. Data Flow Diagrams

### 9.1 Receipt Camera → LLM (Fixed Path)
```
User taps "Snap Photo"
    → MobileCameraAdapter.capturePhoto()
    → imageUri (JPEG)
    → useSnapReceiptScreen.handleSnapPhoto()
    → [receiptParsingStrategy present?]
        YES → processPdfReceipt({ fileUri: imageUri, mimeType: 'image/jpeg', ... })
               → ProcessReceiptUploadUseCase.execute() [image path]
               → MobileOcrAdapter.extractText(imageUri)    ← ML Kit
               → LlmReceiptParser.parse(ocrResult)         ← Groq
               → NormalizedReceipt
               → normalizedReceiptToFormValues()
               → ReceiptForm pre-filled
        NO  → processReceipt(imageUri)                     ← deterministic (unchanged)
```

### 9.2 Invoice Image (New Path)
```
User taps "Snap Photo" or "Upload File" (image)
    → camera URI or file picker URI (JPEG/PNG/HEIC)
    → useInvoiceUpload.handleSnapPhoto() / handleUploadPdf()
    → ProcessInvoiceUploadUseCase.execute({ mimeType: 'image/...' })
    → validatePdfFile()                                    ← already supports images ✅
    → MobileOcrAdapter.extractText(imageUri)               ← ML Kit
    → [parsingStrategy present?]
        YES → LlmInvoiceParser.parse(ocrResult)            ← Groq (NEW)
        NO  → InvoiceNormalizer.extractCandidates() + .normalize()  ← deterministic (fallback)
    → NormalizedInvoice
    → normalizedInvoiceToFormValues()
    → InvoiceForm pre-filled
```

### 9.3 Quotation Image (Path Already Exists, Camera Added)
```
User taps "Snap Photo" (NEW) or "Upload File" (image)
    → camera URI or file picker URI
    → useQuotationUpload.handleSnapPhoto() / handleUploadPdf()
    → ProcessQuotationUploadUseCase.execute({ mimeType: 'image/...' })
    → [image path — already implemented ✅]
    → MobileOcrAdapter.extractText(imageUri)               ← ML Kit
    → LlmQuotationParser.parse(ocrResult)                 ← Groq (already wired ✅)
    → NormalizedQuotation
    → normalizedQuotationToFormValues()
    → QuotationForm pre-filled
```

---

## 10. New Files

| File | Type | Description |
|------|------|-------------|
| `src/features/invoices/application/IInvoiceParsingStrategy.ts` | NEW | Parsing strategy interface |
| `src/features/invoices/infrastructure/LlmInvoiceParser.ts` | NEW | Groq-backed LLM parser |

## 11. Modified Files

| File | Change |
|------|--------|
| `src/features/invoices/application/ProcessInvoiceUploadUseCase.ts` | Add `IInvoiceParsingStrategy` param; image path prefers strategy |
| `src/features/invoices/hooks/useInvoiceUpload.ts` | Add `cameraAdapter`, `parsingStrategy`; add `handleSnapPhoto()` |
| `src/features/invoices/screens/InvoiceScreen.tsx` | Add "Snap Photo" button |
| `src/features/quotations/hooks/useQuotationUpload.ts` | Add `cameraAdapter`; add `handleSnapPhoto()` |
| `src/features/quotations/screens/QuotationScreen.tsx` | Add "Snap Photo" button |
| `src/features/receipts/hooks/useSnapReceiptScreen.ts` | Route camera → LLM when strategy provided |

---

## 12. Test Plan (TDD Workflow)

### 12.1 Unit Tests

#### `IInvoiceParsingStrategy` / `LlmInvoiceParser`
- **File:** `src/features/invoices/tests/unit/LlmInvoiceParser.test.ts`
- Tests:
  - [ ] Returns `NormalizedInvoice` with correct fields from mocked Groq response
  - [ ] Returns empty `NormalizedInvoice` on malformed JSON response (graceful degradation)
  - [ ] `strategyType` is `'llm'`

#### `ProcessInvoiceUploadUseCase` — Image Path with Strategy
- **File:** `src/features/invoices/tests/unit/ProcessInvoiceUploadUseCase.test.ts` (extend existing)
- Tests:
  - [ ] Image MIME type with `parsingStrategy` → calls `parsingStrategy.parse()`, NOT `normalizer.extractCandidates()`
  - [ ] Image MIME type without `parsingStrategy` → falls back to `normalizer.extractCandidates()` + `normalize()` (existing behavior preserved)
  - [ ] PDF MIME type → unchanged: uses `pdfConverter` + `IInvoiceNormalizer` (regression)

#### `useInvoiceUpload` — Camera Capture
- **File:** `src/features/invoices/tests/unit/useInvoiceUpload.test.ts` (extend existing)
- Tests:
  - [ ] `handleSnapPhoto()` calls `cameraAdapter.capturePhoto()`
  - [ ] On successful capture, calls `ProcessInvoiceUploadUseCase.execute()` with `mimeType: 'image/jpeg'`
  - [ ] On cancelled capture, does nothing
  - [ ] On OCR/LLM error, sets `processingError`

#### `useQuotationUpload` — Camera Capture
- **File:** `src/features/quotations/tests/unit/hooks/useQuotationUpload.test.ts` (new or extend)
- Tests:
  - [ ] `handleSnapPhoto()` calls `cameraAdapter.capturePhoto()`
  - [ ] On successful capture, calls `ProcessQuotationUploadUseCase.execute()` with image mimeType
  - [ ] Sets `formInitialValues` from parsed quotation

#### `useSnapReceiptScreen` — Camera LLM Routing
- **File:** `src/features/receipts/tests/unit/useSnapReceiptScreen.test.ts` (extend existing)
- Tests:
  - [ ] With `receiptParsingStrategy`, `handleSnapPhoto()` calls `processPdfReceipt()` not `processReceipt()`
  - [ ] Without `receiptParsingStrategy`, `handleSnapPhoto()` calls `processReceipt()` (unchanged)

### 12.2 Integration Tests

#### Invoice Image OCR → Form Prefill
- **File:** `src/features/invoices/tests/integration/ProcessInvoiceUpload.integration.test.ts` (extend)
- Tests:
  - [ ] End-to-end: JPEG image → `LlmInvoiceParser` mock → `NormalizedInvoice` → `normalizedInvoiceToFormValues()`

#### Quotation Image OCR → Form Prefill  
- **File:** `src/features/quotations/tests/integration/QuotationScreen.integration.test.tsx` (extend)
- Tests:
  - [ ] Camera snap → mock OCR → mock LLM → form values set on `QuotationForm`

#### Receipt Camera → LLM Routing
- **File:** `src/features/receipts/tests/integration/SnapReceiptCamera.integration.test.tsx` (extend)
- Tests:
  - [ ] Camera snap with `LlmReceiptParser` mock → `NormalizedReceipt` form values set

### 12.3 Component Tests (UI)

#### `InvoiceScreen` — Snap Photo Button
- **File:** `src/features/invoices/tests/unit/screens/InvoiceScreen.test.tsx` (extend)
- Tests:
  - [ ] Renders "Snap Photo" button
  - [ ] Tapping "Snap Photo" calls `handleSnapPhoto()`
  - [ ] Button disabled when `isProcessing`
  - [ ] `testID="snap-invoice-photo-button"` present

#### `QuotationScreen` — Snap Photo Button
- **File:** `src/features/quotations/tests/unit/QuotationScreen.test.tsx` (extend)
- Tests:
  - [ ] Renders "Snap Photo" button (`testID="snap-quote-photo-button"`)
  - [ ] Tapping it calls `handleSnapPhoto()`
  - [ ] Button disabled when `isProcessing`

---

## 13. Open Questions for mobile-ui Agent

1. **Q1:** Should the "Snap Photo" and "Upload File" buttons be side-by-side (compact row) or stacked (full-width cards like `SnapReceiptScreen`)? For `QuotationScreen`, stacked feels heavy since the form is always visible below.
2. **Q2:** Should camera capture for Invoice and Quotation show a "processing" full-screen overlay (like the receipt's `view === 'processing'` state) or just a spinner on the button?
3. **Q3:** Should the `InvoiceScreen` adopt the same three-option card layout as `SnapReceiptScreen` (snap photo / upload file / enter manually), or keep the existing upload-first flow?
4. **Q4:** On successful image OCR, should both Invoice and Quotation show an "Extraction Review" panel (like the existing `ExtractionResultsPanel` in Invoice) before the form, or go directly to the form?

---

## 14. Implementation Order (for developer agent)

1. **Domain/Application** (no UI, no infra — TDD first)
   - `IInvoiceParsingStrategy.ts` — interface
   - Update `ProcessInvoiceUploadUseCase` — image path with strategy fallback
   - Write failing unit tests for the above

2. **Infrastructure**
   - `LlmInvoiceParser.ts` — Groq implementation
   - Write unit tests for parser

3. **Hooks** (no UI changes yet)
   - Update `useSnapReceiptScreen` — camera → LLM routing
   - Update `useInvoiceUpload` — camera support + strategy wiring
   - Update `useQuotationUpload` — camera support
   - Write failing unit tests for each hook change

4. **UI** (after mobile-ui agent review of §8)
   - Update `InvoiceScreen` — add Snap Photo button
   - Update `QuotationScreen` — add Snap Photo button
   - Write component tests

5. **Integration Tests** — end-to-end wiring

6. **Typecheck** — `npx tsc --noEmit`

---

## 15. Invariants (Must Not Break)

- Existing PDF OCR flows for all three features must pass existing tests unchanged
- `validatePdfFile()` is not modified
- `IOcrAdapter`, `IOcrDocumentService`, `OcrDocumentService` are not modified
- `IInvoiceNormalizer` / `InvoiceNormalizer` is not modified
- No new database migrations required
- Camera permissions flow reuses existing `ICameraAdapter.requestPermissions()`
