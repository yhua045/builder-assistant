# #215 — Document Processor Abstraction: UseCase Refactor

**Date:** 2026-04-29
**Branch:** `issue-215-image-ocr`
**Author:** architect mode

---

## 1. Problem Statement

All three upload Use Cases (`ProcessInvoiceUploadUseCase`, `ProcessReceiptUploadUseCase`, `ProcessQuotationUploadUseCase`) act as **God classes** that branch internally on `mimeType` and on the presence of optional adapters to decide whether to take the Vision or Text-OCR path:

```
execute()
  └─ if mimeType === 'application/pdf'
        └─ if visionStrategy && pdfConverter  → processPdfVision()
        └─ else if ocrAdapter && pdfConverter → processPdf()
        └─ else                               → empty result
  └─ else (image)
        └─ if visionStrategy                  → visionStrategy.parse()
        └─ else if ocrAdapter                 → ocrAdapter.extractText()
        └─ else                               → empty result
```

**Consequences:**
- The Use Case constructor takes 5–6 optional parameters; callers must know the magic combination.
- mimeType branching and strategy selection are not independently testable.
- Adding a new processing strategy (e.g., on-device ML) requires forking every Use Case.
- Hooks' `buildUseCase()` functions are implicitly load-bearing — the wrong combination silently degrades.

---

## 2. Solution Overview

Introduce a **`I[Domain]DocumentProcessor`** port in the application layer. Each processor fully encapsulates the PDF/image routing and OCR or vision strategy. The Use Case is reduced to **validation + file IO + delegation**:

```
Hook
  └─ decides: TextBased vs VisionBased (FeatureFlags.useVisionOcr)
  └─ constructs: processor = new VisionBasedInvoiceProcessor(...)
  └─ constructs: useCase  = new ProcessInvoiceUploadUseCase(fileSystem, processor)
  └─ calls: useCase.execute(input)

ProcessInvoiceUploadUseCase.execute()
  1. validatePdfFile(mimeType, fileSize)        ← unchanged
  2. fileSystem.copyToAppStorage(...)           ← unchanged
  3. processor.process(localUri, mimeType)      ← NEW: single delegation call
  4. return { normalized, documentRef, rawOcrText }
```

---

## 3. Interface Definitions

All interfaces live in the **application layer** of their respective feature.

### 3.1 Invoice

**Path:** `src/features/invoices/application/IInvoiceDocumentProcessor.ts`

```typescript
import { NormalizedInvoice } from './IInvoiceNormalizer';

export interface InvoiceProcessorResult {
  normalized: NormalizedInvoice;
  rawOcrText: string;
}

export interface IInvoiceDocumentProcessor {
  /**
   * Given the local URI of a validated, copied file and its mimeType,
   * perform all OCR / vision steps and return a structured result.
   * Throws on processing error; returns empty result on graceful degradation.
   */
  process(localUri: string, mimeType: string): Promise<InvoiceProcessorResult>;
}
```

### 3.2 Receipt

**Path:** `src/features/receipts/application/IReceiptDocumentProcessor.ts`

```typescript
import { NormalizedReceipt } from './IReceiptNormalizer';

export interface ReceiptProcessorResult {
  normalized: NormalizedReceipt;
  rawOcrText: string;
}

export interface IReceiptDocumentProcessor {
  process(localUri: string, mimeType: string): Promise<ReceiptProcessorResult>;
}
```

### 3.3 Quotation

**Path:** `src/features/quotations/application/IQuotationDocumentProcessor.ts`

```typescript
import { NormalizedQuotation } from './ai/IQuotationParsingStrategy';

export interface QuotationProcessorResult {
  normalized: NormalizedQuotation;
  rawOcrText: string;
}

export interface IQuotationDocumentProcessor {
  process(localUri: string, mimeType: string): Promise<QuotationProcessorResult>;
}
```

---

## 4. Implementation Specifications

All implementations live in the **infrastructure layer** of their feature, under `infrastructure/processors/`.

### 4.1 TextBasedInvoiceProcessor

**Path:** `src/features/invoices/infrastructure/processors/TextBasedInvoiceProcessor.ts`

