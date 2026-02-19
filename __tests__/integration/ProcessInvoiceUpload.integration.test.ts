/**
 * Integration tests for the PDF → Convert → OCR → Extract pipeline.
 *
 * These tests exercise the full flow through ProcessInvoiceUploadUseCase
 * using MockPdfConverter and a mock IOcrAdapter — no native dependencies.
 */
import { ProcessInvoiceUploadUseCase } from '../../src/application/usecases/invoice/ProcessInvoiceUploadUseCase';
import { IOcrAdapter, OcrResult } from '../../src/application/services/IOcrAdapter';
import {
  IInvoiceNormalizer,
  InvoiceCandidates,
  NormalizedInvoice,
} from '../../src/application/ai/IInvoiceNormalizer';
import { MockPdfConverter } from '../../__mocks__/MockPdfConverter';
import { PdfPageImage } from '../../src/infrastructure/files/IPdfConverter';

// ─────────────────────────────────────────────────────────────────────────────
// Stub factories
// ─────────────────────────────────────────────────────────────────────────────

function makeOcrResult(text: string, imageUri: string): OcrResult {
  return { fullText: text, tokens: [], imageUri };
}

function makeNormalized(vendor: string, total: number): NormalizedInvoice {
  return {
    vendor,
    invoiceNumber: 'INV-001',
    invoiceDate: new Date('2026-01-15'),
    dueDate: null,
    subtotal: total * 0.9,
    tax: total * 0.1,
    total,
    currency: 'USD',
    lineItems: [],
    confidence: { overall: 0.9, vendor: 0.9, invoiceNumber: 0.8, invoiceDate: 0.8, total: 0.95 },
    suggestedCorrections: [],
  };
}

function makeEmptyCandidates(): InvoiceCandidates {
  return {
    vendors: [],
    invoiceNumbers: [],
    dates: [],
    dueDates: [],
    amounts: [],
    subtotals: [],
    taxAmounts: [],
    lineItems: [],
  };
}

