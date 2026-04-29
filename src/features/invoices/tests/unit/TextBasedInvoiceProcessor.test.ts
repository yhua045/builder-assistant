import { TextBasedInvoiceProcessor } from '../../infrastructure/processors/TextBasedInvoiceProcessor';
import { IOcrAdapter, OcrResult } from '../../../../application/services/IOcrAdapter';
import { IInvoiceParsingStrategy } from '../../application/IInvoiceParsingStrategy';
import { IInvoiceNormalizer, NormalizedInvoice, InvoiceCandidates } from '../../application/IInvoiceNormalizer';
import { MockPdfConverter } from '../../../../../__mocks__/MockPdfConverter';

const makeOcrResult = (text = 'Acme Corp\nTotal: $500'): OcrResult => ({
  fullText: text,
  tokens: [],
  imageUri: 'file:///app/invoice.jpg',
});

const makeNormalized = (): NormalizedInvoice => ({
  vendor: 'Acme Corp',
  invoiceNumber: 'INV-001',
  invoiceDate: new Date('2026-01-15'),
  dueDate: null,
  subtotal: 450,
  tax: 50,
  total: 500,
  currency: 'USD',
  lineItems: [],
  confidence: { overall: 0.9, vendor: 0.9, invoiceNumber: 0.9, invoiceDate: 0.8, total: 0.95 },
  suggestedCorrections: [],
});

function makeOcrAdapter(result?: OcrResult, error?: Error): jest.Mocked<IOcrAdapter> {
  return {
    extractText: error
      ? jest.fn().mockRejectedValue(error)
      : jest.fn().mockResolvedValue(result ?? makeOcrResult()),
  };
}

function makeParsingStrategy(
  normalized?: NormalizedInvoice,
  error?: Error,
): jest.Mocked<IInvoiceParsingStrategy> {
  return {
    strategyType: 'llm',
    parse: error
      ? jest.fn().mockRejectedValue(error)
      : jest.fn().mockResolvedValue(normalized ?? makeNormalized()),
  };
}

function makeNormalizer(
  normalized?: NormalizedInvoice,
): jest.Mocked<IInvoiceNormalizer> {
  const candidates: InvoiceCandidates = {
    vendors: [],
    invoiceNumbers: [],
    dates: [],
    dueDates: [],
    amounts: [],
    subtotals: [],
    taxAmounts: [],
    lineItems: [],
  };
  return {
    extractCandidates: jest.fn().mockReturnValue(candidates),
    normalize: jest.fn().mockResolvedValue(normalized ?? makeNormalized()),
  };
}