**Dependencies:**
| Param | Type | Required | Notes |
|---|---|---|---|
| `ocrAdapter` | `IOcrAdapter` | ✅ | Single-image text extraction |
| `pdfConverter` | `IPdfConverter` | ✅ | PDF → images |
| `parsingStrategy` | `IInvoiceParsingStrategy` | ✅ | LLM parsing from OcrResult |
| `normalizer` | `IInvoiceNormalizer` | ⬜ optional | Legacy fallback when `parsingStrategy` absent |

**Behaviour:**
- `mimeType === 'application/pdf'` → `pdfConverter.convertToImages()` → `OcrDocumentService.extractFromPages()` → `parsingStrategy.parse()` (or `normalizer.normalize()` as fallback)
- otherwise (image) → `ocrAdapter.extractText()` → `parsingStrategy.parse()` (or `normalizer.normalize()`)
- Returns `{ normalized, rawOcrText }` — never returns empty by accident; delegates the "no parseable content" responsibility to the strategy.

**Constructor:**
```typescript
constructor(
  private readonly ocrAdapter: IOcrAdapter,
  private readonly pdfConverter: IPdfConverter,
  private readonly parsingStrategy: IInvoiceParsingStrategy,
  private readonly normalizer?: IInvoiceNormalizer,  // legacy fallback only
)
```

---

### 4.2 VisionBasedInvoiceProcessor

**Path:** `src/features/invoices/infrastructure/processors/VisionBasedInvoiceProcessor.ts`

**Dependencies:**
| Param | Type | Required | Notes |
|---|---|---|---|
| `visionStrategy` | `IInvoiceVisionParsingStrategy` | ✅ | Accepts an image URI |
| `pdfConverter` | `IPdfConverter` | ✅ | Required to convert PDF page 1 → image URI |

**Behaviour:**
- `mimeType === 'application/pdf'` → `pdfConverter.convertToImages()` → take `pages[0].uri` → `visionStrategy.parse(page1Uri)`
- otherwise (image) → `visionStrategy.parse(localUri)` directly
- `rawOcrText` is always `''` (vision model returns structured JSON, not OCR text)
- Empty PDF (zero pages) → returns `emptyNormalizedInvoice()` with `rawOcrText: ''`

**Constructor:**
```typescript
constructor(
  private readonly visionStrategy: IInvoiceVisionParsingStrategy,
  private readonly pdfConverter: IPdfConverter,
)
```

---

### 4.3 TextBasedReceiptProcessor

**Path:** `src/features/receipts/infrastructure/processors/TextBasedReceiptProcessor.ts`

**Dependencies:**
| Param | Type | Required | Notes |
|---|---|---|---|
| `ocrAdapter` | `IOcrAdapter` | ✅ | |
| `pdfConverter` | `IPdfConverter` | ✅ | |
| `parsingStrategy` | `IReceiptParsingStrategy` | ✅ | |

**Behaviour:** mirrors `TextBasedInvoiceProcessor` for Receipt types.

**Constructor:**
```typescript
constructor(
  private readonly ocrAdapter: IOcrAdapter,
  private readonly pdfConverter: IPdfConverter,
  private readonly parsingStrategy: IReceiptParsingStrategy,
)
```

---

### 4.4 VisionBasedReceiptProcessor

**Path:** `src/features/receipts/infrastructure/processors/VisionBasedReceiptProcessor.ts`

**Dependencies:**
| Param | Type | Required | Notes |
|---|---|---|---|
| `visionStrategy` | `IReceiptVisionParsingStrategy` | ✅ | |
| `pdfConverter` | `IPdfConverter` | ✅ | |

**Constructor:**
```typescript
constructor(
  private readonly visionStrategy: IReceiptVisionParsingStrategy,
  private readonly pdfConverter: IPdfConverter,
)
```

---

### 4.5 TextBasedQuotationProcessor

**Path:** `src/features/quotations/infrastructure/processors/TextBasedQuotationProcessor.ts`

**Dependencies:**
| Param | Type | Required | Notes |
|---|---|---|---|
| `ocrAdapter` | `IOcrAdapter` | ✅ | |
| `pdfConverter` | `IPdfConverter` | ✅ | |
| `parsingStrategy` | `IQuotationParsingStrategy` | ✅ | |

