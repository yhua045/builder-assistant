# Design: Issue #210 — Phase 3: OCR Upload Screens Refactor

**Date:** 2026-04-21
**Branch:** `issue-210-refactor-observability`
**Author:** Architect agent
**Reviewed by:** mobile-ui agent (see §7 — UI constraints non-negotiable)
**Phase:** 3 of 4 (UI Layer Architecture Audit)

---

## 1. Summary

Three OCR upload screens — `SnapReceiptScreen`, `InvoiceScreen`, and `QuotationScreen` — each
violate Clean Architecture by instantiating infrastructure adapters directly inside the React
component body, building Application-layer Use Cases inline, and managing complex multi-step
state machines alongside JSX rendering.

This document applies the **View-Model Facade Hook** pattern (established in Phase 1 /
`issue-210-dashboard-architecture-refactor.md`) to all three screens.

**No visual changes are planned.** All layout, Tailwind tokens, Modal configuration, animation
behaviour, and test IDs are preserved exactly as-is (see §7).

---

## 2. Audit Findings

### 2.1 `src/pages/receipts/SnapReceiptScreen.tsx`

| Lines | Violation | Category |
|-------|-----------|----------|
| `import { MobileCameraAdapter }` | Infrastructure adapter imported in UI | ❌ Layer breach |
| `import { MobileFilePickerAdapter }` | Infrastructure adapter imported in UI | ❌ Layer breach |
| `import { ICameraAdapter }, { IFilePickerAdapter }` | Infrastructure interfaces in UI Props | ❌ Layer breach |
| `import { IReceiptParsingStrategy }` | Application strategy in UI Props | ❌ Layer breach |
| `import { NormalizedReceipt }, { SnapReceiptDTO }` | Application DTOs in UI | ⚠️ Leaking |
| `const camera = cameraAdapter ?? new MobileCameraAdapter()` | Adapter instantiation in component body | ❌ Layer breach |
| `const filePicker = filePickerAdapter ?? new MobileFilePickerAdapter()` | Adapter instantiation in component body | ❌ Layer breach |
| `handleSnapPhoto / handleUploadPdf` async handlers | Orchestration logic inside View | ❌ Layer breach |
| `view`, `normalizedData`, `formInitialValues`, `isCapturing` state | Multi-step state machine in View | ⚠️ Poor cohesion |

**Note:** A lower-level `useSnapReceipt` hook already exists for OCR operations. The new
`useSnapReceiptScreen` facade will consume it internally — it is not replaced, only hidden from
the UI.

---

### 2.2 `src/pages/invoices/InvoiceScreen.tsx`

| Lines | Violation | Category |
|-------|-----------|----------|
| `import { MobileFilePickerAdapter }` | Infrastructure adapter imported in UI | ❌ Layer breach |
| `import { MobileFileSystemAdapter }` | Infrastructure adapter imported in UI | ❌ Layer breach |
| `import { ProcessInvoiceUploadUseCase }` | Application Use Case imported in UI | ❌ Layer breach |
| `import { IOcrAdapter }, { IInvoiceNormalizer }, { IPdfConverter }` | Application/infra ports in UI Props | ❌ Layer breach |
| `import { NormalizedInvoice }` | Application DTO in UI | ⚠️ Leaking |
| `const filePicker = filePickerAdapter ?? new MobileFilePickerAdapter()` | Adapter instantiation in component body | ❌ Layer breach |
| `const fileSystem = fileSystemAdapter ?? new MobileFileSystemAdapter()` | Adapter instantiation in component body | ❌ Layer breach |
| `buildUseCase()` | Use Case factory method in View | ❌ Layer breach |
| `runProcessingPipeline()` | Orchestration logic in View | ❌ Layer breach |
| `processingStep`, `normalizedResult`, `cachedPdfFile`, `view` state | Multi-step state machine in View | ⚠️ Poor cohesion |

---