describe('TextBasedInvoiceProcessor', () => {
  describe('image file', () => {
    it('calls ocrAdapter.extractText with the image URI', async () => {
      const ocrAdapter = makeOcrAdapter();
      const strategy = makeParsingStrategy();
      const pdfConverter = new MockPdfConverter();
      const processor = new TextBasedInvoiceProcessor(ocrAdapter, pdfConverter, strategy);

      await processor.process('file:///app/invoice.jpg', 'image/jpeg');

      expect(ocrAdapter.extractText).toHaveBeenCalledWith('file:///app/invoice.jpg');
    });

    it('passes OcrResult to parsingStrategy.parse()', async () => {
      const ocrResult = makeOcrResult('Custom text');
      const ocrAdapter = makeOcrAdapter(ocrResult);
      const strategy = makeParsingStrategy();
      const pdfConverter = new MockPdfConverter();
      const processor = new TextBasedInvoiceProcessor(ocrAdapter, pdfConverter, strategy);

      await processor.process('file:///app/invoice.jpg', 'image/jpeg');

      expect(strategy.parse).toHaveBeenCalledWith(ocrResult);
    });

    it('returns normalized result and rawOcrText from image path', async () => {
      const ocrResult = makeOcrResult('Some OCR text');
      const ocrAdapter = makeOcrAdapter(ocrResult);
      const normalized = makeNormalized();
      const strategy = makeParsingStrategy(normalized);
      const pdfConverter = new MockPdfConverter();
      const processor = new TextBasedInvoiceProcessor(ocrAdapter, pdfConverter, strategy);

      const result = await processor.process('file:///app/invoice.jpg', 'image/jpeg');

      expect(result.normalized).toEqual(normalized);
      expect(result.rawOcrText).toBe('Some OCR text');
    });

    it('falls back to normalizer when no parsingStrategy provided (legacy)', async () => {
      const ocrResult = makeOcrResult();
      const ocrAdapter = makeOcrAdapter(ocrResult);
      const normalized = makeNormalized();
      const normalizer = makeNormalizer(normalized);
      const pdfConverter = new MockPdfConverter();
      // Pass undefined as parsingStrategy, use normalizer fallback
      const processor = new TextBasedInvoiceProcessor(ocrAdapter, pdfConverter, undefined as any, normalizer);

      const result = await processor.process('file:///app/invoice.jpg', 'image/jpeg');

      expect(normalizer.extractCandidates).toHaveBeenCalledWith(ocrResult.fullText);
      expect(normalizer.normalize).toHaveBeenCalled();
      expect(result.normalized).toEqual(normalized);
    });

    it('propagates parsingStrategy.parse() errors', async () => {
      const ocrAdapter = makeOcrAdapter();
      const strategy = makeParsingStrategy(undefined, new Error('LLM failure'));
      const pdfConverter = new MockPdfConverter();
      const processor = new TextBasedInvoiceProcessor(ocrAdapter, pdfConverter, strategy);

      await expect(processor.process('file:///app/invoice.jpg', 'image/jpeg')).rejects.toThrow('LLM failure');
    });
  });

  describe('PDF file', () => {
    it('calls pdfConverter.convertToImages with the PDF URI', async () => {
      const ocrAdapter = makeOcrAdapter();
      const strategy = makeParsingStrategy();
      const pdfConverter = new MockPdfConverter([
        { uri: 'file:///tmp/p0.jpg', width: 1240, height: 1754, pageIndex: 0 },
      ]);
      jest.spyOn(pdfConverter, 'convertToImages');
      const processor = new TextBasedInvoiceProcessor(ocrAdapter, pdfConverter, strategy);

      await processor.process('file:///app/invoice.pdf', 'application/pdf');

      expect(pdfConverter.convertToImages).toHaveBeenCalledWith('file:///app/invoice.pdf');
    });

    it('returns empty result when PDF has 0 pages', async () => {
      const ocrAdapter = makeOcrAdapter();
      const strategy = makeParsingStrategy();
      const pdfConverter = new MockPdfConverter([]); // 0 pages
      const processor = new TextBasedInvoiceProcessor(ocrAdapter, pdfConverter, strategy);

      const result = await processor.process('file:///app/invoice.pdf', 'application/pdf');

      expect(result.normalized.vendor).toBeNull();
      expect(result.rawOcrText).toBe('');
      expect(strategy.parse).not.toHaveBeenCalled();
    });

    it('runs OCR on converted pages and passes merged result to strategy', async () => {
      const ocrResult = makeOcrResult('PDF page text');
      const ocrAdapter = makeOcrAdapter(ocrResult);
      const strategy = makeParsingStrategy();
      const pdfConverter = new MockPdfConverter([
        { uri: 'file:///tmp/p0.jpg', width: 1240, height: 1754, pageIndex: 0 },
      ]);
      const processor = new TextBasedInvoiceProcessor(ocrAdapter, pdfConverter, strategy);

      await processor.process('file:///app/invoice.pdf', 'application/pdf');

      // extractText called for the page image
      expect(ocrAdapter.extractText).toHaveBeenCalledWith('file:///tmp/p0.jpg');
      // strategy.parse was called
      expect(strategy.parse).toHaveBeenCalled();
    });

    it('propagates parsingStrategy.parse() errors from PDF path', async () => {
      const ocrAdapter = makeOcrAdapter();
      const strategy = makeParsingStrategy(undefined, new Error('LLM PDF failure'));
      const pdfConverter = new MockPdfConverter([
        { uri: 'file:///tmp/p0.jpg', width: 1240, height: 1754, pageIndex: 0 },
      ]);
      const processor = new TextBasedInvoiceProcessor(ocrAdapter, pdfConverter, strategy);

      await expect(processor.process('file:///app/invoice.pdf', 'application/pdf')).rejects.toThrow('LLM PDF failure');
    });
  });
});