**Constructor:**
```typescript
constructor(
  private readonly ocrAdapter: IOcrAdapter,
  private readonly pdfConverter: IPdfConverter,
  private readonly parsingStrategy: IQuotationParsingStrategy,
)
```

---

### 4.6 VisionBasedQuotationProcessor

**Path:** `src/features/quotations/infrastructure/processors/VisionBasedQuotationProcessor.ts`

**Dependencies:**
| Param | Type | Required | Notes |
|---|---|---|---|
| `visionStrategy` | `IQuotationVisionParsingStrategy` | ✅ | |
| `pdfConverter` | `IPdfConverter` | ✅ | |

**Constructor:**
```typescript
constructor(
  private readonly visionStrategy: IQuotationVisionParsingStrategy,
  private readonly pdfConverter: IPdfConverter,
)
```

---

## 5. Simplified Use Case Signatures

### 5.1 ProcessInvoiceUploadUseCase (after)

```typescript
export class ProcessInvoiceUploadUseCase {
  constructor(
    private readonly fileSystemAdapter: IFileSystemAdapter,
    private readonly processor: IInvoiceDocumentProcessor,
  ) {}

  async execute(input: ProcessInvoiceUploadInput): Promise<ProcessInvoiceUploadOutput> {
    const { fileUri, filename, mimeType, fileSize } = input;

    // 1. Validate
    const validation = validatePdfFile(mimeType, fileSize);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.error ?? 'Invalid file'}`);
    }

    // 2. Copy to app-private storage
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).slice(2, 8);
    const destFilename = `invoice_${timestamp}_${randomSuffix}.pdf`;
    const localUri = await this.fileSystemAdapter.copyToAppStorage(fileUri, destFilename);

    const documentRef: DocumentRef = { localPath: localUri, filename, size: fileSize, mimeType };

    // 3. Delegate all processing
    const { normalized, rawOcrText } = await this.processor.process(localUri, mimeType);

    return { normalized, documentRef, rawOcrText };
  }
}
```

> **Key simplification:** constructor drops from 6 optional params → 2 required params.
> All mimeType branching, strategy selection, and graceful degradation live in the processor.

### 5.2 ProcessReceiptUploadUseCase (after)

The Receipt Use Case currently has **no** `IFileSystemAdapter` (receipts are not copied to private storage). The simplified form:

```typescript
export class ProcessReceiptUploadUseCase {
  constructor(
    private readonly processor: IReceiptDocumentProcessor,
  ) {}

  async execute(input: ProcessReceiptUploadInput): Promise<ProcessReceiptUploadOutput> {
    const { fileUri, mimeType, fileSize } = input;

    const validation = validatePdfFile(mimeType, fileSize);
    if (!validation.isValid) {
      throw new Error(`Validation failed: ${validation.error ?? 'Invalid file'}`);
    }

    return this.processor.process(fileUri, mimeType);
  }
}
```

> If receipt file-copying is desired in the future, `IFileSystemAdapter` can be added to this Use Case independently without modifying the processor.

### 5.3 ProcessQuotationUploadUseCase (after)

Same pattern as Invoice (Quotations _are_ copied to private storage):

```typescript
export class ProcessQuotationUploadUseCase {
  constructor(
    private readonly fileSystemAdapter: IFileSystemAdapter,
    private readonly processor: IQuotationDocumentProcessor,
  ) {}

  async execute(input: ProcessQuotationUploadInput): Promise<ProcessQuotationUploadOutput> {
    // Validate → Copy → processor.process() → return
  }
}
```

---

## 6. Hook Wiring Pattern

The hooks are the **only place** where `FeatureFlags.useVisionOcr` is consulted. They construct the right processor and inject it into the Use Case.

### 6.1 useInvoiceUpload (after)

```typescript
// Remove: buildUseCase() with 6-param conditional
// Add:
const buildProcessor = (): IInvoiceDocumentProcessor => {
  if (FeatureFlags.useVisionOcr && GROQ_API_KEY && pdfConverter) {
    return new VisionBasedInvoiceProcessor(
      new LlmVisionInvoiceParser(GROQ_API_KEY, new ReactNativeImageReader()),
      pdfConverter,
    );
  }
  // Text path: ocrAdapter, pdfConverter, and parsingStrategy must all be provided
  // by the consumer (Dashboard) or come from hook defaults.
  return new TextBasedInvoiceProcessor(
    ocrAdapter!,
    pdfConverter!,
    parsingStrategy!,
    invoiceNormalizer,   // legacy fallback, optional
  );
};

