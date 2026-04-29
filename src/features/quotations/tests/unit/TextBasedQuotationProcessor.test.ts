import { TextBasedQuotationProcessor } from '../../infrastructure/processors/TextBasedQuotationProcessor';
import { IOcrAdapter, OcrResult } from '../../../../application/services/IOcrAdapter';
import {
  IQuotationParsingStrategy,
  NormalizedQuotation,
} from '../../application/ai/IQuotationParsingStrategy';
import { MockPdfConverter } from '../../../../../__mocks__/MockPdfConverter';

const makeOcrResult = (text = 'Builder Co\nTotal: $5500'): OcrResult => ({
  fullText: text,
  tokens: [],
  imageUri: 'file:///app/quote.jpg',
});

const makeNormalized = (): NormalizedQuotation => ({
  reference: 'QUO-001',
  vendor: 'Builder Co',
  vendorEmail: null,
  vendorPhone: null,
  vendorAddress: null,
  taxId: null,
  date: new Date('2026-01-15'),
  expiryDate: null,
  currency: 'AUD',
  subtotal: null,
  tax: null,
  total: 5500,
  lineItems: [],
  paymentTerms: null,
  scope: null,
  exclusions: null,
  notes: null,
  confidence: { overall: 0.9, vendor: 0.9, reference: 0.9, date: 0.8, total: 0.95 },
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
  normalized?: NormalizedQuotation,
  error?: Error,
): jest.Mocked<IQuotationParsingStrategy> {
  return {
    strategyType: 'llm',
    parse: error
      ? jest.fn().mockRejectedValue(error)
      : jest.fn().mockResolvedValue(normalized ?? makeNormalized()),
  };
}

describe('TextBasedQuotationProcessor', () => {
  describe('image file', () => {
    it('calls ocrAdapter.extractText with the image URI', async () => {
      const ocrAdapter = makeOcrAdapter();
      const strategy = makeParsingStrategy();
      const pdfConverter = new MockPdfConverter();
      const processor = new TextBasedQuotationProcessor(ocrAdapter, pdfConverter, strategy);

      await processor.process('file:///app/quote.jpg', 'image/jpeg');

      expect(ocrAdapter.extractText).toHaveBeenCalledWith('file:///app/quote.jpg');
    });

    it('passes OcrResult to parsingStrategy.parse()', async () => {
      const ocrResult = makeOcrResult('Custom text');
      const ocrAdapter = makeOcrAdapter(ocrResult);
      const strategy = makeParsingStrategy();
      const pdfConverter = new MockPdfConverter();
      const processor = new TextBasedQuotationProcessor(ocrAdapter, pdfConverter, strategy);

      await processor.process('file:///app/quote.jpg', 'image/jpeg');

      expect(strategy.parse).toHaveBeenCalledWith(ocrResult);
    });

    it('returns normalized result and rawOcrText', async () => {
      const ocrResult = makeOcrResult('Some OCR text');
      const ocrAdapter = makeOcrAdapter(ocrResult);
      const normalized = makeNormalized();
      const strategy = makeParsingStrategy(normalized);
      const pdfConverter = new MockPdfConverter();
      const processor = new TextBasedQuotationProcessor(ocrAdapter, pdfConverter, strategy);

      const result = await processor.process('file:///app/quote.jpg', 'image/jpeg');

      expect(result.normalized).toEqual(normalized);
      expect(result.rawOcrText).toBe('Some OCR text');
    });

    it('propagates parsingStrategy.parse() errors', async () => {
      const ocrAdapter = makeOcrAdapter();
      const strategy = makeParsingStrategy(undefined, new Error('LLM failure'));
      const pdfConverter = new MockPdfConverter();
      const processor = new TextBasedQuotationProcessor(ocrAdapter, pdfConverter, strategy);

      await expect(processor.process('file:///app/quote.jpg', 'image/jpeg')).rejects.toThrow('LLM failure');
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
      const processor = new TextBasedQuotationProcessor(ocrAdapter, pdfConverter, strategy);

      await processor.process('file:///app/quote.pdf', 'application/pdf');

      expect(pdfConverter.convertToImages).toHaveBeenCalledWith('file:///app/quote.pdf');
    });

    it('returns empty result when PDF has 0 pages', async () => {
      const ocrAdapter = makeOcrAdapter();
      const strategy = makeParsingStrategy();
      const pdfConverter = new MockPdfConverter([]);
      const processor = new TextBasedQuotationProcessor(ocrAdapter, pdfConverter, strategy);

      const result = await processor.process('file:///app/quote.pdf', 'application/pdf');

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
      const processor = new TextBasedQuotationProcessor(ocrAdapter, pdfConverter, strategy);

      await processor.process('file:///app/quote.pdf', 'application/pdf');

      expect(ocrAdapter.extractText).toHaveBeenCalledWith('file:///tmp/p0.jpg');
      expect(strategy.parse).toHaveBeenCalled();
    });
  });
});
