# Design: PDF → Image Conversion Adapter for OCR Pipeline (Issue #87)

## 1. User Story

As a user of the Builder Assistant app, I want to upload a PDF invoice or receipt so that the app can extract costs and vendor information automatically — just as it does for image uploads — without requiring a network round-trip or server-side service.

---

## 2. Problem Statement

The current `ProcessInvoiceUploadUseCase` explicitly skips OCR for PDFs (mimeType `application/pdf`) and returns an empty `NormalizedInvoice`, forcing the user to fill the form manually. PDFs are the dominant file format for invoices; this gap degrades the experience significantly.

ML Kit Text Recognition (and the existing `IOcrAdapter`) operates on **image URIs only**. The solution is to convert each PDF page into a raster image before feeding it to the OCR pipeline.

---

## 3. Proposed Architecture

### 3.1 New Interface: `IPdfConverter`

Location: `src/infrastructure/files/IPdfConverter.ts`

```typescript
export interface PdfPageImage {
  /** Local file URI of the rendered JPEG/PNG */
  uri: string;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
  /** Zero-based page index */
  pageIndex: number;
}

export interface IPdfConverter {
  /**
   * Convert a PDF file into one raster image per page.
   * @param pdfUri - Local file URI of the PDF (app-private storage)
   * @param dpi    - Render resolution; defaults to 200
   * @returns Array of PdfPageImage, one entry per page, in page order
   */
  convertToImages(pdfUri: string, dpi?: number): Promise<PdfPageImage[]>;

  /**
   * Return the number of pages in the PDF without rendering.
   * @param pdfUri - Local file URI of the PDF
   */
  getPageCount(pdfUri: string): Promise<number>;
}
```

### 3.2 Production Implementation: `MobilePdfConverter`

Location: `src/infrastructure/files/MobilePdfConverter.ts`

