/**
 * MobilePdfConverter — production implementation of IPdfConverter
 *
 * Renders each page of a PDF to a JPEG image using platform-native renderers:
 *   • iOS  — PDFKit (via rn-pdf-renderer native module)
 *   • Android — PdfRenderer (via rn-pdf-renderer native module)
 *
 * Required native dependency
 * ──────────────────────────
 *   npm install rn-pdf-renderer
 *   cd ios && pod install
 *
 * Until rn-pdf-renderer is installed, this class throws
 * `PdfConversionError('UNKNOWN', 'Native PDF renderer is not available …')`
 * so callers can detect the missing dependency at runtime.
 *
 * See design/issue-87-pdf-converter.md for full design rationale.
 */

import RNFS from 'react-native-fs';
import { IPdfConverter, PdfConversionError, PdfPageImage } from './IPdfConverter';

/** Minimal interface for the rn-pdf-renderer native module. */
interface RnPdfRenderer {
  /** Returns total page count without rendering. */
  getPageCount(pdfPath: string): Promise<number>;
  /**
   * Renders a single page to a JPEG file and returns the output path.
   * @param pdfPath    - Absolute path to the PDF (no file:// prefix)
   * @param pageIndex  - Zero-based page index
   * @param outputPath - Absolute path where the JPEG should be written
   * @param scale      - Scale factor relative to 72-DPI baseline (e.g. 2.78 ≈ 200 DPI)
   */
  renderPage(
    pdfPath: string,
    pageIndex: number,
    outputPath: string,
    scale: number,
  ): Promise<{ width: number; height: number }>;
}

/** Lazily required so the module is not imported at module-evaluation time. */
function tryLoadRenderer(): RnPdfRenderer | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('rn-pdf-renderer').default as RnPdfRenderer;
  } catch {
    return null;
  }
}

/** Convert a DPI value into a scale factor relative to the 72-DPI PDF baseline. */
function dpiToScale(dpi: number): number {
  return dpi / 72;
}

/** Strip the `file://` scheme from a URI to obtain a plain filesystem path. */
function toFsPath(uri: string): string {
  return uri.replace(/^file:\/\//, '');
}

export class MobilePdfConverter implements IPdfConverter {
  private readonly renderer: RnPdfRenderer | null;

  /**
   * @param renderer - Optional native renderer override (useful for tests or
   *                   manual dependency injection).  Defaults to dynamic
   *                   require of `rn-pdf-renderer`.
   */
  constructor(renderer?: RnPdfRenderer) {
    this.renderer = renderer ?? tryLoadRenderer();
  }

  async getPageCount(pdfUri: string): Promise<number> {
    const renderer = this.requireRenderer();
    const pdfPath = toFsPath(pdfUri);

    try {
      return await renderer.getPageCount(pdfPath);
    } catch (err: any) {
      this.rethrowAsConversionError(err, pdfPath);
    }
  }

  async convertToImages(
    pdfUri: string,
    dpi = 200,
    maxPages = 10,
  ): Promise<PdfPageImage[]> {
    const renderer = this.requireRenderer();
    const pdfPath = toFsPath(pdfUri);

    // Ensure the temporary output directory exists
    const outDir = `${RNFS.CachesDirectoryPath}/pdf_render`;
    const dirExists = await RNFS.exists(outDir);
    if (!dirExists) {
      await RNFS.mkdir(outDir);
    }

    let totalPages: number;
    try {
      totalPages = await renderer.getPageCount(pdfPath);
    } catch (err: any) {
      this.rethrowAsConversionError(err, pdfPath);
    }

    if (totalPages === 0) {
      return [];
    }

    const clampedDpi = Math.min(300, Math.max(72, dpi));
    const scale = dpiToScale(clampedDpi);
    const pagesToConvert = Math.min(totalPages, maxPages);
    const pages: PdfPageImage[] = [];

    for (let i = 0; i < pagesToConvert; i++) {
      const uniqueId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const outputPath = `${outDir}/pdf_${uniqueId}_p${i}.jpg`;

      try {
        const { width, height } = await renderer.renderPage(pdfPath, i, outputPath, scale);
        pages.push({
          uri: `file://${outputPath}`,
          width,
          height,
          pageIndex: i,
        });
      } catch (err: any) {
        throw new PdfConversionError(
          'PAGE_RENDER_FAILED',
          `Failed to render page ${i}: ${err?.message ?? 'unknown error'}`,
          i,
        );
      }
    }

    return pages;
  }

  // ─── private helpers ────────────────────────────────────────────────────

  /**
   * Assert the renderer is available, throw a helpful error if not.
   */
  private requireRenderer(): RnPdfRenderer {
    if (!this.renderer) {
      throw new PdfConversionError(
        'UNKNOWN',
        'Native PDF renderer is not available. ' +
          'Install rn-pdf-renderer (`npm install rn-pdf-renderer && cd ios && pod install`) ' +
          'and rebuild the app.',
      );
    }
    return this.renderer;
  }

  /**
   * Map native renderer errors to typed `PdfConversionError` codes.
   * Always throws — return type is `never` to satisfy TypeScript exhaustiveness.
   */
  private rethrowAsConversionError(err: any, pdfPath: string): never {
    const msg: string = err?.message ?? '';
    if (msg.toLowerCase().includes('no such file') || msg.toLowerCase().includes('not found')) {
      throw new PdfConversionError('FILE_NOT_FOUND', `PDF not found: ${pdfPath}`);
    }
    if (
      msg.toLowerCase().includes('invalid') ||
      msg.toLowerCase().includes('not a pdf') ||
      msg.toLowerCase().includes('format')
    ) {
      throw new PdfConversionError('INVALID_PDF', `Invalid PDF file: ${pdfPath}`);
    }
    throw new PdfConversionError('UNKNOWN', `PDF conversion error: ${msg}`);
  }
}
