# Design: Issue #215 — Vision OCR Experiment (Groq Vision Model)

**Date:** 2026-04-29
**Branch:** `issue-215-image-ocr`
**Author:** Architect agent
**Status:** Draft — Pending LGTB

---

## 1. Summary

Add a **compile-time-toggled** second parsing path that bypasses local ML Kit OCR and
sends the raw image directly to Groq's Vision model (`llama-3.2-90b-vision-preview`).

The existing local-OCR → Groq text-model flow is preserved unchanged and remains
the default (`useVisionOcr: false`). Flipping the flag in `featureFlags.ts` switches
all three features (Invoice, Receipt, Quotation) to the vision path.

---

## 2. Motivation

| Path | Tokens consumed | Accuracy hypothesis | On-device compute |
|------|----------------|---------------------|-------------------|
| OCR → text model | Low — text only | Limited by OCR quality | ML Kit runs on device |
| Image → vision model | High — image tokens | Can read layout, tables, logos | None on device |

We want to experiment with quality vs cost trade-offs without permanently committing
to either approach.

---

## 3. Current Parsing Architecture (Baseline)

```
┌──────────────────────────────────────────────────────────────┐
│                   Upload / Camera Capture                    │
│            (useInvoiceUpload / useQuotationUpload / …)       │
└─────────────────────────┬────────────────────────────────────┘
                          │ fileUri
                          ▼
┌──────────────────────────────────────────────────────────────┐
│             Process[X]UploadUseCase                          │
│                                                              │
│  ┌─────────────┐     ┌──────────────┐    ┌──────────────┐   │
│  │ IOcrAdapter │────▶│  OcrResult   │───▶│ IXxxParsing  │   │
│  │ (ML Kit)    │     │ {fullText,   │    │ Strategy     │   │
│  └─────────────┘     │  tokens}     │    │ .parse(ocr)  │   │
│                      └──────────────┘    └──────┬───────┘   │
│                                                 │            │
│                                           NormalizedXxx      │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼  Groq text model (llama-3.3-70b-versatile)
```

---

## 4. Proposed Vision Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                   Upload / Camera Capture                    │
└─────────────────────────┬────────────────────────────────────┘
                          │ fileUri
                          ▼
┌──────────────────────────────────────────────────────────────┐
│             Process[X]UploadUseCase                          │
│                                                              │
│  FeatureFlags.useVisionOcr ─── false ──▶  [existing path]   │
│                          │                                   │
│                         true                                 │
│                          │                                   │
│                          ▼                                   │
│           IXxxVisionParsingStrategy.parse(imageUri)          │
│                    │                                         │
│                    ▼  (internal)                             │
│           IImageReader.readAsBase64(imageUri)                │
│                    │                                         │
│                    ▼  base64 string                          │
│           Groq Vision API (llama-3.2-90b-vision-preview)    │
│                    │                                         │
│                    ▼                                         │
│                NormalizedXxx                                 │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. Scope

### In Scope
- Feature flag `FeatureFlags.useVisionOcr` (compile-time toggle)
- New application port `IImageReader`
- New infrastructure `ReactNativeImageReader` (uses `react-native-fs` already in project)
- New vision strategy interfaces: `IInvoiceVisionParsingStrategy`, `IReceiptVisionParsingStrategy`, `IQuotationVisionParsingStrategy`
- New vision parsers: `LlmVisionInvoiceParser`, `LlmVisionReceiptParser`, `LlmVisionQuotationParser`
- Updated use cases: `ProcessInvoiceUploadUseCase`, `ProcessReceiptUploadUseCase`, `ProcessQuotationUploadUseCase` — accept optional vision strategy
- Updated hooks: `useInvoiceUpload`, `useSnapReceipt`, `useQuotationUpload` — inject vision vs text strategy based on flag
- Unit tests for new parsers and updated use-case routing
- PDF + Vision: first-page-only heuristic (see §9 — Open Questions for V2)
- TypeScript strict-mode compliance throughout

### Out of Scope
- Changing the existing text parsers (`LlmInvoiceParser`, `LlmReceiptParser`, `LlmQuotationParser`)
- UI changes — no new UI surfaces needed (the toggle is in code)
- Per-user or runtime configuration of the flag
- Multi-image Groq Vision calls for multi-page PDFs (deferred to V2)
- Caching base64 strings