const buildUseCase = (): ProcessInvoiceUploadUseCase =>
  new ProcessInvoiceUploadUseCase(fileSystem, buildProcessor());
```

> `buildProcessor` can throw early if required adapters are missing, surfacing
> configuration errors at hook instantiation time rather than silently degrading
> mid-pipeline.

### 6.2 useQuotationUpload (after)

```typescript
const buildProcessor = (): IQuotationDocumentProcessor => {
  if (FeatureFlags.useVisionOcr && GROQ_API_KEY && pdfConverter) {
    return new VisionBasedQuotationProcessor(
      new LlmVisionQuotationParser(GROQ_API_KEY, new ReactNativeImageReader()),
      pdfConverter,
    );
  }
  return new TextBasedQuotationProcessor(ocrAdapter!, pdfConverter!, parsingStrategy!);
};
```

### 6.3 useSnapReceipt (after)

```typescript
const buildProcessor = (): IReceiptDocumentProcessor => {
  if (FeatureFlags.useVisionOcr && GROQ_API_KEY && pdfConverter) {
    return new VisionBasedReceiptProcessor(
      new LlmVisionReceiptParser(GROQ_API_KEY, new ReactNativeImageReader()),
      pdfConverter,
    );
  }
  return new TextBasedReceiptProcessor(ocrAdapter!, pdfConverter!, parsingStrategy!);
};
```

---

## 7. File Layout

```
src/features/invoices/
  application/
    IInvoiceDocumentProcessor.ts       ← NEW (interface + ProcessorResult type)
    ProcessInvoiceUploadUseCase.ts     ← MODIFIED (simplified)
    IInvoiceParsingStrategy.ts         ← unchanged
    IInvoiceVisionParsingStrategy.ts   ← unchanged
  infrastructure/
    processors/
      TextBasedInvoiceProcessor.ts     ← NEW
      VisionBasedInvoiceProcessor.ts   ← NEW
    LlmInvoiceParser.ts                ← unchanged
    LlmVisionInvoiceParser.ts          ← unchanged

src/features/receipts/
  application/
    IReceiptDocumentProcessor.ts       ← NEW
    ProcessReceiptUploadUseCase.ts     ← MODIFIED (simplified)
  infrastructure/
    processors/
      TextBasedReceiptProcessor.ts     ← NEW
      VisionBasedReceiptProcessor.ts   ← NEW

src/features/quotations/
  application/
    IQuotationDocumentProcessor.ts     ← NEW
    ProcessQuotationUploadUseCase.ts   ← MODIFIED (simplified)
  infrastructure/
    processors/
      TextBasedQuotationProcessor.ts   ← NEW
      VisionBasedQuotationProcessor.ts ← NEW

