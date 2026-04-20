# Design: Issue #208 — Snap Receipt: PDF Upload + LLM Parsing + Line Items

**Date:** 2026-04-20  
**Branch:** `feature/issue-208-snap-receipt-pdf-llm`  
**Status:** Draft — Awaiting LGTB approval

---

## 1. User Story

> As a builder, when I tap **Snap Receipt**, I want three capture options:
> 1. **Snap Photo** — take a camera photo (existing ✅)
> 2. **Upload PDF** — pick a PDF receipt from device storage and have it parsed by an LLM
> 3. **Enter Manually** — fill in the form by hand (existing ✅)
>
> For options 1 and 2, the parsed data (including any line items) should pre-populate the Receipt Form for validation before saving.

---

## 2. Context & Current State

| Capability | Status |
|---|---|
| Camera capture → OCR → `ReceiptForm` | ✅ existing |
| Manual entry via `ReceiptForm` | ✅ existing |
| PDF Upload pipeline for Invoice/Quotation | ✅ (`ProcessInvoiceUploadUseCase` / `ProcessQuotationUploadUseCase`) |
| LLM parser for quotations | ✅ (`LlmQuotationParser`, Groq `llama-3.3-70b-versatile`) |
| Line items UI | ✅ (`QuotationForm` — add/remove/auto-total) |
| `normalizedQuotationToFormValues` utility | ✅ |
| Upload PDF in `SnapReceiptScreen` | ❌ missing |
| LLM parsing for receipt PDFs | ❌ missing |
| Line items in `ReceiptForm` | ❌ missing |

### Key Observation on `NormalizedReceipt`

The existing `NormalizedReceipt` interface (in `IReceiptNormalizer.ts`) already carries a `lineItems: NormalizedLineItem[]` field (with `description`, `quantity`, `unitPrice`, `total`, `category?`). **This field is currently ignored by `ReceiptForm`** — it is populated by neither the deterministic normalizer nor the hook. The scope of this issue is to wire it through end-to-end for the PDF LLM path.

---

## 3. Scope

### In Scope
- Add **Upload PDF** option (third tile) to `SnapReceiptScreen`
- New `IReceiptParsingStrategy` interface (mirrors `IQuotationParsingStrategy`)
- New `LlmReceiptParser` infrastructure adapter (Groq API)
- New `ProcessReceiptUploadUseCase` (PDF → images → OCR → LLM → `NormalizedReceipt`)
- Extend `NormalizedReceipt` with `subtotal`, `paymentMethod`, `receiptNumber` fields needed by LLM output (see §5)
- Add **line items section** to `ReceiptForm` (description, qty, unit price, auto-total)
- New `normalizedReceiptToFormValues` utility: `NormalizedReceipt → Partial<SnapReceiptDTO>`
- Update `SnapReceiptUseCase.saveReceipt` to persist `lineItems` as JSON in `invoices.lineItems` column (existing column, no migration needed)
- Unit + integration tests per CLAUDE.md TDD workflow

### Out of Scope
- Changing the camera / on-device OCR flow for photos
- Editing/deleting saved line items after submission
- Upgrading `DeterministicReceiptNormalizer` to extract line items (heuristic approach left for a future ticket)

---

## 4. Architectural Decisions

### D1 — Strategy Pattern for LLM Parser
`IReceiptParsingStrategy` follows the same contract as `IQuotationParsingStrategy`: it accepts an `OcrResult` and returns a `NormalizedReceipt`. This keeps the `ProcessReceiptUploadUseCase` decoupled from Groq.

### D2 — Line Item Persistence: JSON in `invoices.lineItems`
The `invoices` table already has a `lineItems text` column (stores JSON). **No new DB migration is required.** `SnapReceiptUseCase.saveReceipt` will serialize `lineItems[]` into this column via `DrizzleInvoiceRepository`. This unblocks the feature without schema risk.

### D3 — `SnapReceiptScreen` Refactor to Three-Option Menu
The current screen shows a camera button + manual form. It will be refactored to show **three distinct option cards** before any capture action. The form is shown only after a capture path is chosen.