---

## 6. Acceptance Criteria

| # | Criterion |
|---|-----------|
| AC1 | With `useVisionOcr: false` (default), behaviour is identical to before this change |
| AC2 | With `useVisionOcr: true`, the OCR adapter is NOT called for image files |
| AC3 | With `useVisionOcr: true`, the image is read as base64 and sent to `llama-3.2-90b-vision-preview` |
| AC4 | Parsed data populates Invoice, Receipt, and Quotation forms in the vision path |
| AC5 | PDF files in the vision path convert page 1 to an image and send that to the vision model |
| AC6 | All existing tests pass unchanged |
| AC7 | New unit tests for each vision parser (happy path + timeout + API error) |
| AC8 | New unit tests for use-case routing (vision strategy injected → OCR skipped) |
| AC9 | `npx tsc --noEmit` passes with zero new errors |

---

## 7. Architectural Decisions

### AD1 — Separate Vision Strategy Interfaces (not extending text interfaces)

**Decision:** Define three new narrow interfaces — `IInvoiceVisionParsingStrategy`,
`IReceiptVisionParsingStrategy`, `IQuotationVisionParsingStrategy` — each with:
```ts
parse(imageUri: string): Promise<NormalizedXxx>
```

**Rationale:** The text and vision strategies have fundamentally different call-sites
(one receives `OcrResult`, the other receives a file URI). Merging them into a
union type on the existing interfaces would pollute the text-path contract and
force the OCR adapter to be optional in places it is currently guaranteed.
Separate interfaces keep each path independently testable and preserve the
Liskov Substitution Principle.

**Files (new):**
- `src/features/invoices/application/IInvoiceVisionParsingStrategy.ts`
- `src/features/receipts/application/IReceiptVisionParsingStrategy.ts`
- `src/features/quotations/application/ai/IQuotationVisionParsingStrategy.ts`

---

### AD2 — `IImageReader` as a dedicated application-layer port

**Decision:** Add a new port `src/application/services/IImageReader.ts`:
```ts
export interface IImageReader {
  /** Returns the raw bytes of the image as a Base64 string (no data-URI prefix). */
  readAsBase64(imageUri: string): Promise<string>;
  /** Returns a MIME type string inferred from the URI extension. */
  getMimeType(imageUri: string): string;
}
```

**Rationale:** Reading a file as base64 is a cross-cutting infrastructure concern,
not specific to the file-system adapter (whose responsibility is copy/delete/exists).
Keeping it as a separate port makes it mockable in unit tests without touching
`IFileSystemAdapter`.

**Files (new):**
- `src/application/services/IImageReader.ts`
- `src/infrastructure/files/ReactNativeImageReader.ts`

The `ReactNativeImageReader` uses `RNFS.readFile(cleanUri, 'base64')`, consistent
with how `MobileFileSystemAdapter` already uses `react-native-fs`.

---

### AD3 — Vision Parsers Own the `IImageReader` Dependency

**Decision:** Each vision parser (`LlmVisionInvoiceParser`, etc.) receives an
`IImageReader` as a constructor dependency and calls it internally inside `parse()`:
```ts
async parse(imageUri: string): Promise<NormalizedInvoice> {
  const base64 = await this.imageReader.readAsBase64(imageUri);
  const mimeType = this.imageReader.getMimeType(imageUri);
  // ... call Groq vision API
}
```

**Rationale:** The Use Case does not need to know about base64 encoding; it only
knows about "call parse with an image URI". This keeps Use Cases thin and lets the
parser be tested with a mock `IImageReader` returning a fixed base64 string.

**Alternative considered:** Have the Use Case call `imageReader.readAsBase64()` and
pass the base64 string to the parser. Rejected — over-couples the Use Case to the
encoding detail and makes the vision-strategy interface carry byte[] semantics that
leak into the application layer.

---

### AD4 — Use Cases Accept Both Strategies; Vision Takes Priority

**Decision:** Each Use Case gains a new optional constructor parameter:
```ts
constructor(
  ...existingParams,
  private readonly parsingStrategy?: IXxxParsingStrategy,      // text (existing)
  private readonly visionStrategy?: IXxxVisionParsingStrategy, // vision (NEW)
)
```