```

---

## 8. TDD Test Plan

### 8.1 Processor unit tests

Each processor gets a dedicated unit test file. Mocks: all deps are jest mocks.

**`TextBasedInvoiceProcessor.test.ts`**
| Scenario | Assert |
|---|---|
| Image file → calls `ocrAdapter.extractText(uri)` → calls `parsingStrategy.parse()` → returns result | ✅ |
| PDF file → calls `pdfConverter.convertToImages()` → calls `OcrDocumentService.extractFromPages()` → returns result | ✅ |
| PDF with 0 pages → returns `emptyNormalizedInvoice()` with `rawOcrText: ''` | ✅ |
| `parsingStrategy` absent, `normalizer` present → falls back to `normalizer.normalize()` | ✅ |
| `parsingStrategy.parse()` throws → error propagates (no swallowing) | ✅ |

**`VisionBasedInvoiceProcessor.test.ts`**
| Scenario | Assert |
|---|---|
| Image file → calls `visionStrategy.parse(uri)` directly, no PDF converter used | ✅ |
| PDF file → calls `pdfConverter.convertToImages()` → passes `pages[0].uri` to `visionStrategy.parse()` | ✅ |
| PDF with 0 pages → returns empty result | ✅ |
| `rawOcrText` is always `''` | ✅ |
| `visionStrategy.parse()` throws → error propagates | ✅ |

Same matrix applies for Receipt and Quotation processors.

### 8.2 Use Case unit tests

**`ProcessInvoiceUploadUseCase.test.ts`** (after refactor)
| Scenario | Assert |
|---|---|
| Invalid mimeType → throws `Validation failed:` | ✅ |
| Valid file → calls `fileSystemAdapter.copyToAppStorage()` | ✅ |
| Valid file → calls `processor.process(localUri, mimeType)` | ✅ |
| Returns `documentRef` with `localPath = copyToAppStorage result` | ✅ |
| `processor.process()` throws → error propagates | ✅ |
| Does NOT branch on mimeType (no `if pdf` logic here) | ✅ |

> The Use Case tests no longer need to mock `ocrAdapter`, `visionStrategy`, etc.
> They only mock `IFileSystemAdapter` and `IInvoiceDocumentProcessor`.

### 8.3 Hook tests

**`useInvoiceUpload.test.ts`**
| Scenario | Assert |
|---|---|
| `FeatureFlags.useVisionOcr = true` + `GROQ_API_KEY` → `buildProcessor()` returns `VisionBasedInvoiceProcessor` | ✅ |
| `FeatureFlags.useVisionOcr = false` → `buildProcessor()` returns `TextBasedInvoiceProcessor` | ✅ |
| Hook injects built processor into Use Case | ✅ |

---

## 9. Acceptance Criteria

- [ ] All 6 processor implementations exist and pass their unit tests
- [ ] All 3 Use Cases simplified: no internal mimeType branching, no optional strategy fields
- [ ] All 3 hooks use `buildProcessor()` to select the right implementation
- [ ] Existing integration tests pass without modification (inputs/outputs unchanged)
- [ ] `npx tsc --noEmit` passes
- [ ] `npm test` green

---

## 10. Migration Notes

### Backward compatibility
- The `ProcessInvoiceUploadInput` / `Output` types are **unchanged** — callers are unaffected.
- `DocumentRef` and `QuotationDocumentRef` types are **unchanged**.
- `NormalizedInvoice` / `NormalizedReceipt` / `NormalizedQuotation` are **unchanged**.

### Breaking changes (internal)
- `ProcessInvoiceUploadUseCase` constructor signature changes from 6 optional params → 2 required. All callers are the hooks (3 files).
- `ProcessReceiptUploadUseCase` constructor changes from 4+ params → 1 required (`IReceiptDocumentProcessor`). Callers: `useSnapReceipt`.
- `ProcessQuotationUploadUseCase` constructor changes from 5 params → 2 required. Callers: `useQuotationUpload`.

### Phasing
1. **Phase A** — Add interfaces + implementations (no Use Case changes yet, all tests green)
2. **Phase B** — Refactor Use Cases to delegate to processor, update hooks, update tests
3. **Phase C** — Delete dead code (old private helper methods `processPdf`, `processPdfVision`, `emptyNormalized*` from Use Cases)

> `SnapReceiptUseCase` also wraps OCR logic. It is **out of scope** for this ticket but should be migrated to `IReceiptDocumentProcessor` in a follow-up.

---

## 11. Open Questions

- **Graceful degradation strategy:** Currently Use Cases return an empty result when adapters are missing. After refactor, the hook is responsible for ensuring a processor is always provided. Do we want a `NoOpInvoiceProcessor` (returns empty result) for cases where OCR is not configured, or do we gate the upload UI on adapter availability? → **Recommendation:** Gate at hook level with an explicit guard; remove silent empty-result paths.
- **`SnapReceiptUseCase`:** Should it be refactored in the same PR or a follow-up? → Suggest follow-up to keep this PR focused.
- **`OcrDocumentService` ownership:** Currently the processors will construct their own `OcrDocumentService` internally from `IOcrAdapter`. Should it be injected instead? → Inject for testability; add as constructor param with a default.