### 2.3 `src/pages/quotations/QuotationScreen.tsx`

| Lines | Violation | Category |
|-------|-----------|----------|
| `import { MobileFilePickerAdapter }` | Infrastructure adapter imported in UI | ❌ Layer breach |
| `import { MobileFileSystemAdapter }` | Infrastructure adapter imported in UI | ❌ Layer breach |
| `import { ProcessQuotationUploadUseCase }` | Application Use Case imported in UI | ❌ Layer breach |
| `import { IOcrAdapter }, { IQuotationParsingStrategy }, { IPdfConverter }` | Application/infra ports in UI Props | ❌ Layer breach |
| `const filePicker = filePickerAdapter ?? new MobileFilePickerAdapter()` | Adapter instantiation in component body | ❌ Layer breach |
| `const fileSystem = fileSystemAdapter ?? new MobileFileSystemAdapter()` | Adapter instantiation in component body | ❌ Layer breach |
| `buildUseCase()` | Use Case factory method in View | ❌ Layer breach |
| `runProcessingPipeline()` | Orchestration logic in View | ❌ Layer breach |

---

## 3. Target Architecture

The same View-Model Facade pattern applied to `DashboardScreen` in Phase 1:

```
UI Layer (SnapReceiptScreen / InvoiceScreen / QuotationScreen)
  — "dumb" presentation only —
  └── Hook Layer (useSnapReceiptScreen / useInvoiceUpload / useQuotationUpload)
        — owns state, DI wiring, orchestration —
        ├── Existing data hooks (useSnapReceipt, useInvoices, useQuotations)
        └── Infrastructure (MobileCameraAdapter, MobileFilePickerAdapter,
                           MobileFileSystemAdapter, ProcessXxxUploadUseCase)
```

### Dependency flow

```
UI Layer → consumes ViewModel
  ↓
Hook Layer → orchestrates
  ↓  ↓
Application Layer (Use Cases, normalizers)
  ↓
Infrastructure Layer (Mobile adapters, file system)
```

---

## 4. New Abstractions

### 4.1 `useSnapReceiptScreen`

**File:** `src/hooks/useSnapReceiptScreen.ts`

```typescript
export type SnapReceiptScreenView = 'selecting' | 'capturing' | 'processing' | 'form';

export interface SnapReceiptScreenOptions {
  /** Whether OCR is enabled for photo/PDF capture */
  enableOcr?: boolean;
  /** Pre-supplied image URI — jumps straight to processing */
  imageUri?: string;
  /** LLM parsing strategy — required for PDF upload line item extraction */
  receiptParsingStrategy?: IReceiptParsingStrategy;
  /** Called when the screen should be dismissed */
  onClose: () => void;
  // ── Adapter overrides (for unit testing only) ──────────────────────────
  cameraAdapter?: ICameraAdapter;
  filePickerAdapter?: IFilePickerAdapter;
}

export interface SnapReceiptScreenViewModel {
  // View state machine
  view: SnapReceiptScreenView;
  isCapturing: boolean;
  // OCR / save flags (delegated from useSnapReceipt)
  loading: boolean;
  processing: boolean;
  error: string | null;
  // Populated after successful OCR
  normalizedData: NormalizedReceipt | null;
  formInitialValues: Partial<SnapReceiptDTO> | undefined;
  // Handlers
  handleSnapPhoto: () => Promise<void>;
  handleUploadPdf: () => Promise<void>;
  handleManualEntry: () => void;
  handleSave: (data: SnapReceiptDTO) => Promise<void>;
}

export function useSnapReceiptScreen(options: SnapReceiptScreenOptions): SnapReceiptScreenViewModel;
```

**Screen simplification:**