The image execution branch becomes:
```ts
// Vision path (no OCR)
if (this.visionStrategy) {
  const normalized = await this.visionStrategy.parse(localUri);
  return { normalized, documentRef, rawOcrText: '' };
}

// Text OCR path (existing, unchanged)
if (this.parsingStrategy && this.ocrAdapter) {
  const ocrResult = await this.ocrAdapter.extractText(localUri);
  const normalized = await this.parsingStrategy.parse(ocrResult);
  return { normalized, documentRef, rawOcrText: ocrResult.fullText };
}

// Graceful degradation (neither strategy present)
return { normalized: this.emptyNormalizedXxx(), documentRef, rawOcrText: '' };
```

**Rationale:**
- Zero breaking change — existing callers with only `parsingStrategy` continue to work.
- The Use Case itself never reads the feature flag; that decision is made by the hook/factory.
- `rawOcrText` is returned as `''` for the vision path since no intermediate text was produced.

---

### AD5 — Hooks Read the Feature Flag and Inject the Right Strategy

**Decision:** Each hook's `useMemo` that builds the Use Case reads `FeatureFlags.useVisionOcr`
and injects either the text or vision strategy:

```ts
// Pseudo-code shared pattern for all three hooks
const parsingStrategy = useMemo(() =>
  !FeatureFlags.useVisionOcr ? new LlmXxxParser(apiKey) : undefined,
  [apiKey],
);

const visionStrategy = useMemo(() =>
  FeatureFlags.useVisionOcr
    ? new LlmVisionXxxParser(apiKey, new ReactNativeImageReader())
    : undefined,
  [apiKey],
);
```

When `useVisionOcr` is `true`, the `ocrAdapter` is also NOT passed to the Use Case
for image files (saving the ML Kit call). The PDF converter path is unaffected.

**Rationale:** The flag is a constant (`const` object), so dead-code elimination in
release builds can tree-shake the unused branch. Hooks are the natural DI composition
root in this codebase.

---

### AD6 — PDF + Vision: First-Page Heuristic (V1)

**Decision:** For PDFs in the vision path, convert the PDF to images (existing
`IPdfConverter`), then pass only the **first page** URI to the vision strategy.

**Rationale:** Most construction invoices, receipts, and quotations have totals and
header info on page 1. Sending all pages as multiple images in one Groq call is
technically possible with `content: [image_url, image_url, ...]` but adds complexity
and is out of scope for the experiment. V2 can extend to all pages.

---

### AD7 — Groq Vision API Message Format

```jsonc
{
  "model": "llama-3.2-90b-vision-preview",
  "messages": [
    {
      "role": "system",
      "content": "<SYSTEM_PROMPT — same JSON schema as text parser>"
    },
    {
      "role": "user",
      "content": [
        {
          "type": "image_url",
          "image_url": { "url": "data:image/jpeg;base64,<BASE64>" }
        },
        {
          "type": "text",
          "text": "Extract the structured data from this document image."
        }
      ]
    }
  ],
  "temperature": 0,
  "max_tokens": 1024
}
```

The system prompt content and `parseResponse()` helper are identical to those in
the corresponding text parser, so response parsing is fully reusable.

---

### AD8 — `rawOcrText` returned as `''` for Vision Path

**Decision:** `ProcessXxxUploadOutput.rawOcrText` is `''` when the vision path is
used (no OCR step was run).

**Rationale:** `rawOcrText` is stored in `Document.metadata` for debugging. The
vision path has no intermediate text, so an empty string is the honest value.
Future: store the model's raw JSON response string instead.

---

## 8. Layer-by-Layer Changes

### 8.1 Feature Flag

**`src/infrastructure/config/featureFlags.ts`** (MODIFIED)

```ts
export const FeatureFlags = {
  externalLookup: false,
  csvImport: false,
  /**
   * When true, upload/camera flows skip local ML Kit OCR and send the raw
   * image directly to Groq's Vision model (llama-3.2-90b-vision-preview).
   * When false (default), the existing OCR → text-model pipeline is used.
   * Flip to `true` for quality/cost experimentation.
   */
  useVisionOcr: false,
} as const;
```

---

### 8.2 New Port: `IImageReader`

**`src/application/services/IImageReader.ts`** (NEW)

