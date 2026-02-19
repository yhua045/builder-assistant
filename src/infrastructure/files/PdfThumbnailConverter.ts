/**
 * PdfThumbnailConverter — production implementation of IPdfConverter
 *
 * Renders each page of a PDF to a JPEG image using platform-native engines:
 *   • iOS  — PDFKit  (works in the iOS Simulator)
 *   • Android — PdfRenderer
 *
 * Required native dependency (rebuild the app after installation):
 *   npm install react-native-pdf-thumbnail
 *   cd ios && pod install
 *
 * Note on DPI: react-native-pdf-thumbnail renders at the PDF's native
 * resolution and does not accept a DPI override.  The `dpi` parameter of
 * `convertToImages` is accepted for interface conformance but is ignored.
 * For typical A4 invoices the native resolution is sufficient for OCR.
 */

import PdfThumbnail from 'react-native-pdf-thumbnail';
import { IPdfConverter, PdfConversionError, PdfPageImage } from './IPdfConverter';

export class PdfThumbnailConverter implements IPdfConverter {
  /**
   * Returns the total number of pages in the PDF.
   *
   * Implemented by rendering all pages and counting — acceptable for
   * invoice-sized documents (1–10 pages).  For very large PDFs prefer
   * calling `convertToImages` with a `maxPages` limit instead.
   */
  async getPageCount(pdfUri: string): Promise<number> {
    let pages: { uri: string; width: number; height: number }[];
    try {
      pages = await PdfThumbnail.generateAllPages(pdfUri);
    } catch (err: unknown) {
      this.rethrowAsConversionError(err, pdfUri);
    }
    return pages.length;
  }

  /**
   * Converts each page of the PDF into a rasterised JPEG image.
   *
   * @param pdfUri   - Local file URI (`file:///…`) of the PDF
   * @param _dpi     - Ignored (PDFKit / PdfRenderer use native resolution)
   * @param maxPages - Cap on the number of pages to return; defaults to 10
   */
  async convertToImages(
    pdfUri: string,
    _dpi = 200,
    maxPages = 10,
  ): Promise<PdfPageImage[]> {
    let allPages: { uri: string; width: number; height: number }[];
    try {
      console.log('[PdfThumbnailConverter] Rendering all pages for', pdfUri);
      allPages = await PdfThumbnail.generateAllPages(pdfUri);
      console.log('[PdfThumbnailConverter] Rendered', allPages.length, 'pages');
    } catch (err: unknown) {
      this.rethrowAsConversionError(err, pdfUri);
    }

    return allPages.slice(0, maxPages).map((page, index) => ({
      uri: page.uri,
      width: page.width,
      height: page.height,
      pageIndex: index,
    }));
  }

  // ─── private helpers ────────────────────────────────────────────────────

  private rethrowAsConversionError(err: unknown, pdfUri: string): never {
    const msg: string = (err as any)?.message ?? '';
    if (
      msg.toLowerCase().includes('no such file') ||
      msg.toLowerCase().includes('not found')
    ) {
      throw new PdfConversionError('FILE_NOT_FOUND', `PDF not found: ${pdfUri}`);
    }
    if (
      msg.toLowerCase().includes('invalid') ||
      msg.toLowerCase().includes('not a pdf') ||
      msg.toLowerCase().includes('format')
    ) {
      throw new PdfConversionError('INVALID_PDF', `Invalid PDF file: ${pdfUri}`);
    }
    throw new PdfConversionError(
      'UNKNOWN',
      `PDF conversion error: ${msg || 'unknown error'}`,
    );
  }
}