```typescript
// Before: Props accepts cameraAdapter, filePickerAdapter, receiptParsingStrategy, imageUri, enableOcr
// After: Only presentation concerns remain in Props
interface Props {
  onClose: () => void;
  enableOcr?: boolean;
  imageUri?: string;
  receiptParsingStrategy?: IReceiptParsingStrategy; // passed into hook, not used in JSX
}

export const SnapReceiptScreen = ({ onClose, enableOcr, imageUri, receiptParsingStrategy }: Props) => {
  const vm = useSnapReceiptScreen({ onClose, enableOcr, imageUri, receiptParsingStrategy });
  // All JSX uses vm.view, vm.handleSnapPhoto, vm.formInitialValues, etc.
};
```

The `cameraAdapter` and `filePickerAdapter` props are **removed** from the screen's public
interface. Tests that need adapter injection target `useSnapReceiptScreen` directly.

---

### 4.2 `useInvoiceUpload`

**File:** `src/hooks/useInvoiceUpload.ts`

```typescript
export type InvoiceUploadView = 'upload' | 'form' | 'review' | 'error';
export type InvoiceProcessingStep = 'idle' | 'copying' | 'ocr' | 'normalizing' | 'review' | 'error';

export interface InvoiceUploadOptions {
  onClose: () => void;
  // ── OCR adapter overrides (injected by Dashboard / tests) ──────────────
  ocrAdapter?: IOcrAdapter;
  invoiceNormalizer?: IInvoiceNormalizer;
  pdfConverter?: IPdfConverter;
  // ── File adapter overrides (for unit testing only) ─────────────────────
  filePickerAdapter?: IFilePickerAdapter;
  fileSystemAdapter?: IFileSystemAdapter;
}

export interface InvoiceUploadViewModel {
  // View routing
  view: InvoiceUploadView;
  // Processing state
  processingStep: InvoiceProcessingStep;
  processingError: string | null;
  isProcessing: boolean;
  // Data
  normalizedResult: NormalizedInvoice | null;
  formInitialValues: Partial<Invoice> | undefined;
  formPdfFile: PdfFileMetadata | undefined;
  // Flags from useInvoices
  invoicesLoading: boolean;
  // Handlers
  handleUploadPdf: () => Promise<void>;
  handleAcceptExtraction: (result: NormalizedInvoice) => void;
  handleRetryExtraction: () => Promise<void>;
  handleFallbackToManual: () => void;
  handleFormSave: (data: any) => Promise<void>;
  handleFormCancel: () => void;
}

export function useInvoiceUpload(options: InvoiceUploadOptions): InvoiceUploadViewModel;
```

**Screen simplification:**

```typescript
// Before: Props carries 6 optional adapter props + onNavigateToForm
// After: Only what the screen renders in JSX
interface InvoiceScreenProps {
  onClose: () => void;
  ocrAdapter?: IOcrAdapter;
  invoiceNormalizer?: IInvoiceNormalizer;
  pdfConverter?: IPdfConverter;
}

export const InvoiceScreen = ({ onClose, ocrAdapter, invoiceNormalizer, pdfConverter }: InvoiceScreenProps) => {
  const vm = useInvoiceUpload({ onClose, ocrAdapter, invoiceNormalizer, pdfConverter });
  // ...
};
```

`filePickerAdapter`, `fileSystemAdapter`, `onNavigateToForm` (deprecated) are **removed** from
the screen's public interface.

---

### 4.3 `useQuotationUpload`

**File:** `src/hooks/useQuotationUpload.ts`

```typescript
export type QuotationProcessingStep = 'idle' | 'copying' | 'ocr' | 'error';

export interface QuotationUploadOptions {
  onClose: () => void;
  onSuccess?: (quotation: Quotation) => void;
  // ── OCR adapter overrides (injected by Dashboard / tests) ──────────────
  ocrAdapter?: IOcrAdapter;
  pdfConverter?: IPdfConverter;
  parsingStrategy?: IQuotationParsingStrategy;
  // ── File adapter overrides (for unit testing only) ─────────────────────
  filePickerAdapter?: IFilePickerAdapter;
  fileSystemAdapter?: IFileSystemAdapter;
}

export interface QuotationUploadViewModel {
  // Processing state
  processingStep: QuotationProcessingStep;
  processingError: string | null;
  isProcessing: boolean;
  // Data
  formInitialValues: Partial<Quotation> | undefined;
  formPdfFile: PdfFileMetadata | undefined;
  // Flags from useQuotations
  loading: boolean;
  // Handlers
  handleUploadPdf: () => Promise<void>;
  handleSubmit: (data: Omit<Quotation, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
}

export function useQuotationUpload(options: QuotationUploadOptions): QuotationUploadViewModel;
```