function makeStubNormalizer(normalized: NormalizedInvoice): jest.Mocked<IInvoiceNormalizer> {
  return {
    extractCandidates: jest.fn().mockReturnValue(makeEmptyCandidates()),
    normalize: jest.fn().mockResolvedValue(normalized),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

describe('ProcessInvoiceUpload — PDF conversion integration', () => {
  const pdfInput = {
    fileUri: 'file:///app/documents/invoice.pdf',
    filename: 'invoice.pdf',
    mimeType: 'application/pdf',
    fileSize: 102400,
  };

  describe('single-page PDF → convert → OCR → extract', () => {
    it('extracts vendor and total from a single-page PDF invoice', async () => {
      const page: PdfPageImage = {
        uri: 'file:///tmp/pdf_single_p0.jpg',
        width: 1240,
        height: 1754,
        pageIndex: 0,
      };
      const pdfConverter = new MockPdfConverter([page]);

      const ocrAdapter: jest.Mocked<IOcrAdapter> = {
        extractText: jest.fn().mockResolvedValueOnce(
          makeOcrResult('ACME Supplies\nInvoice #INV-001\nTotal: $1,250.00', page.uri),
        ),
      };

      const normalized = makeNormalized('ACME Supplies', 1250);
      const normalizer = makeStubNormalizer(normalized);

      const useCase = new ProcessInvoiceUploadUseCase(ocrAdapter, normalizer, pdfConverter);
      const result = await useCase.execute(pdfInput);

      expect(result.normalized.vendor).toBe('ACME Supplies');
      expect(result.normalized.total).toBe(1250);
      expect(ocrAdapter.extractText).toHaveBeenCalledTimes(1);
      expect(ocrAdapter.extractText).toHaveBeenCalledWith(page.uri);
    });

    it('passes OCR text through normalizer', async () => {
      const page: PdfPageImage = {
        uri: 'file:///tmp/pdf_p0.jpg',
        width: 1240,
        height: 1754,
        pageIndex: 0,
      };
      const pdfConverter = new MockPdfConverter([page]);

      const ocrText = 'Vendor Corp\nInvoice #V-789\nTotal: $300.00';
      const ocrAdapter: jest.Mocked<IOcrAdapter> = {
        extractText: jest.fn().mockResolvedValueOnce(makeOcrResult(ocrText, page.uri)),
      };
      const normalized = makeNormalized('Vendor Corp', 300);
      const normalizer = makeStubNormalizer(normalized);

      const useCase = new ProcessInvoiceUploadUseCase(ocrAdapter, normalizer, pdfConverter);
      await useCase.execute(pdfInput);

      expect(normalizer.extractCandidates).toHaveBeenCalledWith(
        expect.stringContaining('Vendor Corp'),
      );
    });

    it('documentRef reflects the original PDF input, not the converted image', async () => {
      const page: PdfPageImage = {
        uri: 'file:///tmp/pdf_p0.jpg',
        width: 1240,
        height: 1754,
        pageIndex: 0,
      };
      const pdfConverter = new MockPdfConverter([page]);
      const ocrAdapter: jest.Mocked<IOcrAdapter> = {
        extractText: jest.fn().mockResolvedValueOnce(makeOcrResult('text', page.uri)),
      };
      const normalizer = makeStubNormalizer(makeNormalized('X', 100));

      const useCase = new ProcessInvoiceUploadUseCase(ocrAdapter, normalizer, pdfConverter);
      const result = await useCase.execute(pdfInput);

      expect(result.documentRef.localPath).toBe(pdfInput.fileUri);
      expect(result.documentRef.mimeType).toBe('application/pdf');
    });
  });

  describe('multi-page PDF → convert → OCR → extract', () => {
    it('OCRs each page and combines text for normalization', async () => {
      const pages: PdfPageImage[] = [
        { uri: 'file:///tmp/mp_p0.jpg', width: 1240, height: 1754, pageIndex: 0 },
        { uri: 'file:///tmp/mp_p1.jpg', width: 1240, height: 1754, pageIndex: 1 },
      ];
      const pdfConverter = new MockPdfConverter(pages);

      const ocrAdapter: jest.Mocked<IOcrAdapter> = {
        extractText: jest.fn()
          .mockResolvedValueOnce(makeOcrResult('Header text page 0', pages[0].uri))
          .mockResolvedValueOnce(makeOcrResult('Footer text page 1', pages[1].uri)),
      };
      const normalizer = makeStubNormalizer(makeNormalized('Multi Corp', 2000));

      const useCase = new ProcessInvoiceUploadUseCase(ocrAdapter, normalizer, pdfConverter);
      const result = await useCase.execute(pdfInput);

      expect(ocrAdapter.extractText).toHaveBeenCalledTimes(2);
      expect(ocrAdapter.extractText).toHaveBeenNthCalledWith(1, pages[0].uri);
      expect(ocrAdapter.extractText).toHaveBeenNthCalledWith(2, pages[1].uri);

      // Combined text must be passed to the normalizer
      const combinedText: string = normalizer.extractCandidates.mock.calls[0][0];
      expect(combinedText).toContain('Header text page 0');
      expect(combinedText).toContain('Footer text page 1');

      expect(result.normalized.vendor).toBe('Multi Corp');
    });

    it('returns the combined rawOcrText in the output', async () => {
      const pages: PdfPageImage[] = [
        { uri: 'file:///tmp/rp0.jpg', width: 1240, height: 1754, pageIndex: 0 },
        { uri: 'file:///tmp/rp1.jpg', width: 1240, height: 1754, pageIndex: 1 },
      ];
      const pdfConverter = new MockPdfConverter(pages);

      const ocrAdapter: jest.Mocked<IOcrAdapter> = {
        extractText: jest.fn()
          .mockResolvedValueOnce(makeOcrResult('Page 0 content', pages[0].uri))
          .mockResolvedValueOnce(makeOcrResult('Page 1 content', pages[1].uri)),
      };
      const normalizer = makeStubNormalizer(makeNormalized('X', 50));

      const useCase = new ProcessInvoiceUploadUseCase(ocrAdapter, normalizer, pdfConverter);
      const result = await useCase.execute(pdfInput);

      expect(result.rawOcrText).toContain('Page 0 content');
      expect(result.rawOcrText).toContain('Page 1 content');
    });
  });

  describe('image file upload — unchanged behaviour', () => {
    it('processes image uploads without a pdfConverter (existing flow)', async () => {
      const imageInput = {
        fileUri: 'file:///app/documents/receipt.jpg',
        filename: 'receipt.jpg',
        mimeType: 'image/jpeg',
        fileSize: 200000,
      };
      const ocrAdapter: jest.Mocked<IOcrAdapter> = {
        extractText: jest.fn().mockResolvedValueOnce(
          makeOcrResult('BuildMax Store\nTotal: $89.50', imageInput.fileUri),
        ),
      };
      const normalized = makeNormalized('BuildMax Store', 89.5);
      const normalizer = makeStubNormalizer(normalized);

      // No pdfConverter supplied — standard image path
      const useCase = new ProcessInvoiceUploadUseCase(ocrAdapter, normalizer);
      const result = await useCase.execute(imageInput);

      expect(ocrAdapter.extractText).toHaveBeenCalledWith(imageInput.fileUri);
      expect(result.normalized.vendor).toBe('BuildMax Store');
      expect(result.normalized.total).toBe(89.5);
    });
  });

  describe('zero-page PDF', () => {
    it('returns empty rawOcrText and does not call OCR for a zero-page PDF', async () => {
      const pdfConverter = new MockPdfConverter([]); // empty
      const ocrAdapter: jest.Mocked<IOcrAdapter> = { extractText: jest.fn() };
      const normalizer = makeStubNormalizer(makeNormalized('X', 0));

      const useCase = new ProcessInvoiceUploadUseCase(ocrAdapter, normalizer, pdfConverter);
      const result = await useCase.execute(pdfInput);

      expect(ocrAdapter.extractText).not.toHaveBeenCalled();
      expect(result.rawOcrText).toBe('');
    });
  });
});
