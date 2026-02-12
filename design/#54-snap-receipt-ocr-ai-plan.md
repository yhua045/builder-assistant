# #54 — Snap Receipt: OCR + AI Analysis (Split into OCR and AI subtasks)

## Summary / User Story

As a user capturing a receipt photo, I want the app to automatically extract vendor, date, amount, and line items from the image so that I can quickly review and save receipt details without manual data entry.

## Why Split OCR and AI?

- **OCR** is deterministic and should be validated independently (extraction quality, performance, offline-first)
- **AI post-processing** improves parsing, field normalization, and heuristics for ambiguous receipts
- Split allows incremental implementation, independent testing, and swappable AI backends

## Context

- Related: issue #48 (Snap Receipt quick action base implementation)
- Current state: `SnapReceiptUseCase` and `ReceiptForm` exist; camera capture is available but no OCR/extraction
- ML Kit guidance in issue #9 notes
- Must follow TDD workflow per CLAUDE.md

## Scope

### In Scope
1. **OCR Pipeline** (Sub-task A): On-device text extraction with basic heuristic parsing
2. **AI Post-Processing** (Sub-task B): Normalize and improve extracted fields
3. **Pipeline Integration**: Wire OCR → AI → ReceiptForm flow
4. **Test Coverage**: Unit tests for adapters, integration tests with fixture images