**Screen simplification:**

```typescript
// Before: Props carries 5 optional adapter props
// After: Only what the screen needs for presentation
interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (quotation: Quotation) => void;
  ocrAdapter?: IOcrAdapter;
  pdfConverter?: IPdfConverter;
  parsingStrategy?: IQuotationParsingStrategy;
}

export const QuotationScreen: React.FC<Props> = ({ visible, onClose, onSuccess, ocrAdapter, pdfConverter, parsingStrategy }) => {
  const vm = useQuotationUpload({ onClose, onSuccess, ocrAdapter, pdfConverter, parsingStrategy });
  // ...
};
```

`filePickerAdapter` and `fileSystemAdapter` are **removed** from the screen's public interface.

---

## 5. Imports Removed From Each Screen

### SnapReceiptScreen — removed imports

```typescript
// DELETE:
import { ICameraAdapter } from '../../infrastructure/camera/ICameraAdapter';
import { MobileCameraAdapter } from '../../infrastructure/camera/MobileCameraAdapter';
import { IFilePickerAdapter } from '../../infrastructure/files/IFilePickerAdapter';
import { MobileFilePickerAdapter } from '../../infrastructure/files/MobileFilePickerAdapter';
import { IReceiptParsingStrategy } from '../../application/receipt/IReceiptParsingStrategy';
import { NormalizedReceipt } from '../../application/receipt/IReceiptNormalizer';
import { SnapReceiptDTO } from '../../application/usecases/receipt/SnapReceiptUseCase';
import { normalizedReceiptToFormValues } from '../../utils/normalizedReceiptToFormValues';
// useState, React.useEffect become unused — remove from React import
```

### InvoiceScreen — removed imports

```typescript
// DELETE:
import { IFilePickerAdapter } from '../../infrastructure/files/IFilePickerAdapter';
import { IFileSystemAdapter } from '../../infrastructure/files/IFileSystemAdapter';
import { MobileFilePickerAdapter } from '../../infrastructure/files/MobileFilePickerAdapter';
import { MobileFileSystemAdapter } from '../../infrastructure/files/MobileFileSystemAdapter';
import { ProcessInvoiceUploadUseCase } from '../../application/usecases/invoice/ProcessInvoiceUploadUseCase';
import { IPdfConverter } from '../../infrastructure/files/IPdfConverter';
import { IInvoiceNormalizer, NormalizedInvoice } from '../../application/ai/IInvoiceNormalizer';
import { normalizedInvoiceToFormValues } from '../../utils/normalizedInvoiceToFormValues';
import { useInvoices } from '../../hooks/useInvoices';   // consumed inside hook
import { useState } from 'react';                         // most state moves to hook
```

### QuotationScreen — removed imports

```typescript
// DELETE:
import { IFilePickerAdapter } from '../../infrastructure/files/IFilePickerAdapter';
import { IFileSystemAdapter } from '../../infrastructure/files/IFileSystemAdapter';
import { MobileFilePickerAdapter } from '../../infrastructure/files/MobileFilePickerAdapter';
import { MobileFileSystemAdapter } from '../../infrastructure/files/MobileFileSystemAdapter';
import { ProcessQuotationUploadUseCase } from '../../application/usecases/quotation/ProcessQuotationUploadUseCase';
import { IPdfConverter } from '../../infrastructure/files/IPdfConverter';
import { normalizedQuotationToFormValues } from '../../utils/normalizedQuotationToFormValues';
import { useQuotations } from '../../hooks/useQuotations'; // consumed inside hook
import { useState } from 'react';                           // most state moves to hook
```

