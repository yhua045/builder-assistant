import { ProcessInvoiceUploadUseCase } from '../../src/application/usecases/invoice/ProcessInvoiceUploadUseCase';
import { IOcrAdapter, OcrResult } from '../../src/application/services/IOcrAdapter';
import {
  IInvoiceNormalizer,
  InvoiceCandidates,
  NormalizedInvoice,
} from '../../src/application/ai/IInvoiceNormalizer';
import { MockPdfConverter } from '../../__mocks__/MockPdfConverter';
import { PdfConversionError, PdfPageImage } from '../../src/infrastructure/files/IPdfConverter';

const makeOcrResult = (text = 'Acme Corp\nInvoice #INV-001\nTotal: $500.00'): OcrResult => ({
  fullText: text,
  tokens: [],
  imageUri: 'file:///app/invoice.jpg',
});

const makeNormalized = (): NormalizedInvoice => ({
  vendor: 'Acme Corp',
  invoiceNumber: 'INV-001',
  invoiceDate: new Date('2026-01-15'),
  dueDate: new Date('2026-02-15'),
  subtotal: 450,
  tax: 50,
  total: 500,
  currency: 'USD',
  lineItems: [],
  confidence: { overall: 0.9, vendor: 0.9, invoiceNumber: 0.9, invoiceDate: 0.8, total: 0.95 },
  suggestedCorrections: [],
});

const makeEmptyCandidates = (): InvoiceCandidates => ({
  vendors: [],
  invoiceNumbers: [],
  dates: [],
  dueDates: [],
  amounts: [],
  subtotals: [],
  taxAmounts: [],
  lineItems: [],
});

function makeMockOcr(result?: OcrResult, error?: Error): jest.Mocked<IOcrAdapter> {
  return {
    extractText: error
      ? jest.fn().mockRejectedValue(error)
      : jest.fn().mockResolvedValue(result ?? makeOcrResult()),
  };
}

function makeMockNormalizer(
  normalized?: NormalizedInvoice,
  error?: Error,
): jest.Mocked<IInvoiceNormalizer> {
  return {
    extractCandidates: jest.fn().mockReturnValue(makeEmptyCandidates()),
    normalize: error
      ? jest.fn().mockRejectedValue(error)
      : jest.fn().mockResolvedValue(normalized ?? makeNormalized()),
  };
}