**Recommended library**: [`rn-pdf-renderer`](https://github.com/douglasjunior/react-native-pdf-renderer)
- Wraps iOS **PDFKit** and Android **PdfRenderer** (both platform-native, no extra APK size)
- Returns rendered bitmap at configurable scale
- Maintained (2024 releases), MIT licence

**If `rn-pdf-renderer` is unsuitable**, fallback: write a minimal custom native module using the same platform APIs — the interface remains unchanged.

**Algorithm per page**:
1. Open PDF document at `pdfUri`
2. For each page (0 … n-1):
   a. Render page to a bitmap at `dpi` (default 200)
   b. Save bitmap to app-private temp directory as `pdf_<uuid>_p<index>.jpg`
   c. Capture `{ uri, width, height, pageIndex }`
3. Return array of `PdfPageImage`

**DPI defaults**: 200 DPI produces ~1650 × 2340 px for A4, sufficient for ML Kit text recognition.

### 3.3 Mock Implementation: `MockPdfConverter`

Location: `__mocks__/MockPdfConverter.ts`

Returns configurable in-memory `PdfPageImage[]` records. Used in unit and integration tests to avoid native dependencies.

### 3.4 Integration Into Use Cases

#### `ProcessInvoiceUploadUseCase`

Old flow for PDFs:
```
PDF → skip → empty NormalizedInvoice
```

New flow:
```
PDF → IPdfConverter.convertToImages() → [image URIs] → IOcrAdapter (per page) → concatenate → normalize
```

Changes:
- Add `pdfConverter: IPdfConverter` as optional constructor argument (preserves backward compatibility — existing callers pass nothing for non-PDF flows)
- When `mimeType === 'application/pdf'`:
  1. Call `pdfConverter.convertToImages(fileUri)`
  2. Call `ocrAdapter.extractText()` for each page in sequence
  3. Concatenate `fullText` from all pages with `\n\n--- Page N ---\n\n` separator
  4. Pass combined text through normalizer pipeline
  5. Use first page's `OcrResult.imageUri` for `documentRef`
- If no `pdfConverter` supplied and file is PDF → keep existing empty-result behaviour (graceful degradation)
- Clean up temp image files after OCR in a `finally` block

#### `SnapReceiptUseCase`

The Snap flow is camera-only today (`imageUri` from camera/gallery). PDFs are not a realistic receipt capture scenario in this flow, so **no change is required** to `SnapReceiptUseCase` at this stage. This can be revisited when a file-picker path is added to receipts.

### 3.5 Dependency Injection

`ProcessInvoiceUploadUseCase` is constructed in the DI container. The `pdfConverter` parameter should be wired up as `MobilePdfConverter` in production and `MockPdfConverter` in test environments. The DI container (`src/infrastructure/di/`) should be updated to provide `IPdfConverter` when constructing `ProcessInvoiceUploadUseCase`.

---

## 4. File Map

| File | Status | Notes |
|---|---|---|
| `src/infrastructure/files/IPdfConverter.ts` | **New** | Interface + types |
| `src/infrastructure/files/MobilePdfConverter.ts` | **New** | Production impl using rn-pdf-renderer |
| `__mocks__/MockPdfConverter.ts` | **New** | Configurable stub for tests |
| `src/application/usecases/invoice/ProcessInvoiceUploadUseCase.ts` | **Modified** | Accept optional `IPdfConverter`; handle PDF path |
| `src/infrastructure/di/container.ts` (or equivalent) | **Modified** | Wire `MobilePdfConverter` |
| `__tests__/unit/PdfConverter.test.ts` | **New** | Unit tests via MockPdfConverter |
| `__tests__/unit/ProcessInvoiceUploadUseCase.test.ts` | **Modified** | Add PDF path tests |
| `__tests__/integration/ProcessInvoiceUpload.integration.test.ts` | **New** | Full upload → convert → OCR → extract |
| `__tests__/fixtures/pdfs/` | **New** | Single-page, multi-page, landscape, portrait fixtures |

---

## 5. API / Data Contracts

### `IPdfConverter.convertToImages` input/output

```typescript
// Input
pdfUri: string          // e.g. "file:///data/user/0/.../invoice.pdf"
dpi?: number            // default 200, range [72, 300]

// Output (per page)
PdfPageImage {
  uri: string           // "file:///tmp/pdf_abc123_p0.jpg"
  width: number         // pixel width after render
  height: number        // pixel height after render
  pageIndex: number     // 0-based
}
```

### Error handling

| Scenario | Behaviour |
|---|---|
| File not found / unreadable | Throw `PdfConversionError('FILE_NOT_FOUND')` |
| Corrupt / not a valid PDF | Throw `PdfConversionError('INVALID_PDF')` |
| Render failure on a page | Throw `PdfConversionError('PAGE_RENDER_FAILED', { pageIndex })` |
| Zero-page PDF | Return `[]` (no error) |

`PdfConversionError` extends `Error` with a `code: string` field for programmatic handling.

---

## 6. Test Acceptance Criteria

### Unit tests (`__tests__/unit/PdfConverter.test.ts`)

- [ ] `MockPdfConverter.convertToImages()` returns the configured page images
- [ ] `MockPdfConverter.getPageCount()` returns the configured count
- [ ] `MockPdfConverter` rejects with `PdfConversionError('INVALID_PDF')` when configured to fail
- [ ] `ProcessInvoiceUploadUseCase` calls `pdfConverter.convertToImages()` when mimeType is `application/pdf`
- [ ] `ProcessInvoiceUploadUseCase` calls `ocrAdapter.extractText()` once per page
- [ ] `ProcessInvoiceUploadUseCase` concatenates OCR text from all pages before normalization
- [ ] `ProcessInvoiceUploadUseCase` handles multi-page PDF → returns single merged `NormalizedInvoice`
- [ ] `ProcessInvoiceUploadUseCase` without `pdfConverter` → returns empty invoice for PDF (backward compat)
- [ ] Error from `pdfConverter` propagates as `Invoice processing failed: …`

### Integration tests (`__tests__/integration/ProcessInvoiceUpload.integration.test.ts`)

- [ ] Full flow: PDF file URI → `MockPdfConverter` → mock `IOcrAdapter` → `IInvoiceNormalizer` → `NormalizedInvoice` with expected vendor/total
- [ ] Multi-page PDF: both pages OCR'd, text concatenated, normalization sees full text
- [ ] Image file path unchanged: existing image upload → OCR → normalize flow still works without pdfConverter

### Manual QA

- [ ] Upload single-page PDF invoice on iOS → form auto-populated
- [ ] Upload multi-page PDF on Android → form captures data from first matching page
- [ ] Upload landscape PDF → orientation preserved (correct width/height)
- [ ] Upload corrupt/non-PDF file with `.pdf` extension → graceful error message shown to user

---

## 7. Migration / Feature Flag Notes

- **No database schema changes** are required.
- The `pdfConverter` argument is optional; existing call-sites that construct `ProcessInvoiceUploadUseCase` without it continue to work (PDFs produce empty result as before).
- A feature flag is **not required** — the converter is an additive change that degrades gracefully.

---

## 8. Open Questions

1. **Library selection**: Should we adopt `rn-pdf-renderer` (native) or write a custom native module? Evaluate licence and maintenance track record before starting implementation. If neither is acceptable, a JS-only fallback that alerts the user "PDF not supported on this device" is the safe default. ***A*** Let us `rn-pdf-renderer`.
2. **Temp file cleanup**: Where should temp JPEG files be written? Suggest `RNFS.CachesDirectoryPath + '/pdf_render/'` and clean up after each upload cycle. ***A*** agree
3. **Max pages**: Should we cap conversion at N pages (e.g., 10) to avoid memory pressure on large PDFs? Suggest a configurable `maxPages` option defaulting to 10. ***A*** yes, default 10
4. **Image format**: JPEG (smaller, lossy) vs PNG (lossless). Suggest JPEG at quality 90 for OCR purposes. ***A*** agree