```ts
/**
 * IImageReader — application-layer port for reading image bytes.
 *
 * Implementations must NOT throw for valid image URIs; they should throw a
 * descriptive Error for file-not-found or permission errors.
 */
export interface IImageReader {
  /**
   * Read the image at `imageUri` and return its bytes as a Base64 string.
   * The returned string must NOT include a data-URI prefix (no "data:...;base64,").
   */
  readAsBase64(imageUri: string): Promise<string>;

  /**
   * Infer a MIME type from the URI extension.
   * Returns `'image/jpeg'` when the extension is unrecognised.
   */
  getMimeType(imageUri: string): string;
}
```

---

### 8.3 New Infrastructure: `ReactNativeImageReader`

**`src/infrastructure/files/ReactNativeImageReader.ts`** (NEW)

```ts
import RNFS from 'react-native-fs';
import { IImageReader } from '../../application/services/IImageReader';

export class ReactNativeImageReader implements IImageReader {
  async readAsBase64(imageUri: string): Promise<string> {
    const cleanUri = imageUri.replace(/^file:\/\//, '');
    return RNFS.readFile(cleanUri, 'base64');
  }

  getMimeType(imageUri: string): string {
    const lower = imageUri.toLowerCase();
    if (lower.endsWith('.png'))       return 'image/png';
    if (lower.endsWith('.webp'))      return 'image/webp';
    if (lower.match(/\.(heic|heif)$/)) return 'image/jpeg'; // iOS HEIC re-encoded
    return 'image/jpeg';
  }
}
```

---

### 8.4 New Vision Strategy Interfaces

#### `src/features/invoices/application/IInvoiceVisionParsingStrategy.ts` (NEW)
```ts
import { NormalizedInvoice } from './IInvoiceNormalizer';

export type InvoiceVisionStrategyType = 'llm-vision';

export interface IInvoiceVisionParsingStrategy {
  readonly strategyType: InvoiceVisionStrategyType;
  /** Parse the image at `imageUri` into a structured invoice. */
  parse(imageUri: string): Promise<NormalizedInvoice>;
}
```

#### `src/features/receipts/application/IReceiptVisionParsingStrategy.ts` (NEW)
```ts
import { NormalizedReceipt } from './IReceiptNormalizer';

export type ReceiptVisionStrategyType = 'llm-vision';

export interface IReceiptVisionParsingStrategy {
  readonly strategyType: ReceiptVisionStrategyType;
  parse(imageUri: string): Promise<NormalizedReceipt>;
}
```

#### `src/features/quotations/application/ai/IQuotationVisionParsingStrategy.ts` (NEW)
```ts
import { NormalizedQuotation } from './IQuotationParsingStrategy';

export type QuotationVisionStrategyType = 'llm-vision';

export interface IQuotationVisionParsingStrategy {
  readonly strategyType: QuotationVisionStrategyType;
  parse(imageUri: string): Promise<NormalizedQuotation>;
}
```

---

### 8.5 New Vision Parser Implementations

All three follow an identical pattern. Shown in full for Invoice; Receipt and
Quotation differ only in the system prompt and `parseResponse()` return type.

#### `src/features/invoices/infrastructure/LlmVisionInvoiceParser.ts` (NEW)