describe('ProcessInvoiceUploadUseCase', () => {
  const baseInput = {
    fileUri: 'file:///app/documents/invoice_001.jpg',
    filename: 'invoice_001.jpg',
    mimeType: 'image/jpeg',
    fileSize: 512000,
  };

  describe('success path', () => {
    it('returns normalized invoice and documentRef on success', async () => {
      const ocrAdapter = makeMockOcr(makeOcrResult());
      const normalizer = makeMockNormalizer(makeNormalized());
      const useCase = new ProcessInvoiceUploadUseCase(ocrAdapter, normalizer);

      const result = await useCase.execute(baseInput);

      expect(result.normalized.vendor).toBe('Acme Corp');
      expect(result.normalized.total).toBe(500);
      expect(result.documentRef).toEqual({
        localPath: baseInput.fileUri,
        filename: baseInput.filename,
        size: baseInput.fileSize,
        mimeType: baseInput.mimeType,
      });
    });

    it('calls ocrAdapter.extractText with the provided fileUri', async () => {
      const ocrAdapter = makeMockOcr(makeOcrResult());
      const normalizer = makeMockNormalizer();
      const useCase = new ProcessInvoiceUploadUseCase(ocrAdapter, normalizer);

      await useCase.execute(baseInput);

      expect(ocrAdapter.extractText).toHaveBeenCalledWith(baseInput.fileUri);
    });

    it('calls normalizer.extractCandidates with OCR full text', async () => {
      const ocrResult = makeOcrResult('Some OCR text');
      const ocrAdapter = makeMockOcr(ocrResult);
      const normalizer = makeMockNormalizer();
      const useCase = new ProcessInvoiceUploadUseCase(ocrAdapter, normalizer);

      await useCase.execute(baseInput);

      expect(normalizer.extractCandidates).toHaveBeenCalledWith('Some OCR text');
    });

    it('calls normalizer.normalize with candidates and ocrResult', async () => {
      const ocrResult = makeOcrResult();
      const candidates = makeEmptyCandidates();
      const ocrAdapter = makeMockOcr(ocrResult);
      const normalizer = makeMockNormalizer();
      normalizer.extractCandidates.mockReturnValue(candidates);
      const useCase = new ProcessInvoiceUploadUseCase(ocrAdapter, normalizer);

      await useCase.execute(baseInput);

      expect(normalizer.normalize).toHaveBeenCalledWith(candidates, ocrResult);
    });

    it('returns the raw OCR text in output', async () => {
      const ocrResult = makeOcrResult('Invoice text here');
      const ocrAdapter = makeMockOcr(ocrResult);
      const normalizer = makeMockNormalizer();
      const useCase = new ProcessInvoiceUploadUseCase(ocrAdapter, normalizer);

      const result = await useCase.execute(baseInput);

      expect(result.rawOcrText).toBe('Invoice text here');
    });
  });

  describe('PDF files (OCR skip — no converter provided)', () => {
    it('skips OCR for PDF files and returns empty normalized invoice', async () => {
      const ocrAdapter = makeMockOcr();
      const normalizer = makeMockNormalizer();
      const useCase = new ProcessInvoiceUploadUseCase(ocrAdapter, normalizer);

      const result = await useCase.execute({
        ...baseInput,
        mimeType: 'application/pdf',
        filename: 'invoice.pdf',
      });

      expect(ocrAdapter.extractText).not.toHaveBeenCalled();
      expect(normalizer.normalize).not.toHaveBeenCalled();
      expect(result.normalized.total).toBeNull();
      expect(result.normalized.vendor).toBeNull();
      expect(result.rawOcrText).toBe('');
    });

    it('includes a suggestion about PDF not being supported', async () => {
      const ocrAdapter = makeMockOcr();
      const normalizer = makeMockNormalizer();
      const useCase = new ProcessInvoiceUploadUseCase(ocrAdapter, normalizer);

      const result = await useCase.execute({ ...baseInput, mimeType: 'application/pdf' });

      expect(result.normalized.suggestedCorrections).toContainEqual(
        expect.stringContaining('PDF'),
      );
    });
  });

  describe('OCR failure', () => {
    it('throws an error when OCR adapter fails', async () => {
      const ocrAdapter = makeMockOcr(undefined, new Error('Camera unavailable'));
      const normalizer = makeMockNormalizer();
      const useCase = new ProcessInvoiceUploadUseCase(ocrAdapter, normalizer);

      await expect(useCase.execute(baseInput)).rejects.toThrow(
        'Invoice processing failed',
      );
    });

    it('includes the original error message in the thrown error', async () => {
      const ocrAdapter = makeMockOcr(undefined, new Error('Network timeout'));
      const normalizer = makeMockNormalizer();
      const useCase = new ProcessInvoiceUploadUseCase(ocrAdapter, normalizer);

      await expect(useCase.execute(baseInput)).rejects.toThrow('Network timeout');
    });

    it('does not call normalizer when OCR fails', async () => {
      const ocrAdapter = makeMockOcr(undefined, new Error('OCR error'));
      const normalizer = makeMockNormalizer();
      const useCase = new ProcessInvoiceUploadUseCase(ocrAdapter, normalizer);

      await expect(useCase.execute(baseInput)).rejects.toThrow();

      expect(normalizer.normalize).not.toHaveBeenCalled();
    });
  });

  describe('normalization failure', () => {
    it('throws an error when normalizer fails', async () => {
      const ocrAdapter = makeMockOcr(makeOcrResult());
      const normalizer = makeMockNormalizer(undefined, new Error('Model not loaded'));
      const useCase = new ProcessInvoiceUploadUseCase(ocrAdapter, normalizer);

      await expect(useCase.execute(baseInput)).rejects.toThrow(
        'Invoice processing failed',
      );
    });

    it('includes the normalizer error message', async () => {
      const ocrAdapter = makeMockOcr(makeOcrResult());
      const normalizer = makeMockNormalizer(undefined, new Error('Model not loaded'));
      const useCase = new ProcessInvoiceUploadUseCase(ocrAdapter, normalizer);

      await expect(useCase.execute(baseInput)).rejects.toThrow('Model not loaded');
    });
  });

  describe('empty OCR text', () => {
    it('still calls normalizer even when OCR text is empty', async () => {
      const emptyOcrResult = makeOcrResult('');
      const ocrAdapter = makeMockOcr(emptyOcrResult);
      const normalizer = makeMockNormalizer();
      const useCase = new ProcessInvoiceUploadUseCase(ocrAdapter, normalizer);

      await useCase.execute(baseInput);

      expect(normalizer.extractCandidates).toHaveBeenCalledWith('');
      expect(normalizer.normalize).toHaveBeenCalled();
    });
  });

  describe('documentRef', () => {
    it('documentRef always reflects the input file metadata', async () => {
      const ocrAdapter = makeMockOcr();
      const normalizer = makeMockNormalizer();
      const useCase = new ProcessInvoiceUploadUseCase(ocrAdapter, normalizer);

      const input = {
        fileUri: 'file:///custom/path/inv.jpg',
        filename: 'inv.jpg',
        mimeType: 'image/jpeg',
        fileSize: 999999,
      };

      const result = await useCase.execute(input);

      expect(result.documentRef).toEqual({
        localPath: input.fileUri,
        filename: input.filename,
        size: input.fileSize,
        mimeType: input.mimeType,
      });
    });
  });

  // ─── PDF path WITH converter ───────────────────────────────────────────────

  describe('PDF files (with IPdfConverter provided)', () => {
    const pdfInput = {
      fileUri: 'file:///app/documents/invoice.pdf',
      filename: 'invoice.pdf',
      mimeType: 'application/pdf',
      fileSize: 102400,
    };

    function makePageOcrResult(text: string, pageIndex: number): OcrResult {
      return {
        fullText: text,
        tokens: [],
        imageUri: `file:///tmp/pdf_mock_p${pageIndex}.jpg`,
      };
    }

    it('calls pdfConverter.convertToImages with the PDF URI', async () => {
      const pdfConverter = new MockPdfConverter();
      const ocrAdapter = makeMockOcr(makePageOcrResult('Acme Corp\nTotal: $100', 0));
      const normalizer = makeMockNormalizer(makeNormalized());
      const useCase = new ProcessInvoiceUploadUseCase(ocrAdapter, normalizer, pdfConverter);

      await useCase.execute(pdfInput);

      // Verify OCR was called with the converted image URI (not the PDF URI)
      expect(ocrAdapter.extractText).toHaveBeenCalledWith('file:///tmp/pdf_mock_p0.jpg');
      expect(ocrAdapter.extractText).not.toHaveBeenCalledWith(pdfInput.fileUri);
    });

    it('calls ocrAdapter.extractText once per page for a single-page PDF', async () => {
      const pdfConverter = new MockPdfConverter([
        { uri: 'file:///tmp/p0.jpg', width: 1240, height: 1754, pageIndex: 0 },
      ]);
      const ocrAdapter = makeMockOcr(makePageOcrResult('Invoice text p0', 0));
      const normalizer = makeMockNormalizer(makeNormalized());
      const useCase = new ProcessInvoiceUploadUseCase(ocrAdapter, normalizer, pdfConverter);

      await useCase.execute(pdfInput);

      expect(ocrAdapter.extractText).toHaveBeenCalledTimes(1);
    });

    it('calls ocrAdapter.extractText once per page for a multi-page PDF', async () => {
      const pdfConverter = new MockPdfConverter([
        { uri: 'file:///tmp/p0.jpg', width: 1240, height: 1754, pageIndex: 0 },
        { uri: 'file:///tmp/p1.jpg', width: 1240, height: 1754, pageIndex: 1 },
        { uri: 'file:///tmp/p2.jpg', width: 1240, height: 1754, pageIndex: 2 },
      ]);
      const ocrAdapter: jest.Mocked<IOcrAdapter> = {
        extractText: jest.fn()
          .mockResolvedValueOnce(makePageOcrResult('Page 0 text', 0))
          .mockResolvedValueOnce(makePageOcrResult('Page 1 text', 1))
          .mockResolvedValueOnce(makePageOcrResult('Page 2 text', 2)),
      };
      const normalizer = makeMockNormalizer(makeNormalized());
      const useCase = new ProcessInvoiceUploadUseCase(ocrAdapter, normalizer, pdfConverter);

      await useCase.execute(pdfInput);

      expect(ocrAdapter.extractText).toHaveBeenCalledTimes(3);
    });

    it('concatenates OCR text from all pages before normalization', async () => {
      const pdfConverter = new MockPdfConverter([
        { uri: 'file:///tmp/p0.jpg', width: 1240, height: 1754, pageIndex: 0 },
        { uri: 'file:///tmp/p1.jpg', width: 1240, height: 1754, pageIndex: 1 },
      ]);
      const ocrAdapter: jest.Mocked<IOcrAdapter> = {
        extractText: jest.fn()
          .mockResolvedValueOnce(makePageOcrResult('Page zero text', 0))
          .mockResolvedValueOnce(makePageOcrResult('Page one text', 1)),
      };
      const normalizer = makeMockNormalizer(makeNormalized());
      const useCase = new ProcessInvoiceUploadUseCase(ocrAdapter, normalizer, pdfConverter);

      await useCase.execute(pdfInput);

      const combinedText: string = normalizer.extractCandidates.mock.calls[0][0];
      expect(combinedText).toContain('Page zero text');
      expect(combinedText).toContain('Page one text');
    });

    it('passes merged OCR result from all pages to normalizer.normalize', async () => {
      const pdfConverter = new MockPdfConverter([
        { uri: 'file:///tmp/p0.jpg', width: 1240, height: 1754, pageIndex: 0 },
        { uri: 'file:///tmp/p1.jpg', width: 1240, height: 1754, pageIndex: 1 },
      ]);
      const ocrAdapter: jest.Mocked<IOcrAdapter> = {
        extractText: jest.fn()
          .mockResolvedValueOnce({
            fullText: 'Invoice header page 1',
            tokens: [{ text: 'header', confidence: 1, bounds: { x: 1, y: 1, width: 10, height: 10 } }],
            imageUri: 'file:///tmp/p0.jpg',
          })
          .mockResolvedValueOnce({
            fullText: 'Total due page 2',
            tokens: [{ text: 'total', confidence: 1, bounds: { x: 2, y: 2, width: 10, height: 10 } }],
            imageUri: 'file:///tmp/p1.jpg',
          }),
      };
      const normalizer = makeMockNormalizer(makeNormalized());
      const useCase = new ProcessInvoiceUploadUseCase(ocrAdapter, normalizer, pdfConverter);

      await useCase.execute(pdfInput);

      const normalizeArg = normalizer.normalize.mock.calls[0][1];
      expect(normalizeArg.fullText).toContain('Invoice header page 1');
      expect(normalizeArg.fullText).toContain('Total due page 2');
      expect(normalizeArg.tokens).toHaveLength(2);
    });

    it('returns a NormalizedInvoice (not empty) for a PDF with converter', async () => {
      const pdfConverter = new MockPdfConverter();
      const ocrAdapter = makeMockOcr(makePageOcrResult('Acme Corp\nTotal: $500', 0));
      const normalizer = makeMockNormalizer(makeNormalized());
      const useCase = new ProcessInvoiceUploadUseCase(ocrAdapter, normalizer, pdfConverter);

      const result = await useCase.execute(pdfInput);

      expect(result.normalized.vendor).toBe('Acme Corp');
      expect(result.normalized.total).toBe(500);
    });

    it('returns empty rawOcrText for a zero-page PDF', async () => {
      const pdfConverter = new MockPdfConverter([]); // zero pages
      const ocrAdapter = makeMockOcr();
      const normalizer = makeMockNormalizer(makeNormalized());
      const useCase = new ProcessInvoiceUploadUseCase(ocrAdapter, normalizer, pdfConverter);

      const result = await useCase.execute(pdfInput);

      expect(result.rawOcrText).toBe('');
      expect(ocrAdapter.extractText).not.toHaveBeenCalled();
    });

    it('propagates PdfConversionError as Invoice processing failed', async () => {
      const pdfConverter = new MockPdfConverter(
        [{ uri: 'file:///tmp/p0.jpg', width: 1240, height: 1754, pageIndex: 0 }],
        true,
        'INVALID_PDF',
        'Corrupt PDF',
      );
      const ocrAdapter = makeMockOcr();
      const normalizer = makeMockNormalizer();
      const useCase = new ProcessInvoiceUploadUseCase(ocrAdapter, normalizer, pdfConverter);

      await expect(useCase.execute(pdfInput)).rejects.toThrow('Invoice processing failed');
    });

    it('includes the original PDF error message in the thrown error', async () => {
      const pdfConverter = new MockPdfConverter(
        [{ uri: 'file:///tmp/p0.jpg', width: 1240, height: 1754, pageIndex: 0 }],
        true,
        'INVALID_PDF',
        'Corrupt PDF file',
      );
      const ocrAdapter = makeMockOcr();
      const normalizer = makeMockNormalizer();
      const useCase = new ProcessInvoiceUploadUseCase(ocrAdapter, normalizer, pdfConverter);

      await expect(useCase.execute(pdfInput)).rejects.toThrow('Corrupt PDF file');
    });
  });
});