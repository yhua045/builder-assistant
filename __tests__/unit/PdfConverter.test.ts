import { MockPdfConverter } from '../../__mocks__/MockPdfConverter';
import {
  PdfConversionError,
  PdfPageImage,
} from '../../src/infrastructure/files/IPdfConverter';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makePage(pageIndex: number): PdfPageImage {
  return {
    uri: `file:///tmp/pdf_mock_p${pageIndex}.jpg`,
    width: 1240,
    height: 1754,
    pageIndex,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// MockPdfConverter specs
// ─────────────────────────────────────────────────────────────────────────────

describe('MockPdfConverter', () => {
  describe('convertToImages', () => {
    it('returns the configured pages by default', async () => {
      const converter = new MockPdfConverter();
      const pages = await converter.convertToImages('file:///any.pdf');

      expect(pages).toHaveLength(1);
      expect(pages[0].pageIndex).toBe(0);
      expect(pages[0].uri).toMatch(/\.jpg$/);
    });

    it('returns multi-page images when configured', async () => {
      const converter = new MockPdfConverter([makePage(0), makePage(1), makePage(2)]);
      const pages = await converter.convertToImages('file:///any.pdf');
      expect(pages).toHaveLength(3);
      expect(pages.map(p => p.pageIndex)).toEqual([0, 1, 2]);
    });

    it('respects the maxPages limit', async () => {
      const converter = new MockPdfConverter([makePage(0), makePage(1), makePage(2)]);
      const pages = await converter.convertToImages('file:///any.pdf', 200, 2);
      expect(pages).toHaveLength(2);
    });

    it('returns empty array for a zero-page document', async () => {
      const converter = new MockPdfConverter([]);
      const pages = await converter.convertToImages('file:///empty.pdf');
      expect(pages).toHaveLength(0);
    });

    it('throws PdfConversionError when configured to fail', async () => {
      const converter = new MockPdfConverter(
        [makePage(0)],
        true,
        'INVALID_PDF',
        'Not a valid PDF',
      );
      await expect(converter.convertToImages('file:///bad.pdf')).rejects.toThrow(
        PdfConversionError,
      );
    });

    it('throws error with the configured code', async () => {
      const converter = new MockPdfConverter(
        [makePage(0)],
        true,
        'FILE_NOT_FOUND',
        'File missing',
      );
      const err = await converter.convertToImages('file:///missing.pdf').catch(e => e);
      expect(err).toBeInstanceOf(PdfConversionError);
      expect((err as PdfConversionError).code).toBe('FILE_NOT_FOUND');
    });
  });

  describe('getPageCount', () => {
    it('returns the number of configured pages', async () => {
      const converter = new MockPdfConverter([makePage(0), makePage(1)]);
      expect(await converter.getPageCount('file:///any.pdf')).toBe(2);
    });

    it('returns 0 for empty page list', async () => {
      const converter = new MockPdfConverter([]);
      expect(await converter.getPageCount('file:///any.pdf')).toBe(0);
    });

    it('throws PdfConversionError when configured to fail', async () => {
      const converter = new MockPdfConverter([makePage(0)], true, 'INVALID_PDF', 'Bad PDF');
      await expect(converter.getPageCount('file:///bad.pdf')).rejects.toThrow(
        PdfConversionError,
      );
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PdfConversionError specs
// ─────────────────────────────────────────────────────────────────────────────

describe('PdfConversionError', () => {
  it('has name PdfConversionError', () => {
    const err = new PdfConversionError('INVALID_PDF', 'bad pdf');
    expect(err.name).toBe('PdfConversionError');
  });

  it('stores the code', () => {
    const err = new PdfConversionError('FILE_NOT_FOUND', 'missing');
    expect(err.code).toBe('FILE_NOT_FOUND');
  });

  it('stores the optional pageIndex', () => {
    const err = new PdfConversionError('PAGE_RENDER_FAILED', 'render failed', 2);
    expect(err.pageIndex).toBe(2);
  });

  it('is an instance of Error', () => {
    const err = new PdfConversionError('UNKNOWN', 'oops');
    expect(err).toBeInstanceOf(Error);
  });
});