```ts
import { IImageReader } from '../../../application/services/IImageReader';
import { IInvoiceVisionParsingStrategy, InvoiceVisionStrategyType }
  from '../application/IInvoiceVisionParsingStrategy';
import { NormalizedInvoice } from '../application/IInvoiceNormalizer';

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';
const VISION_MODEL  = 'llama-3.2-90b-vision-preview';

// System prompt: same JSON schema as LlmInvoiceParser
const SYSTEM_PROMPT = `You are a document parser for a construction project management app.
Extract structured invoice information from the provided image.
Respond ONLY with valid JSON matching this schema:
{ "vendor":string|null, "invoiceNumber":string|null, "invoiceDate":string|null,
  "dueDate":string|null, "subtotal":number|null, "tax":number|null, "total":number|null,
  "currency":string,
  "lineItems":[{"description":string,"quantity":number,"unitPrice":number,"total":number,"tax":number|null}]
}
Do not wrap in markdown. For dates use ISO YYYY-MM-DD. Default currency "AUD".`;

export class LlmVisionInvoiceParser implements IInvoiceVisionParsingStrategy {
  readonly strategyType: InvoiceVisionStrategyType = 'llm-vision';

  constructor(
    private readonly apiKey: string,
    private readonly imageReader: IImageReader,
    private readonly timeoutMs = 60_000,
  ) {}

  async parse(imageUri: string): Promise<NormalizedInvoice> {
    const base64   = await this.imageReader.readAsBase64(imageUri);
    const mimeType = this.imageReader.getMimeType(imageUri);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(GROQ_CHAT_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: VISION_MODEL,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: [
                { type: 'image_url', image_url: { url: `data:${mimeType};base64,${base64}` } },
                { type: 'text', text: 'Extract the structured data from this document image.' },
              ],
            },
          ],
          temperature: 0,
          max_tokens: 1024,
        }),
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`Groq Vision API failed: HTTP ${res.status}`);

      const body    = await res.json();
      const content = body.choices?.[0]?.message?.content ?? '{}';

      try {
        return parseResponse(JSON.parse(content));
      } catch {
        return emptyNormalizedInvoice();
      }
    } catch (err: unknown) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      throw isAbort ? new Error(`Groq Vision timed out after ${this.timeoutMs}ms`) : err;
    } finally {
      clearTimeout(timer);
    }
  }
}

// parseResponse() and emptyNormalizedInvoice() — identical to LlmInvoiceParser
// (shared logic; extract to a module-private helper or a shared util in a follow-up)
```

**`src/features/receipts/infrastructure/LlmVisionReceiptParser.ts`** (NEW) — same pattern.

**`src/features/quotations/infrastructure/ai/LlmVisionQuotationParser.ts`** (NEW) — same pattern.

---

### 8.6 Updated Use Cases

#### `ProcessInvoiceUploadUseCase` (MODIFIED)

Constructor — add `visionStrategy` as last optional param (no position breakage):
```ts
constructor(
  private readonly ocrAdapter?: IOcrAdapter,
  private readonly normalizer?: IInvoiceNormalizer,
  private readonly pdfConverter?: IPdfConverter,
  private readonly fileSystemAdapter?: IFileSystemAdapter,
  private readonly parsingStrategy?: IInvoiceParsingStrategy,
  private readonly visionStrategy?: IInvoiceVisionParsingStrategy, // NEW
)
```

Image execution branch (replace existing strategy block):
```ts
// ── Vision path (skip OCR) ────────────────────────────────────────────────
if (this.visionStrategy) {
  const normalized = await this.visionStrategy.parse(localUri);
  return { normalized, documentRef, rawOcrText: '' };
}

// ── Text OCR path (existing, unchanged) ──────────────────────────────────
if (this.ocrAdapter && this.parsingStrategy) {
  const ocrResult  = await this.ocrAdapter.extractText(localUri);
  const rawOcrText = ocrResult.fullText;
  const normalized = await this.parsingStrategy.parse(ocrResult);
  return { normalized, documentRef, rawOcrText };
}

// ── Legacy normalizer fallback ────────────────────────────────────────────
if (this.ocrAdapter && this.normalizer) {
  const ocrResult  = await this.ocrAdapter.extractText(localUri);
  const candidates = this.normalizer.extractCandidates(ocrResult.fullText);
  const normalized = await this.normalizer.normalize(candidates, ocrResult);
  return { normalized, documentRef, rawOcrText: ocrResult.fullText };
}

return { normalized: this.emptyNormalizedInvoice(), documentRef, rawOcrText: '' };
```

PDF branch — add vision first-page handling before existing PDF block:
```ts
if (mimeType === 'application/pdf') {
  // Vision PDF path: convert → take page 1 → send to vision model
  if (this.visionStrategy && this.pdfConverter) {
    return await this.processPdfVision(localUri, documentRef);
  }
  // Existing text PDF path ...
}

private async processPdfVision(
  pdfUri: string,
  documentRef: DocumentRef,
): Promise<ProcessInvoiceUploadOutput> {
  const pages = await this.pdfConverter!.convertToImages(pdfUri);
  if (pages.length === 0) {
    return { normalized: this.emptyNormalizedInvoice(), documentRef, rawOcrText: '' };
  }
  const firstPageUri = pages[0].uri;
  const normalized = await this.visionStrategy!.parse(firstPageUri);
  return { normalized, documentRef, rawOcrText: '' };
}
```