### D4 — `normalizedReceiptToFormValues` vs. Extending `SnapReceiptDTO`
`SnapReceiptDTO` will gain an optional `lineItems` field. `normalizedReceiptToFormValues` maps `NormalizedReceipt → Partial<SnapReceiptDTO>` (mirroring the quotation pattern exactly).

### D5 — `useSnapReceipt` Hook Extension
A new `processPdfReceipt(fileUri)` method is added to the hook. The hook instantiates `ProcessReceiptUploadUseCase` with the Groq API key from `featureFlags` / environment config (same approach as `LlmQuotationParser` wired in `QuotationScreen`).

---

## 5. Domain / Application Contracts

### 5.1 `NormalizedReceipt` (extend existing)

```typescript
// src/application/receipt/IReceiptNormalizer.ts
export interface NormalizedLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  category?: string;
}

export interface NormalizedReceipt {
  vendor: string | null;
  date: Date | null;
  total: number | null;
  subtotal: number | null;          // ← NEW
  tax: number | null;
  currency: string;
  paymentMethod: 'card' | 'cash' | 'bank' | 'other' | null;  // ← NEW
  receiptNumber: string | null;     // ← NEW
  lineItems: NormalizedLineItem[];  // ← already exists; now populated
  notes: string | null;             // ← NEW (replaces suggestedCorrections misuse)
  confidence: {
    overall: number;
    vendor: number;
    date: number;
    total: number;
  };
  suggestedCorrections: string[];
}
```

### 5.2 `IReceiptParsingStrategy` (new)

```typescript
// src/application/receipt/IReceiptParsingStrategy.ts
import { OcrResult } from '../services/IOcrAdapter';
import { NormalizedReceipt } from './IReceiptNormalizer';

export type ReceiptParsingStrategyType = 'llm';

export interface IReceiptParsingStrategy {
  readonly strategyType: ReceiptParsingStrategyType;
  parse(ocrResult: OcrResult): Promise<NormalizedReceipt>;
}
```

### 5.3 `ProcessReceiptUploadUseCase` (new)

```typescript
// src/application/usecases/receipt/ProcessReceiptUploadUseCase.ts
export interface ProcessReceiptUploadInput {
  fileUri: string;
  filename: string;
  mimeType: string;
  fileSize: number;
}

export interface ProcessReceiptUploadOutput {
  normalized: NormalizedReceipt;
  rawOcrText: string;
}

export class ProcessReceiptUploadUseCase {
  constructor(
    private readonly ocrAdapter: IOcrAdapter,
    private readonly parsingStrategy: IReceiptParsingStrategy,
    private readonly pdfConverter?: IPdfConverter,
    private readonly ocrDocumentService: IOcrDocumentService = new OcrDocumentService(ocrAdapter),
  ) {}

  async execute(input: ProcessReceiptUploadInput): Promise<ProcessReceiptUploadOutput>;
}
```

Pipeline (mirrors `ProcessQuotationUploadUseCase` exactly):
1. If PDF: convert pages via `IPdfConverter` → OCR each page → concatenate `fullText`
2. If image: OCR directly
3. Pass `OcrResult` to `IReceiptParsingStrategy.parse()`
4. Return `NormalizedReceipt` + `rawOcrText`

### 5.4 `SnapReceiptDTO` (extend)

```typescript
// src/application/usecases/receipt/SnapReceiptUseCase.ts
export interface ReceiptLineItemDTO {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface SnapReceiptDTO {
  vendorId: string;
  vendor: string;
  amount: number;
  date: string;
  paymentMethod: Payment['method'];
  projectId?: string;
  category?: string;
  currency?: string;
  notes?: string;
  lineItems?: ReceiptLineItemDTO[];  // ← NEW
}
```

### 5.5 `normalizedReceiptToFormValues` (new utility)

```typescript
// src/utils/normalizedReceiptToFormValues.ts
export function normalizedReceiptToFormValues(
  normalized: NormalizedReceipt,
): Partial<SnapReceiptDTO>
```

