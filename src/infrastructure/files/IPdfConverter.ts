/**
 * Represents a single rendered page from a PDF document.
 */
export interface PdfPageImage {
  /** Local file URI of the rendered JPEG/PNG image */
  uri: string;
  /** Width of the rendered image in pixels */
  width: number;
  /** Height of the rendered image in pixels */
  height: number;
  /** Zero-based page index within the source PDF */
  pageIndex: number;
}

/**
 * Structured error for PDF conversion failures.
 * Use `code` for programmatic handling in the calling use case.
 */
export class PdfConversionError extends Error {
  constructor(
    public readonly code:
      | 'FILE_NOT_FOUND'
      | 'INVALID_PDF'
      | 'PAGE_RENDER_FAILED'
      | 'UNKNOWN',
    message: string,
    public readonly pageIndex?: number,
  ) {
    super(message);
    this.name = 'PdfConversionError';
  }
}

/**
 * Platform-agnostic interface for converting PDF documents into raster images.
 *
 * Production code uses `MobilePdfConverter` (backed by iOS PDFKit / Android PdfRenderer).
 * Tests use `MockPdfConverter` to avoid native dependencies.
 *
 * **Dependency flow**: Use cases depend on this interface only; they must not
 * import any concrete implementation directly.
 */
export interface IPdfConverter {
  /**
   * Convert every page of a PDF into a raster image (JPEG or PNG).
   *
   * @param pdfUri  - App-private local file URI (e.g. `file:///data/.../invoice.pdf`)
   * @param dpi     - Render resolution; defaults to 200.  Clamped to [72, 300].
   * @param maxPages - Maximum number of pages to convert; defaults to 10.
   *
   * @returns An array of `PdfPageImage` records, one per converted page, in
   *          page order.  Returns an empty array for a zero-page document.
   *
   * @throws `PdfConversionError` with code `FILE_NOT_FOUND` if the URI is
   *          not accessible.
   * @throws `PdfConversionError` with code `INVALID_PDF` if the file is not
   *          a valid PDF document.
   * @throws `PdfConversionError` with code `PAGE_RENDER_FAILED` if a
   *          specific page cannot be rendered (includes `pageIndex`).
   */
  convertToImages(
    pdfUri: string,
    dpi?: number,
    maxPages?: number,
  ): Promise<PdfPageImage[]>;

  /**
   * Return the total number of pages in the PDF without rendering any page.
   *
   * @param pdfUri - App-private local file URI
   * @throws `PdfConversionError` with code `FILE_NOT_FOUND` or `INVALID_PDF`
   */
  getPageCount(pdfUri: string): Promise<number>;
}