#### `ProcessReceiptUploadUseCase` (MODIFIED)
Same pattern. Constructor gains `visionStrategy?: IReceiptVisionParsingStrategy`.

#### `ProcessQuotationUploadUseCase` (MODIFIED)
Same pattern. Constructor gains `visionStrategy?: IQuotationVisionParsingStrategy`.

---

### 8.7 Updated Hooks

#### `useInvoiceUpload.ts` (MODIFIED)

`InvoiceUploadOptions` gains one new optional field:
```ts
visionParsingStrategy?: IInvoiceVisionParsingStrategy;
```

The `useMemo` that builds the `ProcessInvoiceUploadUseCase` is updated to pass it.

The **production wiring** that currently constructs `LlmInvoiceParser` (wherever
that lives in the component tree or a factory) should read the flag:
```ts
// Factory helper (in hook or a dedicated factory file)
function buildInvoiceStrategies(apiKey: string) {
  if (FeatureFlags.useVisionOcr) {
    return {
      parsingStrategy: undefined,
      visionStrategy: new LlmVisionInvoiceParser(apiKey, new ReactNativeImageReader()),
    };
  }
  return {
    parsingStrategy: new LlmInvoiceParser(apiKey),
    visionStrategy: undefined,
  };
}
```

#### `useSnapReceipt.ts` (MODIFIED)
`pdfUploadUseCase` construction gains optional `visionStrategy`:
```ts
const pdfUploadUseCase = useMemo(() => {
  if (!receiptParsingStrategy && !receiptVisionStrategy) return null;
  const ocrAdapter = FeatureFlags.useVisionOcr ? undefined : new MobileOcrAdapter();
  return new ProcessReceiptUploadUseCase(
    ocrAdapter!,          // only used in text path
    receiptParsingStrategy,
    new PdfThumbnailConverter(),
    undefined,
    receiptVisionStrategy, // NEW
  );
}, [receiptParsingStrategy, receiptVisionStrategy]);
```

#### `useQuotationUpload.ts` (MODIFIED)
Same pattern as `useInvoiceUpload`.

---

## 9. New File Summary

| File | Type | Description |
|------|------|-------------|
| `src/application/services/IImageReader.ts` | Port | Read image as base64 |
| `src/infrastructure/files/ReactNativeImageReader.ts` | Adapter | RNFS impl of `IImageReader` |
| `src/features/invoices/application/IInvoiceVisionParsingStrategy.ts` | Interface | Vision strategy contract for invoices |
| `src/features/receipts/application/IReceiptVisionParsingStrategy.ts` | Interface | Vision strategy contract for receipts |
| `src/features/quotations/application/ai/IQuotationVisionParsingStrategy.ts` | Interface | Vision strategy contract for quotations |
| `src/features/invoices/infrastructure/LlmVisionInvoiceParser.ts` | Adapter | Calls Groq Vision for invoices |
| `src/features/receipts/infrastructure/LlmVisionReceiptParser.ts` | Adapter | Calls Groq Vision for receipts |
| `src/features/quotations/infrastructure/ai/LlmVisionQuotationParser.ts` | Adapter | Calls Groq Vision for quotations |

---

## 10. Modified File Summary

| File | Change |
|------|--------|
| `src/infrastructure/config/featureFlags.ts` | Add `useVisionOcr: false` |
| `src/features/invoices/application/ProcessInvoiceUploadUseCase.ts` | Accept `visionStrategy`; add vision image + PDF paths |
| `src/features/receipts/application/ProcessReceiptUploadUseCase.ts` | Accept `visionStrategy`; add vision image + PDF paths |
| `src/features/quotations/application/ProcessQuotationUploadUseCase.ts` | Accept `visionStrategy`; add vision image + PDF paths |
| `src/features/invoices/hooks/useInvoiceUpload.ts` | Add `visionParsingStrategy` option; wire from flag |
| `src/features/receipts/hooks/useSnapReceipt.ts` | Add `receiptVisionStrategy` param; wire from flag |
| `src/features/quotations/hooks/useQuotationUpload.ts` | Add `visionParsingStrategy` option; wire from flag |

---

## 11. Test Plan

### 11.1 Unit Tests — Vision Parsers

File: `src/features/invoices/tests/unit/LlmVisionInvoiceParser.test.ts`