Mapping rules:
| `NormalizedReceipt` field | → `SnapReceiptDTO` field |
|---|---|
| `vendor` | `vendor` |
| `total` | `amount` |
| `date` | `date` (ISO string) |
| `paymentMethod` | `paymentMethod` |
| `currency` | `currency` |
| `notes` | `notes` |
| `lineItems[]` | `lineItems[]` |

### 5.6 `SnapReceiptUseCase.saveReceipt` (update)

When `lineItems` are present in `SnapReceiptDTO`, serialize them to JSON and pass to `InvoiceEntity.create` via the existing `lineItems` field (which maps to `invoices.lineItems` text column in schema). No schema migration needed.

---

## 6. Infrastructure

### 6.1 `LlmReceiptParser` (new)

```typescript
// src/infrastructure/ai/LlmReceiptParser.ts
export class LlmReceiptParser implements IReceiptParsingStrategy {
  readonly strategyType: ReceiptParsingStrategyType = 'llm';

  constructor(
    private readonly apiKey: string,
    private readonly timeoutMs = 30_000,
  ) {}

  async parse(ocrResult: OcrResult): Promise<NormalizedReceipt>;
}
```

**Groq API:** `POST https://api.groq.com/openai/v1/chat/completions`  
**Model:** `llama-3.3-70b-versatile`  
**Temperature:** `0`  
**Max tokens:** `1024`

**System prompt:**
```
You are a document parser for a construction project management app.
Extract structured receipt information from OCR text.
Respond ONLY with valid JSON matching this schema:
{
  "vendor": string | null,
  "date": string | null,        // ISO date YYYY-MM-DD
  "total": number | null,
  "subtotal": number | null,
  "tax": number | null,
  "currency": string,           // default "AUD"
  "paymentMethod": "card" | "cash" | "bank" | "other" | null,
  "receiptNumber": string | null,
  "lineItems": [
    {
      "description": string,
      "quantity": number,
      "unitPrice": number,
      "total": number
    }
  ],
  "notes": string | null
}
Do not wrap in markdown or code blocks.
Set null for fields not found in the document.
```

Error handling (mirrors `LlmQuotationParser`):
- HTTP error → throw `Error('Groq LLM failed: HTTP <status>')`
- Timeout → throw `Error('Groq LLM timed out after Nms')`
- Malformed JSON → return `emptyNormalizedReceipt()` (graceful fallback)

---

## 7. UI Design

### 7.1 `SnapReceiptScreen` — Three-Option Menu

**Current layout:** Camera button + "Or enter manually" divider + inline form.

**New layout:** A selection screen with three vertically-stacked option cards. The form is _not_ shown on this screen. After a capture path succeeds, navigate to `ReceiptForm` with pre-filled values; on failure, show error + option to fall back to manual.

```
┌─────────────────────────────────────┐
│  Snap Receipt                    [X] │
├─────────────────────────────────────┤
│                                     │
│  ┌─────────────────────────────┐    │
│  │ 📷  Snap Photo              │    │  ← existing camera flow
│  │     Take a photo of receipt │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ 📄  Upload PDF              │    │  ← NEW
│  │     Pick a PDF from device  │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ ✏️   Enter Manually          │    │  ← existing manual form
│  │     Fill in the details     │    │
│  └─────────────────────────────┘    │
│                                     │
└─────────────────────────────────────┘
```

**State machine:**

```
SELECTING
  ├── tap Snap Photo  → CAPTURING (camera) → PROCESSING → FILLING_FORM
  ├── tap Upload PDF  → PICKING_FILE → PROCESSING → FILLING_FORM
  └── tap Manual      → FILLING_FORM (empty)

PROCESSING
  └── shows ActivityIndicator overlay with "Extracting receipt details…"

FILLING_FORM
  └── renders existing ReceiptForm with initialValues pre-populated

ERROR
  └── shows Alert with retry / "Enter manually" fallback
```

