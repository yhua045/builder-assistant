# Design: Quotation OCR Enhancement — Extract More Details

**Date:** 2026-04-20  
**Status:** Draft — awaiting approval  
**Related:** Issue #186 (original Add Quote screen)

---

## 1. Problem Statement

The current quotation OCR pipeline extracts a **limited set of fields** from uploaded PDF quotation documents. Key information that commonly appears on construction quotation documents — such as vendor contact details, payment terms, scope of work, and validity period — is **not extracted**, forcing the user to manually enter them. This design proposes enhancements to extract richer details automatically.

Additionally, the current pipeline hardcodes a single regex-based extraction approach. We need an abstraction that allows the app to switch between a lightweight regex parser and a more advanced LLM-based parser at runtime, based on configuration.

---

## 2. Current OCR Output — What Is Extracted Today

The OCR pipeline reuses `InvoiceNormalizer` (rules-based, regex-only — no LLM). The current `NormalizedInvoice` interface outputs:

| Field | Type | Extraction Method | Quality |
|-------|------|-------------------|---------|
| `vendor` | `string \| null` | First 1–5 non-empty lines (heuristic) | Fair — picks longest name, removes legal suffixes |
| `invoiceNumber` | `string \| null` | Regex: `invoice #`, `INV-`, `#` patterns | Fair — generic invoice patterns; not quotation-specific |
| `invoiceDate` | `Date \| null` | Regex: MM/DD/YYYY, YYYY-MM-DD, "Month DD YYYY" | OK — limited to 4 date formats |
| `dueDate` | `Date \| null` | Keyword: `due date/by/on` near a date | OK |
| `subtotal` | `number \| null` | Keyword: `subtotal` near dollar amount | OK |
| `tax` | `number \| null` | Keywords: `tax`, `gst`, `vat`, `hst` near dollar amount | OK |
| `total` | `number \| null` | Keywords: `total`, `amount due`, `balance due`, standalone `$` amounts | Good |
| `currency` | `string` | Symbol detection: `$`, `€`, `£`, `¥` + keyword (USD, EUR, etc.) | OK — defaults to USD |
| `lineItems[]` | `Array` | Single regex: `description qty x $unitPrice = $total` | **Poor** — only matches one strict pattern |
| `confidence` | `object` | Weighted scoring (vendor 0.3, number 0.2, date 0.2, total 0.3) | Internal |
| `suggestedCorrections` | `string[]` | Based on confidence thresholds | Internal |

### What is mapped to the Quotation form (`normalizedInvoiceToQuotationFormValues`):

| NormalizedInvoice field | → Quotation form field |
|-------------------------|------------------------|
| `vendor` | `vendorName` |
| `invoiceNumber` | `reference` |
| `invoiceDate` | `date` |
| `dueDate` | `expiryDate` |
| `total` | `total` |
| `currency` | `currency` |
| `lineItems[]` | `lineItems[]` |

### Fields in Quotation form **NOT populated by OCR today**:

| Quotation Form Field | Domain Field | Status |
|----------------------|--------------|--------|
| Vendor Email | `vendorEmail` | **Not extracted** — exists in form, always blank after OCR |
| Vendor Address | `vendorAddress` | **Not extracted** — exists in form, always blank after OCR |
| Subtotal | `subtotal` | Extracted but **not mapped** to form (computed from line items only) |
| Tax Total | `taxTotal` | Extracted but **not mapped** to form |
| Notes | `notes` | **Not extracted** — no payment terms / scope parsing |
| Project | `projectId` | N/A (user selection, not in document) |
| Task | `taskId` | N/A (user selection, not in document) |

---

## 3. Gap Analysis — What Construction Quotations Typically Contain

A typical construction quotation PDF includes fields that the current OCR does **not** attempt to extract:

