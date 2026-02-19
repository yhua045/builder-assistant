import {
  IPdfConverter,
  PdfConversionError,
  PdfPageImage,
} from '../src/infrastructure/files/IPdfConverter';

/**
 * Configurable in-memory mock for `IPdfConverter`.
 *
 * Use this in unit and integration tests to avoid native dependencies.
 *
 * @example
 * const mock = new MockPdfConverter([
 *   { uri: 'file:///tmp/p0.jpg', width: 1240, height: 1754, pageIndex: 0 },
 * ]);
 * const pages = await mock.convertToImages('file:///any.pdf');
 * // pages === [ { uri: 'file:///tmp/p0.jpg', ... } ]
 */
export class MockPdfConverter implements IPdfConverter {
  private readonly pages: PdfPageImage[];
  private readonly shouldFail: boolean;
  private readonly failCode: PdfConversionError['code'];
  private readonly failMessage: string;

  /**
   * @param pages      Pages to simulate (defaults to a single 1240×1754 A4 page)
   * @param shouldFail When true, both methods throw a `PdfConversionError`
   * @param failCode   Error code to throw when `shouldFail` is true
   * @param failMessage Error message to use when `shouldFail` is true
   */
  constructor(
    pages: PdfPageImage[] = [
      {
        uri: 'file:///tmp/pdf_mock_p0.jpg',
        width: 1240,
        height: 1754,
        pageIndex: 0,
      },
    ],
    shouldFail = false,
    failCode: PdfConversionError['code'] = 'INVALID_PDF',
    failMessage = 'Mock PDF conversion failure',
  ) {
    this.pages = pages;
    this.shouldFail = shouldFail;
    this.failCode = failCode;
    this.failMessage = failMessage;
  }

  async convertToImages(
    _pdfUri: string,
    _dpi?: number,
    maxPages?: number,
  ): Promise<PdfPageImage[]> {
    if (this.shouldFail) {
      throw new PdfConversionError(this.failCode, this.failMessage);
    }
    const limit = maxPages ?? this.pages.length;
    return this.pages.slice(0, limit);
  }

  async getPageCount(_pdfUri: string): Promise<number> {
    if (this.shouldFail) {
      throw new PdfConversionError(this.failCode, this.failMessage);
    }
    return this.pages.length;
  }
}