**Props change:** `SnapReceiptScreen` gains an optional `pdfUploadEnabled?: boolean` prop (default `true`) and optional `filePicker?: IFilePickerAdapter` for DI in tests.

### 7.2 `ReceiptForm` — Line Items Section

Mirrors the line items UX from `QuotationForm` exactly. Placed **below the Payment Method field** and **above Notes**.

```
┌─────────────────────────────────────┐
│  Line Items (optional)              │
│  ─────────────────────────          │
│  [Description][Qty][Unit $][Total]  │  ← header row labels
│                                     │
│  [ Concrete blocks    ][2][45.00][90.00] [×] │
│  [ Gravel bags        ][5][12.00][60.00] [×] │
│                                     │
│  ──────────────────────────────     │
│  Subtotal:  $150.00                 │
│                                     │
│  [+ Add Line Item]                  │
└─────────────────────────────────────┘
```

**Behaviour:**
- User can add / remove individual line items
- `quantity × unitPrice` auto-calculates `total` for each row (same logic as `QuotationForm.updateLineItem`)
- When line items are present: `subtotal = sum(lineItem.total)`. The **Total Amount** field auto-updates to subtotal unless the user has manually overridden it
- Backward compatible: works with zero line items (existing receipts unaffected)

**`ReceiptFormProps` additions:**
```typescript
interface ReceiptFormProps {
  // ... existing props
  initialValues?: Partial<SnapReceiptDTO>;  // now includes lineItems[]
}
```

**`SnapReceiptDTO` is passed to `onSubmit`** — it now carries `lineItems[]`.

### 7.3 Processing UX

While PDF parsing is in progress, `ReceiptForm` shows the existing `isProcessing` spinner overlay:
```
[ActivityIndicator]
"Extracting receipt details…"
"This may take a few seconds"
```

No change to existing spinner — it already handles this state.

---

## 8. File Change Summary

| File | Change |
|---|---|
| `src/application/receipt/IReceiptNormalizer.ts` | Add `subtotal`, `paymentMethod`, `receiptNumber`, `notes` to `NormalizedReceipt`; rename `NormalizedLineItem` consistent with new field |
| `src/application/receipt/IReceiptParsingStrategy.ts` | **NEW** — strategy interface |
| `src/application/usecases/receipt/ProcessReceiptUploadUseCase.ts` | **NEW** — PDF upload pipeline |
| `src/application/usecases/receipt/SnapReceiptUseCase.ts` | Add `lineItems` to `SnapReceiptDTO`; persist in `saveReceipt` |
| `src/infrastructure/ai/LlmReceiptParser.ts` | **NEW** — Groq adapter |
| `src/utils/normalizedReceiptToFormValues.ts` | **NEW** — mapping utility |
| `src/components/receipts/ReceiptForm.tsx` | Add line items section; update `initialValues` typing |
| `src/pages/receipts/SnapReceiptScreen.tsx` | Refactor to three-option menu; wire `ProcessReceiptUploadUseCase` |
| `src/hooks/useSnapReceipt.ts` | Add `processPdfReceipt()` method |
| `src/pages/dashboard/index.tsx` | Pass `LlmReceiptParser` + `MobilePdfConverter` to screen (via props or DI) |

---

## 9. Test Plan (TDD)

All tests written **red-first** before implementation.

### Unit Tests

| File | Cases |
|---|---|
| `__tests__/unit/LlmReceiptParser.test.ts` | happy path, timeout, HTTP error, malformed JSON, missing fields → graceful empty |
| `__tests__/unit/ProcessReceiptUploadUseCase.receipt.test.ts` | PDF path, image path, converter-absent fallback (returns empty) |
| `__tests__/unit/normalizedReceiptToFormValues.test.ts` | full data, empty line items, null fields, currency default |
| `__tests__/unit/ReceiptForm.lineItems.test.tsx` | add item, remove item, auto-total, subtotal sum, backward compat (no items) |
| `__tests__/unit/SnapReceiptUseCase.lineItems.test.ts` | saveReceipt with lineItems serializes to invoices.lineItems JSON |
| `__tests__/unit/SnapReceiptScreen.pdfUpload.test.tsx` | three options visible, Upload PDF triggers file picker, loading state, error fallback |