---

## 6. File Change Inventory

| File | Change Type | Summary |
|------|-------------|---------|
| `src/hooks/useSnapReceiptScreen.ts` | **New file** | Facade VM wrapping `useSnapReceipt`, camera/file adapter wiring, view state machine |
| `src/hooks/useInvoiceUpload.ts` | **New file** | Facade VM wrapping `useInvoices`, file adapter wiring, `ProcessInvoiceUploadUseCase` orchestration |
| `src/hooks/useQuotationUpload.ts` | **New file** | Facade VM wrapping `useQuotations`, file adapter wiring, `ProcessQuotationUploadUseCase` orchestration |
| `src/pages/receipts/SnapReceiptScreen.tsx` | **Refactor** | Replaces all state/handler logic with `const vm = useSnapReceiptScreen(...)`. Removes infrastructure imports. |
| `src/pages/invoices/InvoiceScreen.tsx` | **Refactor** | Replaces all state/handler/use-case logic with `const vm = useInvoiceUpload(...)`. Removes infrastructure imports. |
| `src/pages/quotations/QuotationScreen.tsx` | **Refactor** | Replaces all state/handler/use-case logic with `const vm = useQuotationUpload(...)`. Removes infrastructure imports. |

---

## 7. UI Design Constraints (mobile-ui agent — NON-NEGOTIABLE)

The following constraints are **strictly preserved** and **must not be altered** during
implementation:

- **`SnapReceiptScreen`**: Three-option selection menu (Snap Photo / Upload PDF / Manual Entry),
  layout, `testID` values (`snap-receipt-close`, `snap-photo-option`), and all Tailwind class
  names are unchanged.
- **`InvoiceScreen`**: Upload-at-top + inline form layout, `ExtractionResultsPanel` review step,
  error state with retry/manual buttons, all `testID` values
  (`upload-pdf-button`, `retry-ocr-button`, `fallback-manual-button`, `invoice-screen`), and all
  Tailwind class names are unchanged.
- **`QuotationScreen`**: Modal with `pageSheet` presentation, header layout, upload Pressable +
  inline `QuotationForm` layout, OCR error banner, all `testID` values
  (`quotation-modal-header`, `quotation-modal-close-button`, `upload-quote-pdf-button`,
  `ocr-error-banner`), and all Tailwind class names are unchanged.
- The `key` prop remount trick on `QuotationForm` (`key={formInitialValues ? 'loaded' : 'empty'}`)
  is **preserved as-is** in the screen component (it is a rendering concern, not moved to the hook).

---

## 8. TDD Acceptance Criteria

### 8.1 `useSnapReceiptScreen` unit tests
**File:** `__tests__/unit/hooks/useSnapReceiptScreen.test.ts`

- [ ] Initial state returns `view: 'selecting'`, `isCapturing: false`, `loading: false`, `normalizedData: null`.
- [ ] When `imageUri` is provided, initial `view` is `'capturing'`.
- [ ] `handleManualEntry()` transitions `view` to `'form'` without triggering OCR.
- [ ] `handleSnapPhoto()` with a mock `ICameraAdapter` that returns `cancelled: true` does not change `view`.
- [ ] `handleSnapPhoto()` with a successful camera result transitions to `'processing'` then `'form'`, and `normalizedData` is populated from the mock OCR result.
- [ ] `handleSnapPhoto()` with a camera error shows `view: 'selecting'` after the error.
- [ ] `handleUploadPdf()` with a mock `IFilePickerAdapter` that returns `cancelled: true` does not change `view`.
- [ ] `handleUploadPdf()` with a successful PDF result transitions through `'processing'` to `'form'`.
- [ ] `handleSave()` on success calls `onClose`.
- [ ] Default `MobileCameraAdapter` and `MobileFilePickerAdapter` are created when no overrides are provided (instantiation does not throw).

