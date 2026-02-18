# Plan: Issue #79 — Upload Invoice PDF Workflow: Picker → OCR → AI Normalization → Prefill InvoiceForm

**Issue**: [#79](https://github.com/yhua045/builder-assistant/issues/79)  
**Created**: 2026-02-18  
**Status**: Draft — Awaiting Approval  
**Branch**: `issue-79` (worktree: `worktrees/issue-79`)  
**Depends on**: Issue #78 (InvoiceScreen scaffold — ✅ Complete)

---

## Current State (What Issue #78 Delivered)

Issue #78 scaffolded the `InvoiceScreen` modal with two actions:  
1. **Upload Invoice PDF** — file picker, file copy to app storage, passes `PdfFileMetadata` to `InvoiceForm`.  
2. **Manual Entry** — opens `InvoiceForm` with empty state.

Infrastructure already in place:
| Asset | Location | Status |
|-------|----------|--------|
| `InvoiceScreen` | `src/pages/invoices/InvoiceScreen.tsx` | ✅ Complete |
| `IFilePickerAdapter` / `MobileFilePickerAdapter` | `src/infrastructure/files/` | ✅ Complete |
| `IFileSystemAdapter` / `MobileFileSystemAdapter` | `src/infrastructure/files/` | ✅ Complete |
| `fileValidation.ts` | `src/utils/fileValidation.ts` | ✅ Complete |
| `PdfFileMetadata` | `src/types/PdfFileMetadata.ts` | ✅ Complete |
| `InvoiceForm` (accepts `pdfFile?` prop, saves Document+Invoice atomically) | `src/components/invoices/InvoiceForm.tsx` | ✅ Complete |
| `IOcrAdapter` | `src/application/services/IOcrAdapter.ts` | ✅ Complete |
| `MobileOcrAdapter` (ML Kit text recognition) | `src/infrastructure/ocr/MobileOcrAdapter.ts` | ✅ Complete |
| `IInvoiceNormalizer` | `src/application/ai/IInvoiceNormalizer.ts` | ✅ Complete |
| `InvoiceNormalizer` (rules-based) | `src/application/ai/InvoiceNormalizer.ts` | ✅ Complete |
| `InvoiceUploadSection` (image picker UI) | `src/components/invoices/InvoiceUploadSection.tsx` | ✅ Complete (image-only) |
| `ExtractionResultsPanel` | `src/components/invoices/ExtractionResultsPanel.tsx` | ✅ Complete |
| Unit + integration tests for `InvoiceScreen` | `__tests__/unit/InvoiceScreen.test.tsx` | ✅ 11 tests |

### What Is Missing (Gap Analysis)

1. **`ProcessInvoiceUploadUseCase`** — No use case yet that orchestrates: *file → OCR → Normalizer → return `NormalizedInvoice`*. The `InvoiceScreen` currently stops after file copy (passes raw `PdfFileMetadata` to `InvoiceForm`); the OCR + AI normalization leg is not wired.

2. **OCR invocation from `InvoiceScreen`** — The Upload PDF path calls `filePicker` + `copyToAppStorage` but never calls `IOcrAdapter.extractText()`.

3. **Normalizer invocation** — `InvoiceNormalizer` exists but is never called in the upload flow.

4. **Field mapping to `InvoiceForm`** — `NormalizedInvoice` → `initialValues` mapping for `InvoiceForm` does not exist.

5. **Progress + error UX during OCR/AI** — `InvoiceScreen` shows a spinner for the file-copy step only; there is no separate OCR-in-progress state or error retry flow.

6. **`ExtractionResultsPanel` integration** — The component exists (from issue #70) but is never shown in the upload flow.

7. **Dashboard wiring** — "Upload invoice PDF" button on Dashboard opens `InvoiceScreen` but the modal is not yet wired to OCR output.

8. **Tests for the new pipeline** — No tests for `ProcessInvoiceUploadUseCase`, OCR-to-prefill mapping, or failure/retry paths.

---

## User Flow (End-to-End)

```
Dashboard "Upload invoice PDF"
    │
    ▼
InvoiceScreen modal
    │  Tap "Upload Invoice PDF"
    ▼
File picker (PDF + images)
    │  File selected
    ▼
Validate (type, < 20 MB)
    │  Valid
    ▼
Copy file to app private storage  ── already exists ──►  PdfFileMetadata cached
    │
    ▼
ProcessInvoiceUploadUseCase
 ├─ 1. IOcrAdapter.extractText(uri)         [show "Extracting text…" spinner]
 ├─ 2. IInvoiceNormalizer.normalize(...)    [show "Analysing…" spinner]
 └─ 3. Return NormalizedInvoice + DocumentRef
    │
    ▼
ExtractionResultsPanel
 ├─ Display extracted fields + confidence indicators
 ├─ User edits inline (optional)
 ├─ "Accept" → navigate to InvoiceForm with prefilled initialValues
 └─ "Retry" → re-run OCR+AI
    │  (or on any failure → fallback to manual entry)
    ▼
InvoiceForm (prefilled)
    │  User reviews + submits
    ▼
Atomic save: Document + Invoice  ── already implemented in InvoiceForm ──►  DB
```

---

## Proposed Architecture

### New: `ProcessInvoiceUploadUseCase`

**Location**: `src/application/usecases/invoice/ProcessInvoiceUploadUseCase.ts`

```typescript
export interface ProcessInvoiceUploadInput {
  fileUri: string;          // App-private URI (already copied)
  filename: string;
  mimeType: string;
  fileSize: number;
}

export interface ProcessInvoiceUploadOutput {
  normalized: NormalizedInvoice;
  documentRef: {            // Pre-built document metadata for atomic save in InvoiceForm
    localPath: string;
    filename: string;
    size: number;
    mimeType: string;
  };
}

// Steps inside execute():
//  1. ocrAdapter.extractText(fileUri)  → OcrResult
//  2. invoiceParser.parse(ocrResult)   → InvoiceCandidates   [may need a new lightweight parser step]
//  3. normalizer.normalize(candidates, ocrResult) → NormalizedInvoice
//  4. Return { normalized, documentRef }
```

> **Note on parser step**: `IInvoiceNormalizer.normalize()` expects `InvoiceCandidates` (structured), not raw OCR text.  
> We need to add a lightweight **`InvoiceCandidateExtractor`** (or fold into the normalizer) that converts `OcrResult.fullText` → `InvoiceCandidates`.  
> **Option A** — Add `extractCandidates(text: string): InvoiceCandidates` to `IInvoiceNormalizer` interface.  
> **Option B** — Create separate `InvoiceCandidateParser` class.  
> **Recommendation**: Option A (keeps the interface cohesive, avoids a new abstraction for a thin step). See Open Questions.

### Updated `InvoiceScreen` Upload Flow

Extend `InvoiceScreenProps` with adapter injection points for OCR and normalizer:

```typescript
interface InvoiceScreenProps {
  // ... existing
  ocrAdapter?: IOcrAdapter;
  invoiceNormalizer?: IInvoiceNormalizer;
}
```

New state values alongside `isUploading`:
```typescript
const [processingStep, setProcessingStep] = useState<
  'idle' | 'copying' | 'ocr' | 'normalizing' | 'review' | 'error'
>('idle');
const [normalized, setNormalized] = useState<NormalizedInvoice | null>(null);
const [ocrError, setOcrError] = useState<string | null>(null);
```

After copying the file:
1. `setProcessingStep('ocr')` → call `processInvoiceUploadUseCase.execute(...)`
2. On success → `setProcessingStep('review')`, store `normalized` in state, show `ExtractionResultsPanel`
3. On failure → `setProcessingStep('error')`, show retry + manual-entry options

### `NormalizedInvoice` → `InvoiceForm` Initial Values Mapping

New utility: `src/utils/normalizedInvoiceToFormValues.ts`

| `NormalizedInvoice` field | `InvoiceForm` state field |
|---------------------------|--------------------------|
| `vendor` | `vendor` |
| `invoiceNumber` | `invoiceNumber` |
| `invoiceDate` | `dateIssued` |
| `dueDate` | `dateDue` |
| `subtotal` | `subtotal` |
| `tax` | `tax` |
| `total` | `total` |
| `currency` | `currency` |
| `lineItems` | `lineItems` |

### `ExtractionResultsPanel` Integration

The component already exists (`src/components/invoices/ExtractionResultsPanel.tsx`). Wire it inside `InvoiceScreen` when `processingStep === 'review'`:

```
InvoiceScreen renders ExtractionResultsPanel
  ├── onAccept(edited: NormalizedInvoice) → map to InvoiceForm initialValues → onNavigateToForm(...)
  └── onRetry() → re-run ProcessInvoiceUploadUseCase
```

---

## OCR for PDFs vs Images

`MobileOcrAdapter` uses `@react-native-ml-kit/text-recognition` which works on **images only**, not PDFs natively.

**Decision**: For v1 (this issue), support **images** (JPG/PNG) for OCR. For PDFs, offer a graceful fallback:
- If `mimeType === 'application/pdf'` → skip OCR, show `ExtractionResultsPanel` with empty fields + a hint ("PDF text extraction not yet supported — please fill in the details manually").  
- Alternatively use `react-native-pdf` or a cloud OCR service to render the first page as an image. **Deferred to future enhancement**.

This keeps v1 focused and avoids adding a PDF rendering dependency.

---

## Error Handling Strategy

| Stage | Error | UX Response |
|-------|-------|-------------|
| File pick | Cancelled | No-op (return silently) |
| File pick | Permission denied | Alert with "Open Settings" shortcut |
| File validation | Wrong type / too large | Alert + stay on InvoiceScreen |
| File copy | `copyToAppStorage` fails | Alert + allow retry or manual entry |
| OCR | `extractText` throws | Show inline error, "Retry OCR" + "Enter Manually" buttons |
| Normalizer | `normalize` throws | Skip normalizer, open `InvoiceForm` with partial OCR data |
| InvoiceForm submit | `createInvoice` / `documentRepository.save` fails | Existing InvoiceForm error handling |

---

## Migration Notes

No new tables or schema changes needed. Existing `documents` and `invoices` tables already support all required fields. No migration expected.

---

## Files to Create / Modify

### New Files
| File | Purpose |
|------|---------|
| `src/application/usecases/invoice/ProcessInvoiceUploadUseCase.ts` | Orchestrate OCR + Normalize |
| `src/utils/normalizedInvoiceToFormValues.ts` | Map `NormalizedInvoice` → `InvoiceForm` initial values |
| `__tests__/unit/ProcessInvoiceUploadUseCase.test.ts` | Use case unit tests (success, OCR fail, normalization fail) |
| `__tests__/unit/normalizedInvoiceToFormValues.test.ts` | Mapping utility unit tests |

### Modified Files
| File | Change |
|------|--------|
| `src/application/ai/IInvoiceNormalizer.ts` | Add `extractCandidates(text: string): InvoiceCandidates` (Option A) |
| `src/application/ai/InvoiceNormalizer.ts` | Implement `extractCandidates` |
| `src/pages/invoices/InvoiceScreen.tsx` | Add OCR step, processing states, `ExtractionResultsPanel` toggle |
| `src/components/invoices/InvoiceUploadSection.tsx` | *(Optional)* Accept PDF MIME type in addition to images |
| `__tests__/unit/InvoiceScreen.test.tsx` | Add tests for OCR step, error states, retry |
| `__tests__/integration/InvoiceScreen.integration.test.tsx` | Add happy-path OCR+prefill and failure-path tests |

### Reference (No Changes Expected)
- `src/components/invoices/InvoiceForm.tsx` — already accepts `initialValues`; confirm `pdfFile` prop flows correctly
- `src/components/invoices/ExtractionResultsPanel.tsx` — reuse as-is
- `src/infrastructure/ocr/MobileOcrAdapter.ts` — reuse as-is

---

## Implementation Steps (TDD Workflow)

### Step 0 — Design Review (this document) ✅

### Step 1 — Extend `IInvoiceNormalizer` with `extractCandidates`
- [ ] Add `extractCandidates(text: string): InvoiceCandidates` to interface
- [ ] Implement in `InvoiceNormalizer` (move/reuse existing regex parsing logic)
- [ ] Unit tests

### Step 2 — `ProcessInvoiceUploadUseCase` (TDD)
- [ ] Write failing tests first (`OCR success + normalize → returns NormalizedInvoice`, `OCR throws → propagates error`, `normalize throws → propagates error`)
- [ ] Implement use case
- [ ] Inject `IOcrAdapter` + `IInvoiceNormalizer`

### Step 3 — `normalizedInvoiceToFormValues` utility (TDD)
- [ ] Write failing tests for all field mappings (null fields, partial fields)
- [ ] Implement mapping function

### Step 4 — Update `InvoiceScreen` (TDD)
- [ ] Write failing tests for new states (`ocr`, `normalizing`, `review`, `error`)
- [ ] Add `ocrAdapter` + `invoiceNormalizer` props (injectable, default to real adapters)
- [ ] Add `processingStep` state machine
- [ ] Show `ExtractionResultsPanel` in `review` state
- [ ] Wire `onAccept` → map to form values → `onNavigateToForm`
- [ ] Wire `onRetry` → re-invoke use case
- [ ] PDF fallback: if `mimeType === 'application/pdf'` skip OCR, show empty panel

### Step 5 — Integration Tests
- [ ] Image upload → OCR stub → normalize stub → prefill flow
- [ ] OCR failure → error state → retry → success
- [ ] OCR failure → manual entry fallback
- [ ] PDF upload → graceful OCR skip → manual InvoiceForm


### Step 7 — PR & Review
- [ ] Open PR, link to issue #79, reference this design doc

---

## Test Acceptance Criteria

### TC1: Image Upload → OCR → Prefill (Happy Path)
**Given** user selects a JPG invoice image  
**When** file is copied and `ProcessInvoiceUploadUseCase` runs  
**Then** `IOcrAdapter.extractText` is called with the app-storage URI  
**And** `IInvoiceNormalizer.normalize` is called with extracted candidates  
**And** `ExtractionResultsPanel` is shown with the normalized fields  
**And** user taps "Accept" → `InvoiceForm` opens with `initialValues` pre-populated

### TC2: OCR Failure → Retry → Manual Entry
**Given** `IOcrAdapter.extractText` throws  
**When** error is caught inside `InvoiceScreen`  
**Then** `processingStep === 'error'`  
**And** "Retry OCR" and "Enter Manually" buttons are visible  
**When** user taps "Retry" → OCR is re-invoked  
**When** user taps "Enter Manually" → `InvoiceForm` opens empty

### TC3: Normalizer Failure → Partial Prefill
**Given** OCR succeeds but `IInvoiceNormalizer.normalize` throws  
**When** error is caught  
**Then** `InvoiceForm` opens with partial data (only raw OCR text if available) or empty — no crash

### TC4: PDF Upload → OCR Skip → Graceful Fallback
**Given** user selects a PDF file  
**When** file is copied  
**Then** OCR step is skipped (ML Kit does not support PDFs)  
**And** `ExtractionResultsPanel` shown with all empty fields + hint message  
**Or** `InvoiceForm` opens directly in empty state

### TC5: `ProcessInvoiceUploadUseCase` Unit Tests
- Success path returns `{ normalized, documentRef }`
- OCR adapter throws → use case throws with descriptive error
- Normalizer throws → use case throws with descriptive error
- Empty OCR text → use case still calls normalizer (returns low-confidence result)

### TC6: `normalizedInvoiceToFormValues` Unit Tests
- All fields mapped correctly when present
- Null fields left as `undefined` (not empty string) to let form defaults apply
- `lineItems` array correctly converted between domain and form shape

---

## Open Questions

| # | Question | Options | Recommendation |
|---|----------|---------|----------------|
| 1 | Where to add `extractCandidates`: in `IInvoiceNormalizer` or a separate `InvoiceCandidateParser`? **A** extend IInvoiceNormalizer |  — thinner abstraction, single cohesive interface |
| 2 | Should PDF uploads skip OCR entirely (v1), or render PDF→image first? | A) Skip OCR for PDF; B) Add `react-native-pdf` rendering | **A** for v1 — avoids new native dep, deferred to future ticket |
| 3 | Should `ExtractionResultsPanel` appear always (even empty), or only when confidence > threshold? | A) Always show panel; B) Only ≥ 30% confidence | **A** (show always) — gives user the chance to see what was extracted |
| 4 | Store OCR raw text in `Document.metadata`? | A) Store in `documents` metadata; B) Discard after normalization | **A** — useful for debugging and future re-processing; already aligns with existing `LocalDocumentStorageEngine` metadata pattern |

---

## Definition of Done

- [ ] `ProcessInvoiceUploadUseCase` implemented and tested (unit)
- [ ] `normalizedInvoiceToFormValues` utility implemented and tested
- [ ] `InvoiceScreen` updated with OCR step, processing states, `ExtractionResultsPanel`
- [ ] Integration tests cover happy path, OCR failure, retry, PDF fallback
- [ ] `npx tsc --noEmit` passes
- [ ] `npm run lint` 0 errors
- [ ] PR opens referencing issue #79 and this design doc
- [ ] `progress.md` updated

---

## Risk & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| ML Kit OCR does not support PDFs | Medium | Skip OCR for PDFs in v1; show empty `ExtractionResultsPanel` |
| OCR is slow on device (large images) | Medium | Progress spinner per step; user can cancel and fall back to manual entry |
| `InvoiceCandidates` parsing from raw OCR text is noisy | Medium | Already mitigated by `InvoiceNormalizer` confidence scoring |
| `ExtractionResultsPanel` inline edit UI is complex to test | Low | Use `testID` props; test via `fireEvent` in React test renderer |
| Coordinates clash between `InvoiceScreen` upload state and `ExtractionResultsPanel` | Low | Clear `processingStep` state machine — each step is mutually exclusive |