### Out of Scope
- Camera integration (handled by issue #48 or existing implementation)
- Server-side AI in first iteration (implement interface only; use deterministic rules-based normalizer first)
- Advanced ML model training/fine-tuning
- Receipt photo editing/cropping UI

## Architecture & Implementation

### 1. OCR Pipeline (Sub-task A)

#### Application Interface
**File**: `src/application/services/IOcrAdapter.ts` (new)
```typescript
export interface OcrToken {
  text: string;
  confidence: number;
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface OcrResult {
  fullText: string;
  tokens: OcrToken[];
  imageUri: string;
}

export interface IOcrAdapter {
  /**
   * Extract text from receipt image
   * @param imageUri - Local file URI or base64 image
   * @returns OCR result with full text and token positions
   */
  extractText(imageUri: string): Promise<OcrResult>;
}
```

#### Infrastructure Implementation
**File**: `src/infrastructure/ocr/MobileOcrAdapter.ts` (new)
- Integrates Google ML Kit Text Recognition (react-native-ml-kit or similar)
- Implements `IOcrAdapter` interface
- Handles on-device OCR processing
- Returns raw text + token positions with confidence scores

**Dependencies**:
```json
{
  "@react-native-ml-kit/text-recognition": "^X.Y.Z"
}
```

#### Heuristic Parser
**File**: `src/application/receipt/ReceiptFieldParser.ts` (new)
```typescript
export interface ReceiptCandidates {
  vendors: string[];          // Heuristic: top 3 lines, likely bolded/larger text
  dates: Date[];              // Regex: MM/DD/YYYY, DD-MM-YYYY, ISO formats
  amounts: number[];          // Regex: $XX.XX, currency symbols, "Total", "Amount Due"
  taxAmounts: number[];       // Near keywords: "Tax", "GST", "VAT"
  receiptNumbers: string[];   // Near keywords: "Receipt #", "Invoice #", "Order #"
  lineItems: ReceiptLineItem[];  // Items with qty × price patterns
}

export interface ReceiptLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  confidence: number;
}

export class ReceiptFieldParser {
  parse(ocrResult: OcrResult): ReceiptCandidates;
}
```

**Heuristic Rules**:
- **Vendor**: First 1-3 lines of text, before date/address patterns
- **Date**: Regex patterns for common date formats; prioritize dates near top
- **Total Amount**: Keywords "Total", "Amount Due", "Balance" + nearby numbers
- **Tax**: Keywords "Tax", "GST", "VAT" + nearby numbers
- **Receipt Number**: Keywords "Receipt #", "Invoice", "Order" + alphanumeric sequence
- **Line Items**: Multi-line patterns with quantity, description, price (e.g., "2x Widget @ $5.00 = $10.00")

### 2. AI Post-Processing (Sub-task B)

#### Application Interface
**File**: `src/application/receipt/IReceiptNormalizer.ts` (new)
```typescript
export interface NormalizedReceipt {
  vendor: string | null;
  date: Date | null;
  total: number | null;
  tax: number | null;
  currency: string;            // Default: "USD"
  receiptNumber: string | null;
  lineItems: NormalizedLineItem[];
  confidence: {
    overall: number;           // 0.0-1.0
    vendor: number;
    date: number;
    total: number;
  };
  suggestedCorrections: string[];  // Human-readable suggestions for review
}

export interface NormalizedLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  category?: string;           // Optional: AI-suggested category (e.g., "Materials", "Labor")
}

export interface IReceiptNormalizer {
  /**
   * Normalize and improve OCR-extracted candidates
   * @param candidates - Output from ReceiptFieldParser
   * @param ocrResult - Raw OCR result for context
   * @returns Normalized receipt with confidence scores
   */
  normalize(
    candidates: ReceiptCandidates,
    ocrResult: OcrResult
  ): Promise<NormalizedReceipt>;
}
```

#### Implementation: Deterministic Normalizer (Phase 1)
**File**: `src/application/receipt/DeterministicReceiptNormalizer.ts` (new)
- Rules-based normalizer to ship quickly and pass tests
- Logic:
  - **Vendor**: Pick first vendor candidate; apply business name cleanup (remove "Inc.", "LLC", etc.)
  - **Date**: Pick most recent date candidate within last 30 days; default to today if ambiguous
  - **Total**: Pick largest amount candidate near "Total" keyword; validate > sum of line items
  - **Tax**: Pick amount near "Tax" keyword; validate < total
  - **Receipt Number**: Pick alphanumeric sequence near "Receipt #" keyword
  - **Line Items**: Aggregate multi-line patterns; validate sum matches total
  - **Currency**: Default "USD"; detect symbols ($, €, £) if present
  - **Confidence**: Rule-based scoring (e.g., 0.9 if keyword match, 0.5 if heuristic only)

#### Future Implementation: ML Normalizer (Phase 2 - Optional)
**File**: `src/infrastructure/ai/TfLiteReceiptNormalizer.ts` (new)
- TensorFlow Lite model wrapper for on-device ML normalization
- Same interface: `IReceiptNormalizer`
- Input: OCR text + candidates (encoded as feature vectors)
- Output: Structured fields + confidence scores

**File**: `src/infrastructure/ai/RemoteReceiptNormalizer.ts` (new)
- HTTP adapter for server-side AI enrichment
- Same interface: `IReceiptNormalizer`
- POST to `/api/receipts/normalize` with OCR result
- Response: JSON structured fields

### 3. Pipeline Integration

#### Enhanced Use Case
**File**: `src/application/usecases/receipt/SnapReceiptUseCase.ts` (update existing)
- Add OCR and normalizer dependencies via DI
- Flow:
  1. Accept image URI from camera capture
  2. Call `ocrAdapter.extractText(imageUri)`
  3. Parse candidates with `ReceiptFieldParser.parse(ocrResult)`
  4. Normalize with `receiptNormalizer.normalize(candidates, ocrResult)`
  5. Return `NormalizedReceipt` to UI for review

```typescript
export class SnapReceiptUseCase {
  constructor(
    private ocrAdapter: IOcrAdapter,
    private fieldParser: ReceiptFieldParser,
    private normalizer: IReceiptNormalizer,
    private invoiceRepository: IInvoiceRepository,
    private paymentRepository: IPaymentRepository
  ) {}

  async processReceipt(imageUri: string): Promise<NormalizedReceipt> {
    const ocrResult = await this.ocrAdapter.extractText(imageUri);
    const candidates = this.fieldParser.parse(ocrResult);
    const normalized = await this.normalizer.normalize(candidates, ocrResult);
    return normalized;
  }

  async saveReceipt(
    normalizedReceipt: NormalizedReceipt,
    projectId?: string
  ): Promise<{ invoiceId: string; paymentId: string }> {
    // Existing logic: create invoice + payment
    // Enhanced: use normalized fields to pre-fill invoice
  }
}
```

#### UI Integration
**File**: `src/components/receipts/ReceiptForm.tsx` (update existing)
- Add loading state for OCR processing
- Display normalized fields with confidence badges
- Show `suggestedCorrections` as inline hints
- Allow user to accept/edit before saving

**UI Flow**:
1. User captures photo → `imageUri` passed to `SnapReceiptUseCase.processReceipt(imageUri)`
2. Show loading spinner: "Extracting receipt details..."
3. Display `ReceiptForm` with pre-filled fields from `NormalizedReceipt`
4. Show confidence indicators (e.g., green checkmark for >0.8, yellow warning for 0.5-0.8, red flag for <0.5)
5. User reviews, edits if needed, and saves
6. Call `SnapReceiptUseCase.saveReceipt(normalizedReceipt, projectId)`

### 4. Test Fixtures

**File**: `__tests__/fixtures/receipts/` (new directory)
- Add sample receipt images:
  - `receipt-grocery.jpg` (simple: clear vendor, date, total)
  - `receipt-restaurant.jpg` (complex: multiple taxes, tips, line items)
  - `receipt-hardware.jpg` (construction materials: SKUs, quantities)
  - `receipt-faded.jpg` (low quality: test OCR robustness)
  - `receipt-tilted.jpg` (rotated: test OCR preprocessing)

**File**: `__tests__/fixtures/receipts/receipt-grocery.expected.json`
```json
{
  "vendor": "Acme Grocery",
  "date": "2026-02-10T00:00:00Z",
  "total": 45.67,
  "tax": 3.89,
  "currency": "USD",
  "receiptNumber": "INV-12345",
  "lineItems": [
    { "description": "Apples", "quantity": 3, "unitPrice": 1.50, "total": 4.50 },
    { "description": "Bread", "quantity": 2, "unitPrice": 2.99, "total": 5.98 }
  ]
}
```

## TDD Workflow

### Phase 1: OCR Pipeline (Red → Green → Refactor)

#### Step 1: Design the Abstraction
- [x] Define `IOcrAdapter` interface in `src/application/services/IOcrAdapter.ts`
- [x] Define `ReceiptFieldParser` in `src/application/receipt/ReceiptFieldParser.ts`

#### Step 2: Write Failing Tests
**File**: `__tests__/unit/MobileOcrAdapter.test.ts` (new)
- [ ] Mocked ML Kit: `extractText()` returns expected tokens
- [ ] Confidence scores are validated (0.0-1.0 range)
- [ ] Error handling: invalid image URI throws error

**File**: `__tests__/unit/ReceiptFieldParser.test.ts` (new)
- [ ] Parses vendor from top lines
- [ ] Extracts dates with regex patterns
- [ ] Extracts amounts near "Total" keyword
- [ ] Extracts tax amounts near "Tax" keyword
- [ ] Extracts receipt numbers near "Receipt #" keyword
- [ ] Parses line items with quantity × price patterns

**File**: `__tests__/integration/OcrPipeline.integration.test.ts` (new)
- [ ] Real image fixture → OCR adapter → parser → candidates match expected output

#### Step 3: Implement to Pass Tests
- [ ] Implement `MobileOcrAdapter` with ML Kit integration
- [ ] Implement `ReceiptFieldParser` with heuristic rules
- [ ] Run tests: `npm test -- MobileOcrAdapter ReceiptFieldParser`

#### Step 4: Refactor
- [ ] Extract regex patterns to constants
- [ ] Add logging for debugging OCR quality
- [ ] Optimize token processing performance

### Phase 2: AI Post-Processing (Red → Green → Refactor)

#### Step 1: Design the Abstraction
- [x] Define `IReceiptNormalizer` interface

#### Step 2: Write Failing Tests
**File**: `__tests__/unit/DeterministicReceiptNormalizer.test.ts` (new)
- [ ] Normalizes vendor with cleanup rules
- [ ] Selects most likely date from candidates
- [ ] Validates total > sum of line items
- [ ] Validates tax < total
- [ ] Calculates confidence scores correctly
- [ ] Returns suggested corrections for ambiguous fields

**File**: `__tests__/integration/ReceiptNormalization.integration.test.ts` (new)
- [ ] Full pipeline: image → OCR → parser → normalizer → matches expected output
- [ ] Test with all fixture images (grocery, restaurant, hardware, faded, tilted)

#### Step 3: Implement to Pass Tests
- [ ] Implement `DeterministicReceiptNormalizer` with rules-based logic
- [ ] Run tests: `npm test -- DeterministicReceiptNormalizer`

#### Step 4: Refactor
- [ ] Extract business rules to configuration
- [ ] Add extensibility for custom rules per receipt type

### Phase 3: Integration with Snap Receipt Flow

#### Step 1: Update Use Case
- [ ] Add OCR and normalizer to `SnapReceiptUseCase` via DI
- [ ] Implement `processReceipt(imageUri)` method

#### Step 2: Write Failing Tests
**File**: `__tests__/unit/SnapReceiptUseCase.test.ts` (update existing)
- [ ] `processReceipt()` calls OCR adapter
- [ ] `processReceipt()` parses candidates
- [ ] `processReceipt()` normalizes fields
- [ ] `processReceipt()` returns `NormalizedReceipt`
- [ ] `saveReceipt()` creates invoice with normalized fields

**File**: `__tests__/integration/SnapReceipt.integration.test.ts` (new)
- [ ] End-to-end: image → OCR → normalizer → ReceiptForm pre-fill → save → DB query validates data

#### Step 3: Implement to Pass Tests
- [ ] Update `SnapReceiptUseCase` with pipeline logic
- [ ] Update `ReceiptForm` to display normalized fields with confidence indicators
- [ ] Run tests: `npm test -- SnapReceiptUseCase SnapReceipt.integration`

#### Step 4: Manual QA
- [ ] Test on iOS device with real receipt photos
- [ ] Test on Android device with real receipt photos
- [ ] Verify confidence indicators display correctly
- [ ] Verify suggested corrections are helpful

## Acceptance Criteria (Testable)

### OCR Pipeline
- [ ] `MobileOcrAdapter` returns raw OCR text + token positions for input images (unit tests pass)
- [ ] `ReceiptFieldParser` extracts candidate fields for sample fixtures (unit tests pass)
- [ ] Integration test: fixture image → OCR → parser → candidates match expected output

### AI Post-Processing
- [ ] `DeterministicReceiptNormalizer` returns normalized structured fields and confidence scores (unit tests pass)
- [ ] Normalizer validates business rules (total > sum of line items, tax < total)
- [ ] Integration test: fixture image → full pipeline → normalized output matches expected result

### Snap Receipt Flow
- [ ] `SnapReceiptUseCase.processReceipt()` returns `NormalizedReceipt` with extracted fields
- [ ] `ReceiptForm` displays pre-filled fields with confidence indicators
- [ ] User can accept/edit normalized fields before saving
- [ ] Saved invoice and payment contain correct normalized data
- [ ] Integration test: full flow from image capture to DB persistence works

### Performance & UX
- [ ] OCR processing completes within 3 seconds for typical receipt image (<2MB)
- [ ] Loading state displays during OCR processing
- [ ] Error handling: invalid/corrupted image shows friendly error message
- [ ] Confidence indicators are visually clear (green/yellow/red or similar)

### Security & Privacy
- [ ] OCR processing is on-device (no image data sent to server)
- [ ] Processed receipt photos are stored locally via Document storage engine
- [ ] (Future) Remote AI enrichment uses TLS encryption

## Implementation Checklist

### Pre-Implementation
- [ ] Review this design doc and get approval
- [ ] Set up test fixtures: add sample receipt images and expected outputs

### Sub-task A: OCR Pipeline
- [ ] Define `IOcrAdapter` interface
- [ ] Write failing unit tests for `MobileOcrAdapter`
- [ ] Implement `MobileOcrAdapter` with ML Kit integration
- [ ] Implement `ReceiptFieldParser` with heuristic rules
- [ ] Write failing integration tests for OCR pipeline
- [ ] Make integration tests pass
- [ ] Refactor: optimize performance, extract constants

### Sub-task B: AI Post-Processing
- [ ] Define `IReceiptNormalizer` interface
- [ ] Write failing unit tests for `DeterministicReceiptNormalizer`
- [ ] Implement `DeterministicReceiptNormalizer` with rules-based logic
- [ ] Write failing integration tests for normalization
- [ ] Make integration tests pass
- [ ] Refactor: extract business rules to configuration

### Sub-task C: Integration
- [ ] Update `SnapReceiptUseCase` with OCR + AI pipeline
- [ ] Write failing tests for updated use case
- [ ] Make use case tests pass
- [ ] Update `ReceiptForm` UI to display normalized fields with confidence indicators
- [ ] Write integration test for full flow (image → DB)
- [ ] Make integration test pass

### Manual QA & Polish
- [ ] Test on iOS device with real receipts
- [ ] Test on Android device with real receipts
- [ ] Verify loading states and error handling
- [ ] Verify confidence indicators are helpful
- [ ] Address any UX issues discovered during testing

### Documentation & Handoff
- [ ] Update `progress.md` with summary of implementation
- [ ] Document any trade-offs or future improvements needed
- [ ] Create PR with reference to this design doc

## Estimates

- **OCR Pipeline** (adapter + parser + tests): 2-3 dev days
- **Deterministic AI Normalizer** (rules-based + tests): 1-2 dev days
- **Integration** (use case + UI + integration tests): 1-2 dev days
- **Manual QA & polish**: 0.5-1 dev day
- **Total**: 4.5-8 dev days

## Future Enhancements (Out of Scope for #54)

- [ ] TensorFlow Lite model for improved field extraction accuracy
- [ ] Server-side AI enrichment for high-accuracy parsing (remote API)
- [ ] Receipt photo editing/cropping UI before OCR
- [ ] Multi-currency detection and conversion
- [ ] Automatic project/category suggestion based on vendor
- [ ] Receipt duplicate detection (warn if similar receipt already exists)

## Questions & Notes

1. **ML Kit License**: Verify Google ML Kit Text Recognition license is compatible with project (Apache 2.0 expected)
2. **Test Image Sources**: Use synthetic test receipts or publicly available receipt datasets to avoid privacy issues
3. **Confidence Thresholds**: UX team should define acceptable confidence levels for auto-acceptance vs. manual review
4. **Currency Default**: Assume USD for Phase 1; multi-currency in future iteration
5. **Line Item Matching**: Complex pattern matching may need iteration; start simple and improve based on QA feedback

## References

- Issue #48: Snap Receipt base implementation
- Issue #9: ML Kit/TF Lite notes
- CLAUDE.md: TDD workflow and architecture guidelines
- Google ML Kit Documentation: https://developers.google.com/ml-kit/vision/text-recognition/v2