### 8.2 `useInvoiceUpload` unit tests
**File:** `__tests__/unit/hooks/useInvoiceUpload.test.ts`

- [ ] Initial state: `view: 'upload'`, `processingStep: 'idle'`, `processingError: null`, `normalizedResult: null`.
- [ ] `handleUploadPdf()` with cancelled picker returns to `processingStep: 'idle'` without state changes.
- [ ] `handleUploadPdf()` with invalid file type/size sets `processingStep: 'idle'` and does not proceed.
- [ ] `handleUploadPdf()` without `ocrAdapter`/`invoiceNormalizer` skips pipeline and transitions to `view: 'form'` directly.
- [ ] `handleUploadPdf()` with full mock adapters transitions: `'idle'` → `'copying'` → `'ocr'` → `view: 'form'`, and `formInitialValues` is populated.
- [ ] `handleRetryExtraction()` with cached PDF re-runs the pipeline successfully.
- [ ] `handleFallbackToManual()` transitions `view` to `'form'` with `formInitialValues: undefined`.
- [ ] `handleFormSave()` on success calls `onClose`.
- [ ] `handleFormSave()` on failure shows `processingStep: 'error'` (or surfaces error via Alert mock).
- [ ] `handleFormCancel()` transitions `view` back to `'upload'`.
- [ ] Default `MobileFilePickerAdapter` and `MobileFileSystemAdapter` are created when no overrides are provided.

### 8.3 `useQuotationUpload` unit tests
**File:** `__tests__/unit/hooks/useQuotationUpload.test.ts`

- [ ] Initial state: `processingStep: 'idle'`, `processingError: null`, `formInitialValues: undefined`.
- [ ] `handleUploadPdf()` with cancelled picker returns to `processingStep: 'idle'`.
- [ ] `handleUploadPdf()` with invalid file shows validation error without entering `'ocr'` step.
- [ ] `handleUploadPdf()` without `ocrAdapter`/`parsingStrategy` skips pipeline; `formPdfFile` is set, `formInitialValues` stays `undefined`.
- [ ] `handleUploadPdf()` with full mock adapters sets `processingStep: 'ocr'` during execution, then resolves to `'idle'` with `formInitialValues` populated.
- [ ] `handleUploadPdf()` pipeline failure sets `processingStep: 'error'` and `processingError` message, and `formPdfFile` is still set (non-blocking).
- [ ] `handleSubmit()` calls `useQuotations.createQuotation` and then `onSuccess` callback and `onClose`.
- [ ] `handleSubmit()` on entity validation error surfaces Alert and does not call `onClose`.
- [ ] Default `MobileFilePickerAdapter` and `MobileFileSystemAdapter` are created when no overrides are provided.

### 8.4 Screen component smoke tests (post-refactor)

**Files:**
- `__tests__/unit/pages/SnapReceiptScreen.test.tsx`
- `__tests__/unit/pages/InvoiceScreen.test.tsx`
- `__tests__/unit/pages/QuotationScreen.test.tsx`

For each screen:
- [ ] Renders correctly when ViewModel returns initial state (mocking the facade hook).
- [ ] Zero `infrastructure/` imports exist in the screen file (static analysis assertion via linting or test).
- [ ] Zero `application/usecases/` imports exist in the screen file.
- [ ] All `testID` values present in current tests still pass.

---

## 9. Implementation Order

1. `useSnapReceiptScreen` + refactor `SnapReceiptScreen` (smallest — no Use Case wiring)
2. `useInvoiceUpload` + refactor `InvoiceScreen` (medium — includes `ProcessInvoiceUploadUseCase` and multi-step view)
3. `useQuotationUpload` + refactor `QuotationScreen` (smallest delta from #2 — similar pattern)