### Integration Test

| File | Cases |
|---|---|
| `__tests__/integration/SnapReceiptPdfUpload.integration.test.tsx` | Full flow: mock file picker → mock PDF converter → mock OCR → mock LLM → `ReceiptForm` pre-filled with lineItems |

### Regression Guard
- `__tests__/unit/SnapReceiptScreen.camera.test.tsx` — must remain green (existing camera flow unaffected)
- `__tests__/unit/DeterministicReceiptNormalizer.test.ts` — must remain green (no changes)

---

## 10. Open Questions — Resolved

| Question | Resolution |
|---|---|
| Should line items be persisted to a separate table? | **No.** Use existing `invoices.lineItems` JSON text column. No migration. |
| `LlmReceiptParser` — strategy or normalizer replacement? | **Strategy pattern** (`IReceiptParsingStrategy`) for consistency with quotation pipeline. |
| Should camera photo path also extract line items? | **No, out of scope.** `DeterministicReceiptNormalizer` left unchanged. |

---

## 11. Acceptance Criteria

### UI — `SnapReceiptScreen`
- [ ] Three option tiles shown: Snap Photo, Upload PDF, Enter Manually
- [ ] Tapping **Upload PDF** opens native file picker filtered to PDF
- [ ] Loading spinner shown while OCR + LLM runs
- [ ] On success, `ReceiptForm` pre-populated with parsed values including line items
- [ ] On failure, friendly error message shown with "Enter Manually" fallback
- [ ] Existing camera and manual-entry flows are unaffected

### UI — `ReceiptForm`
- [ ] Line Items section renders below Payment Method
- [ ] User can add line items (description, qty, unit price; total auto-calculated)
- [ ] User can remove individual line items
- [ ] When line items present: subtotal = sum of line item totals
- [ ] Total field auto-updates when line items change (can be manually overridden)
- [ ] Works correctly with no line items (backward compatible)

### Application / Infrastructure
- [ ] `NormalizedReceipt` carries `subtotal`, `paymentMethod`, `receiptNumber`, `notes` fields
- [ ] `ProcessReceiptUploadUseCase.execute()` accepts PDF/image, runs OCR + LLM, returns `NormalizedReceipt`
- [ ] `LlmReceiptParser` calls Groq API and parses JSON into `NormalizedReceipt`
- [ ] `normalizedReceiptToFormValues` correctly maps all fields including `lineItems`
- [ ] `SnapReceiptUseCase.saveReceipt` persists `lineItems` as JSON in `invoices.lineItems`

### Tests
- [ ] All new unit tests pass (see §9)
- [ ] Integration test: full PDF → LLM → form pre-fill flow passes
- [ ] All existing receipt/camera tests remain green
- [ ] `npx tsc --noEmit` passes with no new errors

---

## 12. Implementation Order

Following CLAUDE.md TDD workflow:

1. **Interfaces & contracts** — extend `IReceiptNormalizer.ts`, create `IReceiptParsingStrategy.ts`, extend `SnapReceiptUseCase.ts` DTO
2. **Write failing tests** (red) for all items in §9
3. **Implement `LlmReceiptParser`** — make LLM parser unit tests green
4. **Implement `ProcessReceiptUploadUseCase`** — make use case unit tests green
5. **Implement `normalizedReceiptToFormValues`** — make utility unit tests green
6. **Update `SnapReceiptUseCase.saveReceipt`** — make persistence unit tests green
7. **Update `ReceiptForm`** — add line items section, make form unit tests green
8. **Refactor `SnapReceiptScreen`** — three-option menu + PDF upload wiring
9. **Wire in `useSnapReceipt` and `dashboard/index.tsx`**
10. **Integration test** — green
11. **Typecheck** — `npx tsc --noEmit`
12. **PR** referencing issue #208 and this design doc