### 3.1 Vendor Contact Details
- **Company name** ✅ (extracted as `vendor`)
- **ABN / ACN / Tax ID** ❌ not extracted
- **Street address** ❌ not extracted — `vendorAddress` field exists in data model
- **Email** ❌ not extracted — `vendorEmail` field exists in data model
- **Phone number** ❌ not extracted — `vendorPhone` exists in `ResolvedVendorDetails` but not in extraction

### 3.2 Quotation-Specific References
- **Quote number** (e.g., `QUO-001`, `Quote #`, `Quotation No.`, `Ref:`) ❌ current regex only matches **invoice** patterns (`INV-`, `Invoice #`)
- **Validity / Expiry** (e.g., "Valid for 30 days", "Expires: 15 May 2026") ❌ `dueDate` regex looks for "due" keyword only, not "valid for" / "expires"

### 3.3 Line Item Details
- Current line item regex is **extremely rigid**: `description qty x $unitPrice = $total`
- Real quotation PDFs use varied layouts:
  - Tabular: `| Description | Qty | Unit | Rate | Amount |`
  - Simple: `Bathroom tiling .............. $4,500.00`
  - With units: `15 m² @ $85/m² = $1,275.00`
  - Multi-line descriptions

### 3.4 Terms & Conditions
- **Payment terms** (e.g., "50% deposit, 50% on completion", "Net 30")
- **Scope of work** / description paragraphs
- **Warranty** information
- **Exclusions** (what's NOT included)

---

## 4. Architecture — Strategy Pattern for Parsing

### 4.1 Design Goals

1. **Separate `QuotationNormalizer`** — quotation extraction logic lives in its own class, independent of `InvoiceNormalizer`.
2. **Swappable strategies** — a strategy pattern abstraction allows the app to use either the regex-based parser or a future LLM-based parser.
3. **Runtime switching** — the active strategy is selected via a configuration value, allowing it to change without code changes (e.g., feature flag, app config).

### 4.2 New Interface — `IQuotationParsingStrategy`

This is the core abstraction. Both the regex-based and LLM-based parsers implement this single interface. The output is a new `NormalizedQuotation` type (quotation-specific, not reusing `NormalizedInvoice`).

```typescript
// src/application/ai/IQuotationParsingStrategy.ts

import { OcrResult } from '../services/IOcrAdapter';

/** Unified output from any quotation parsing strategy */
export interface NormalizedQuotation {
  // ── Identity ──
  reference: string | null;          // Quote/estimate/reference number
  
  // ── Vendor details ──
  vendor: string | null;
  vendorEmail: string | null;
  vendorPhone: string | null;
  vendorAddress: string | null;
  taxId: string | null;              // ABN / ACN / Tax ID
  
  // ── Dates ──
  date: Date | null;                 // Quotation issue date
  expiryDate: Date | null;           // Validity / expiry date
  
  // ── Financials ──
  currency: string;                  // Default: 'AUD'
  subtotal: number | null;
  tax: number | null;
  total: number | null;
  lineItems: NormalizedQuotationLineItem[];
  
  // ── Content ──
  paymentTerms: string | null;       // e.g. "50% deposit, 50% on completion"
  scope: string | null;              // Scope of work / inclusions
  exclusions: string | null;         // What's NOT included
  notes: string | null;              // Additional notes / remarks
  
  // ── Quality ──
  confidence: {
    overall: number;                 // 0.0–1.0
    vendor: number;
    reference: number;
    date: number;
    total: number;
  };
  suggestedCorrections: string[];
}

export interface NormalizedQuotationLineItem {
  description: string;
  quantity: number;
  unit?: string;                     // e.g. 'm²', 'hrs', 'ea'
  unitPrice: number;
  total: number;
  tax?: number;
}

export type QuotationParsingStrategyType = 'regex' | 'llm';

/**
 * Strategy interface for quotation document parsing.
 * Implementations parse raw OCR text into a NormalizedQuotation.
 */
export interface IQuotationParsingStrategy {
  /** Identifies which strategy this is (for logging / diagnostics) */
  readonly strategyType: QuotationParsingStrategyType;

  /**
   * Parse raw OCR output into a structured quotation.
   * @param ocrResult - Raw OCR result (full text + tokens)
   * @returns Normalized quotation with confidence scores
   */
  parse(ocrResult: OcrResult): Promise<NormalizedQuotation>;
}
```

### 4.3 Strategy Implementations

#### `LlmQuotationParser` (Phase 1 — built now)

```
src/infrastructure/ai/LlmQuotationParser.ts
```

- Implements `IQuotationParsingStrategy` with `strategyType = 'llm'`.
- Follows the **existing `GroqTranscriptParser` pattern** already proven in this codebase: sends OCR text to Groq's OpenAI-compatible chat API with a structured JSON system prompt, parses the JSON response into `NormalizedQuotation`.
- Reuses the same Groq API key (`GROQ_API_KEY` from `src/types/env.d.ts`) and fetch+timeout pattern.
- The system prompt defines the `NormalizedQuotation` JSON schema and instructs the LLM to extract all quotation fields from the raw OCR text.
- Higher accuracy for complex layouts, tables, varied line item formats, and free-form text sections (scope, exclusions, payment terms).
- Requires network connectivity (Groq cloud API).
- Includes graceful error handling: on LLM failure, returns an empty `NormalizedQuotation` so the user can fill the form manually (non-blocking).

**Relationship to existing code:**
- Mirrors `GroqTranscriptParser` (`src/infrastructure/voice/GroqTranscriptParser.ts`) in structure: constructor takes `apiKey` + `timeoutMs`, uses `fetch` with `AbortController`, parses JSON from `choices[0].message.content`.
- Lives in `src/infrastructure/ai/` (infrastructure layer) since it makes network calls, while the interface lives in `src/application/ai/` (application layer).

#### `RegexQuotationParser` (Phase 2 — future)

```
src/application/ai/RegexQuotationParser.ts
```

- Standalone class implementing `IQuotationParsingStrategy`.
- Contains quotation-specific regex extraction logic (see Section 6 for regex patterns).
- Does **not** extend or depend on `InvoiceNormalizer` — fully independent.
- Zero external dependencies (pure TypeScript, no network, no LLM SDK).
- Useful as a fallback when offline or when LLM API is unavailable.

### 4.4 Strategy Resolver — `QuotationParserFactory`

A factory selects and returns the appropriate strategy at runtime based on configuration.

```typescript
// src/application/ai/QuotationParserFactory.ts

import { IQuotationParsingStrategy, QuotationParsingStrategyType } from './IQuotationParsingStrategy';
// import { RegexQuotationParser } from './RegexQuotationParser';  // Phase 2
import { LlmQuotationParser } from '../../infrastructure/ai/LlmQuotationParser';

export interface QuotationParserConfig {
  /** Which parsing strategy to use. Defaults to 'llm'. */
  strategy: QuotationParsingStrategyType;
  /** LLM-specific config — required when strategy is 'llm'. */
  llm?: {
    apiKey: string;
    model?: string;           // Default: 'llama-3.3-70b-versatile'
    timeoutMs?: number;       // Default: 30_000
  };
}

/**
 * Factory that creates the appropriate IQuotationParsingStrategy
 * based on runtime configuration.
 */
export class QuotationParserFactory {
  static create(config: QuotationParserConfig): IQuotationParsingStrategy {
    switch (config.strategy) {
      case 'llm':
        if (!config.llm?.apiKey) {
          throw new Error('LLM quotation parser requires an API key.');
        }
        return new LlmQuotationParser(
          config.llm.apiKey,
          config.llm.timeoutMs,
          config.llm.model,
        );

      case 'regex':
        // Phase 2: return new RegexQuotationParser();
        throw new Error(
          'Regex quotation parser is not yet implemented. Use "llm" strategy.'
        );

      default:
        throw new Error(`Unknown quotation parsing strategy: "${config.strategy}"`);
    }
  }
}
```

### 4.5 Integration — Updated Processing Pipeline

The `QuotationScreen` will use `ProcessQuotationUploadUseCase` (new, quotation-specific) instead of reusing `ProcessInvoiceUploadUseCase`. The use case accepts an `IQuotationParsingStrategy` rather than an `IInvoiceNormalizer`.

```
QuotationScreen
  │
  ├─ reads QuotationParserConfig from app config / feature flag
  │
  ├─ QuotationParserFactory.create(config)
  │   └─ returns IQuotationParsingStrategy (regex or llm)
  │
  └─ ProcessQuotationUploadUseCase(ocrAdapter, parsingStrategy, pdfConverter?)
      │
      ├─ PDF → images (via IPdfConverter)
      ├─ images → OcrResult (via IOcrAdapter)
      ├─ OcrResult → NormalizedQuotation (via IQuotationParsingStrategy.parse())
      │
      └─ returns { normalized: NormalizedQuotation, documentRef, rawOcrText }
```

**Key change:** `QuotationScreen` no longer accepts `invoiceNormalizer?: IInvoiceNormalizer`. It accepts `parsingStrategy?: IQuotationParsingStrategy` (or constructs one via `QuotationParserFactory`).

```typescript
// QuotationScreen props (updated)
interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (quotation: Quotation) => void;
  // Adapters for DI (testing)
  filePickerAdapter?: IFilePickerAdapter;
  fileSystemAdapter?: IFileSystemAdapter;
  ocrAdapter?: IOcrAdapter;
  pdfConverter?: IPdfConverter;
  /** Override the parsing strategy (DI for testing). If not provided, uses QuotationParserFactory. */
  parsingStrategy?: IQuotationParsingStrategy;
  /** Config for parser selection. Defaults to { strategy: 'llm', llm: { apiKey: GROQ_API_KEY } }. */
  parserConfig?: QuotationParserConfig;
}
```

### 4.6 Class Diagram

```
                    ┌───────────────────────────────┐
                    │  IQuotationParsingStrategy     │  ← Interface (application layer)
                    │  ─────────────────────────────│
                    │  + strategyType: string        │
                    │  + parse(OcrResult):            │
                    │      Promise<NormalizedQuotn>  │
                    └──────────┬────────────────────┘
                               │
              ┌────────────────┼────────────────┐
              │                                 │
  ┌───────────▼────────────┐       ┌────────────▼───────────┐
  │  LlmQuotationParser   │       │  RegexQuotationParser   │
  │  (Phase 1 — now)       │       │  (Phase 2 — future)    │
  │  ──────────────────────│       │  ──────────────────────│
  │  strategyType = 'llm'  │       │  strategyType = 'regex'│
  │  parse(ocrResult)      │       │  parse(ocrResult)      │
  │  • buildPrompt()       │       │  • extractVendors()    │
  │  • callGroqApi()       │       │  • extractEmails()     │
  │  • parseJsonResponse() │       │  • extractPhones()     │
  │  • mapToNormalized()   │       │  • extractAddresses()  │
  │  (infrastructure/ai/)  │       │  • extractReferences() │
  └────────────────────────┘       │  (application/ai/)     │
                                   └────────────────────────┘
  ┌────────────────────────┐
  │  QuotationParserFactory │
  │  ──────────────────────│
  │  + create(config):     │
  │     IQuotationParsing  │
  │     Strategy           │
  │  (application/ai/)     │
  └────────────────────────┘

  ┌─────────────────────────────────────────────────────────┐
  │  ProcessQuotationUploadUseCase                          │
  │  ─────────────────────────────────────────────────────  │
  │  constructor(                                           │
  │    ocrAdapter: IOcrAdapter,                             │
  │    parsingStrategy: IQuotationParsingStrategy,          │
  │    pdfConverter?: IPdfConverter                         │
  │  )                                                      │
  │  + execute(input): Promise<ProcessQuotationUploadOutput>│
  └─────────────────────────────────────────────────────────┘
```

### 4.7 Relationship to Existing Code

- **`InvoiceNormalizer` and `IInvoiceNormalizer`** are **not modified**. They continue to serve the invoice upload flow (`InvoiceScreen` → `ProcessInvoiceUploadUseCase`).
- **`GroqTranscriptParser`** (`src/infrastructure/voice/GroqTranscriptParser.ts`) is the reference implementation for the LLM call pattern. `LlmQuotationParser` follows the same structure: constructor with `apiKey` + `timeoutMs`, `fetch` with `AbortController`, JSON response parsing from `choices[0].message.content`.
- The `NormalizedQuotation` type is **separate from** `NormalizedInvoice`. This allows the quotation output to diverge freely (e.g., `scope`, `exclusions`, `paymentTerms` fields are quotation-specific).
- The existing `GROQ_API_KEY` environment variable (`src/types/env.d.ts`) is reused — no new secrets required.

---

## 5. LLM Implementation Details — `LlmQuotationParser`

### 5.1 Architecture (follows `GroqTranscriptParser` pattern)

```typescript
// src/infrastructure/ai/LlmQuotationParser.ts

import { IQuotationParsingStrategy, NormalizedQuotation } from '../../application/ai/IQuotationParsingStrategy';
import { OcrResult } from '../../application/services/IOcrAdapter';

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_PROMPT = `You are a document parser for a construction project management app.
Extract structured quotation/estimate information from OCR text of a PDF document.
Respond ONLY with a valid JSON object matching this schema:
{
  "reference": string | null,        // Quote/estimate/reference number
  "vendor": string | null,           // Company/vendor name
  "vendorEmail": string | null,      // Email address
  "vendorPhone": string | null,      // Phone number
  "vendorAddress": string | null,    // Full street address
  "taxId": string | null,            // ABN, ACN, or Tax ID
  "date": string | null,             // Quotation issue date (ISO 8601: YYYY-MM-DD)
  "expiryDate": string | null,       // Expiry/validity date (ISO 8601: YYYY-MM-DD)
  "currency": string,                // ISO 4217 code, default "AUD"
  "subtotal": number | null,         // Before tax
  "tax": number | null,              // Tax amount (GST/VAT)
  "total": number | null,            // Grand total
  "lineItems": [                     // Array of line items
    {
      "description": string,
      "quantity": number,
      "unit": string | null,         // e.g. "m²", "hrs", "ea"
      "unitPrice": number,
      "total": number,
      "tax": number | null
    }
  ],
  "paymentTerms": string | null,     // e.g. "50% deposit, 50% on completion"
  "scope": string | null,            // Scope of work / inclusions
  "exclusions": string | null,       // What's NOT included
  "notes": string | null             // Additional notes / remarks
}
Omit fields that are not found in the document (set to null).
Do not wrap in markdown or code blocks.
For dates, convert to ISO 8601 format (YYYY-MM-DD).
For currency, detect from symbols ($=AUD for Australian context, €=EUR, £=GBP) or text.
Extract ALL line items found in the document, even if formatting varies.`;

export class LlmQuotationParser implements IQuotationParsingStrategy {
  readonly strategyType = 'llm' as const;

  constructor(
    private readonly apiKey: string,
    private readonly timeoutMs = 30_000,
    private readonly model = 'llama-3.3-70b-versatile',
  ) {}

  async parse(ocrResult: OcrResult): Promise<NormalizedQuotation> {
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
          model: this.model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: ocrResult.fullText },
          ],
          temperature: 0,
          max_tokens: 2048,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Groq LLM failed: HTTP ${res.status}`);
      }

      const body = await res.json();
      const content = body.choices?.[0]?.message?.content ?? '{}';

      return this.parseResponse(content);
    } catch (err: unknown) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      if (isAbort) {
        throw new Error(`Groq LLM timed out after ${this.timeoutMs}ms`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  private parseResponse(content: string): NormalizedQuotation {
    // Parse JSON, convert date strings to Date objects,
    // apply defaults, compute confidence scores.
    // On parse failure: return empty NormalizedQuotation.
  }
}
```

### 5.2 Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| Reuse Groq API | Already integrated in the app (`GroqTranscriptParser`, `GroqSTTAdapter`); same API key; proven pattern |
| `temperature: 0` | Deterministic output for document parsing (same as `GroqTranscriptParser`) |
| `max_tokens: 2048` | Higher than transcript parser (256) because quotation JSON is larger (line items, scope, etc.) |
| `llama-3.3-70b-versatile` | Same model used by `GroqTranscriptParser`; good JSON output quality |
| System prompt defines JSON schema | Ensures structured output; LLM returns fields matching `NormalizedQuotation` directly |
| Confidence scoring | LLM parser sets high confidence (0.9) for fields it returns, 0.0 for null fields. Future: could use LLM self-reported confidence. |
| ISO 8601 dates in prompt | Avoids ambiguous date formats; `parseResponse()` converts strings to `Date` objects |

### 5.3 Error Handling & Fallback

```
LlmQuotationParser.parse(ocrResult)
  ├─ HTTP error (non-2xx) → throws Error("Groq LLM failed: HTTP {status}")
  ├─ Timeout → throws Error("Groq LLM timed out after {ms}ms")
  ├─ JSON parse failure → returns empty NormalizedQuotation (all nulls)
  └─ Success → returns populated NormalizedQuotation
```

The calling code (`ProcessQuotationUploadUseCase` or `QuotationScreen`) catches errors and shows the form for manual entry (non-blocking, same as current invoice flow).

### 5.4 Fields Extracted by LLM vs Current Regex

| Field | Current Regex | LLM (Phase 1) |
|-------|:---:|:---:|
| Vendor name | ✅ | ✅ |
| Vendor email | ❌ | ✅ |
| Vendor phone | ❌ | ✅ |
| Vendor address | ❌ | ✅ |
| ABN / Tax ID | ❌ | ✅ |
| Quote reference | ❌ (invoice-only patterns) | ✅ |
| Issue date | ✅ (limited formats) | ✅ (any format) |
| Expiry / validity | ❌ | ✅ |
| Subtotal | ✅ | ✅ |
| Tax / GST | ✅ | ✅ |
| Total | ✅ | ✅ |
| Currency | ✅ (symbol-based) | ✅ (contextual) |
| Line items | ⚠️ (single rigid pattern) | ✅ (any layout) |
| Line item units | ❌ | ✅ |
| Payment terms | ❌ | ✅ |
| Scope of work | ❌ | ✅ |
| Exclusions | ❌ | ✅ |
| Notes | ❌ | ✅ |

---

## 6. Updated Mapping — `normalizedQuotationToFormValues`

A **new** mapper function replaces `normalizedInvoiceToQuotationFormValues`. It maps `NormalizedQuotation` (not `NormalizedInvoice`) to `Partial<Quotation>`.

| NormalizedQuotation field | → Quotation form field | Status |
|---------------------------|------------------------|--------|
| `vendor` | `vendorName` | New (quotation-specific type) |
| `vendorEmail` | `vendorEmail` | **New** |
| `vendorAddress` | `vendorAddress` | **New** |
| `reference` | `reference` | New (was `invoiceNumber`) |
| `date` | `date` | New (was `invoiceDate`) |
| `expiryDate` | `expiryDate` | New (was `dueDate`) |
| `total` | `total` | Same |
| `subtotal` | `subtotal` | **New mapping** |
| `tax` | `taxTotal` | **New mapping** |
| `currency` | `currency` | Same |
| `lineItems[]` | `lineItems[]` | Same (improved extraction) |
| `paymentTerms` | `notes` | **New** (prepended to notes) |
| `scope` | `notes` | **New** (appended to notes) |
| `exclusions` | `notes` | **New** (appended with "Exclusions:" header) |
| `notes` | `notes` | **New** (appended) |

---

## 7. Files to Create / Modify

### New Files

| File | Purpose |
|------|---------|
| `src/application/ai/IQuotationParsingStrategy.ts` | `IQuotationParsingStrategy` interface + `NormalizedQuotation` type + `NormalizedQuotationLineItem` type |
| `src/infrastructure/ai/LlmQuotationParser.ts` | LLM-based implementation of `IQuotationParsingStrategy` (Groq API, follows `GroqTranscriptParser` pattern) |
| `src/application/ai/QuotationParserFactory.ts` | Factory to create the appropriate strategy from config |
| `src/application/usecases/quotation/ProcessQuotationUploadUseCase.ts` | Quotation-specific upload pipeline (replaces reuse of `ProcessInvoiceUploadUseCase`) |
| `src/utils/normalizedQuotationToFormValues.ts` | Maps `NormalizedQuotation` → `Partial<Quotation>` for form pre-fill |
| `__tests__/unit/LlmQuotationParser.test.ts` | Unit tests for LLM parser (mocked fetch) |
| `__tests__/unit/QuotationParserFactory.test.ts` | Unit tests for factory / strategy selection |
| `__tests__/unit/ProcessQuotationUploadUseCase.test.ts` | Unit tests for the new use case |
| `__tests__/unit/normalizedQuotationToFormValues.test.ts` | Unit tests for the new mapper |

### Modified Files

| File | Change |
|------|--------|
| `src/pages/quotations/QuotationScreen.tsx` | Replace `invoiceNormalizer?: IInvoiceNormalizer` prop with `parsingStrategy?: IQuotationParsingStrategy` + `parserConfig?: QuotationParserConfig`. Use `ProcessQuotationUploadUseCase` instead of `ProcessInvoiceUploadUseCase`. Use `normalizedQuotationToFormValues` instead of `normalizedInvoiceToQuotationFormValues`. |
| `src/pages/dashboard/index.tsx` | Pass `parsingStrategy` or `parserConfig` (with `GROQ_API_KEY`) to `QuotationScreen` — similar to how `invoiceNormalizer` is passed today |
| `__tests__/unit/QuotationScreen.upload.test.tsx` | Update to use `IQuotationParsingStrategy` mock instead of `IInvoiceNormalizer` mock |

### Unchanged Files

| File | Reason |
|------|--------|
| `src/application/ai/IInvoiceNormalizer.ts` | No changes — invoice pipeline is unaffected |
| `src/application/ai/InvoiceNormalizer.ts` | No changes — invoice pipeline is unaffected |
| `src/application/usecases/invoice/ProcessInvoiceUploadUseCase.ts` | No changes — continues to serve `InvoiceScreen` |
| `src/pages/invoices/InvoiceScreen.tsx` | No changes — continues to use `IInvoiceNormalizer` |
| `src/utils/normalizedInvoiceToQuotationFormValues.ts` | **Deprecated** — replaced by `normalizedQuotationToFormValues.ts`. Remove after migration. |
| `src/utils/normalizedInvoiceToFormValues.ts` | No changes — continues to serve invoice flow |

---

## 8. Acceptance Criteria

### Extraction Accuracy
- [ ] OCR of a quotation PDF with vendor email populates `vendorEmail` in the form
- [ ] OCR of a quotation PDF with vendor address populates `vendorAddress` in the form
- [ ] OCR of a quotation PDF with "Quote #QUO-001" populates `reference` field
- [ ] OCR of a quotation PDF with "Valid for 30 days" computes and populates `expiryDate`
- [ ] OCR with varied line item formats (tabular, dotted leader, numbered) extracts line items
- [ ] OCR of a quotation PDF with "Payment Terms: 50% deposit" populates `notes` with payment terms
- [ ] OCR of a quotation PDF with ABN extracts and stores the tax ID
- [ ] Subtotal and tax values are mapped to the quotation form when extracted

### Architecture
- [ ] `IQuotationParsingStrategy` interface is defined with `parse()` method and `strategyType` discriminator
- [ ] `LlmQuotationParser` implements `IQuotationParsingStrategy` with `strategyType = 'llm'`
- [ ] `LlmQuotationParser` follows `GroqTranscriptParser` pattern (same API, fetch+AbortController, JSON parsing)
- [ ] `LlmQuotationParser` reuses existing `GROQ_API_KEY` environment variable
- [ ] `QuotationParserFactory.create({ strategy: 'llm', llm: { apiKey } })` returns a `LlmQuotationParser`
- [ ] `QuotationParserFactory.create({ strategy: 'regex' })` throws a clear "not yet implemented" error
- [ ] `ProcessQuotationUploadUseCase` accepts `IQuotationParsingStrategy` (not `IInvoiceNormalizer`)
- [ ] `QuotationScreen` uses `ProcessQuotationUploadUseCase` + `IQuotationParsingStrategy`
- [ ] `Dashboard` passes `parsingStrategy` or `parserConfig` with Groq API key to `QuotationScreen`
- [ ] Invoice OCR pipeline (`InvoiceScreen` → `ProcessInvoiceUploadUseCase` → `InvoiceNormalizer`) is completely unaffected

### Error Handling
- [ ] LLM HTTP error → throws, `QuotationScreen` shows error banner and editable form
- [ ] LLM timeout → throws with clear message
- [ ] LLM returns invalid JSON → returns empty `NormalizedQuotation` (form shows blank, user fills manually)
- [ ] No API key configured → factory throws clear error at construction time

### Testing
- [ ] All existing OCR tests continue to pass (backward compatibility)
- [ ] `LlmQuotationParser` has unit tests with mocked `fetch` verifying prompt, request, and response parsing
- [ ] `LlmQuotationParser` has tests for error cases (HTTP error, timeout, invalid JSON)
- [ ] `QuotationParserFactory` has tests for strategy resolution and error on unsupported strategy
- [ ] `ProcessQuotationUploadUseCase` has tests for the end-to-end pipeline with mocked strategy
- [ ] Mocking `IQuotationParsingStrategy` in `QuotationScreen` tests is straightforward

---

## 9. Out of Scope

- **Regex parser implementation** — `RegexQuotationParser` is designed in the interface but not built in this iteration. The factory throws a clear error if `'regex'` strategy is selected. (See Section 10 — Phase 2.)
- Automatic vendor matching against existing contacts database
- Multi-language OCR support
- Image-based table detection (OCR only works on text layer)
- Changes to the database schema (all new fields already exist in the Quotation entity or can be mapped to existing fields like `notes`)
- Changes to the invoice OCR pipeline (`InvoiceNormalizer`, `ProcessInvoiceUploadUseCase`, `InvoiceScreen`)
- On-device / offline LLM support (requires `RegexQuotationParser` as offline fallback — Phase 2)

---

## 10. Future — Regex Strategy (Phase 2)

When the `RegexQuotationParser` is implemented:

1. It will implement `IQuotationParsingStrategy` with `strategyType = 'regex'`.
2. It will use deterministic regex patterns to extract fields from raw OCR text (see regex patterns documented in the original gap analysis, Section 3).
3. It will be useful as:
   - **Offline fallback** when the device has no network connectivity.
   - **Cost-free alternative** for users who don't want LLM API usage.
   - **Fallback strategy** when LLM parsing fails — the factory or use case could try LLM first, then fall back to regex.
4. The factory will be updated to instantiate `RegexQuotationParser` when `config.strategy === 'regex'`.
5. A combined strategy could be introduced: `LlmWithRegexFallbackParser` that tries LLM first and falls back to regex on failure.

### Future Phase 3 — Invoice LLM Parser

The same `LlmQuotationParser` pattern could be adapted for invoices:
- Create `IInvoiceParsingStrategy` (mirrors `IQuotationParsingStrategy`)
- Create `LlmInvoiceParser` (mirrors `LlmQuotationParser` with invoice-specific prompt)
- Refactor `InvoiceScreen` to use the strategy pattern
- Extract shared LLM call logic to a base class or utility (e.g., `GroqDocumentParser`)