| Test | Description |
|------|-------------|
| Happy path | Mock `IImageReader` returns fixed base64; mock `fetch` returns valid JSON; assert `NormalizedInvoice` fields |
| Timeout | Mock `fetch` hangs; assert `AbortError` becomes `'Groq Vision timed out after …'` |
| HTTP error | Mock `fetch` returns HTTP 429; assert error thrown |
| Malformed JSON | `fetch` returns non-JSON content; assert fallback `emptyNormalizedInvoice()` returned |
| MIME type routing | Verify `image_url` in request body contains correct `data:image/png;base64,…` prefix for PNG URIs |

(Identical suites for `LlmVisionReceiptParser` and `LlmVisionQuotationParser`.)

### 11.2 Unit Tests — `ReactNativeImageReader`

File: `src/infrastructure/files/ReactNativeImageReader.test.ts`

| Test | Description |
|------|-------------|
| Reads base64 | Mock `RNFS.readFile` returns `'abc123'`; assert same string returned |
| Strips `file://` prefix | `file:///path/img.jpg` → `RNFS.readFile('/path/img.jpg', 'base64')` |
| MIME inference — `.png` | Returns `'image/png'` |
| MIME inference — `.heic` | Returns `'image/jpeg'` |
| MIME inference — unknown | Returns `'image/jpeg'` |

### 11.3 Unit Tests — Use Case Routing

File: `src/features/invoices/tests/unit/ProcessInvoiceUploadUseCase.vision.test.ts`

| Test | Description |
|------|-------------|
| Vision strategy injected, image file | OCR adapter NOT called; `visionStrategy.parse(imageUri)` called once |
| Vision strategy injected, PDF | PDF converted to images; `visionStrategy.parse(pages[0].uri)` called once |
| Vision strategy absent, text strategy present | OCR adapter IS called; `parsingStrategy.parse(ocrResult)` called |
| Neither strategy | Returns `emptyNormalizedInvoice`, no adapter calls |

(Identical suites for Receipt and Quotation use cases.)

---

## 12. TDD Order of Implementation

Follow red-green-refactor strictly in this order:

1. **`IImageReader`** — define interface (no test needed for pure interface)
2. **`ReactNativeImageReader.test.ts`** — write tests (red)
3. **`ReactNativeImageReader.ts`** — implement (green)
4. **`IInvoiceVisionParsingStrategy.ts`** — define interface
5. **`LlmVisionInvoiceParser.test.ts`** — write tests (red)
6. **`LlmVisionInvoiceParser.ts`** — implement (green)
7. **`ProcessInvoiceUploadUseCase.vision.test.ts`** — write routing tests (red)
8. **`ProcessInvoiceUploadUseCase.ts`** — add vision path (green)
9. Repeat steps 4–8 for Receipt, then Quotation
10. **`featureFlags.ts`** — add `useVisionOcr: false`
11. **Hook wiring** — update three hooks with flag-driven injection
12. Run `npx tsc --noEmit` and full test suite; fix any issues

---

## 13. Open Questions

| # | Question | Impact |
|---|----------|--------|
| OQ1 | Should multi-page PDFs send all page images to vision (one call with multiple images) or process page 1 only? | Affects `processPdfVision()` implementation; V1 is page-1 only |
| OQ2 | Is `llama-3.2-90b-vision-preview` still the recommended Groq vision model, or has it been superseded? | Model name constant only; easy to change |
| OQ3 | Should we store the raw vision response (model JSON string) in `rawOcrText` for debugging? | Minimal change; useful for support triage |
| OQ4 | Is there a Groq image size limit we need to validate against before sending? | Would require adding a file-size check in the vision parser |
| OQ5 | Should `useVisionOcr` be promoted to a per-user runtime setting in a future release? | Out of scope for this experiment; flag stays compile-time |

---

## 14. Risk Register

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Groq Vision accuracy < text OCR accuracy | Medium | Flag lets us revert instantly |
| Large images exceed Groq request size limit | Low | Validate `fileSize` against ~20MB limit before encoding |
| Base64 encoding of large images causes OOM on low-memory devices | Low | ReactNative JS heap; monitor in testing; resize if needed |
| PDF page 1 misses critical data on later pages | Medium | Document the V1 limitation; V2 sends all pages |
| `llama-3.2-90b-vision-preview` model availability on Groq | Low | Fallback: flip flag to `false` |
