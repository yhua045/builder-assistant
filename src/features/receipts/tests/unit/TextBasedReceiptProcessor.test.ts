import { TextBasedReceiptProcessor } from '../../infrastructure/processors/TextBasedReceiptProcessor';
import { IOcrAdapter, OcrResult } from '../../../../application/services/IOcrAdapter';
import { IReceiptParsingStrategy } from '../../application/IReceiptParsingStrategy';
import { NormalizedReceipt } from '../../application/IReceiptNormalizer';
import { MockPdfConverter } from '../../../../../__mocks__/MockPdfConverter';

const makeOcrResult = (text = 'Woolworths\nTotal: $45.90'): OcrResult => ({
  fullText: text,
  tokens: [],
  imageUri: 'file:///app/receipt.jpg',
});

const makeNormalized = (): NormalizedReceipt => ({
  vendor: 'Woolworths',
  date: new Date('2026-01-15'),
  total: 45.9,
  subtotal: 40,
  tax: 5.9,
  currency: 'AUD',
  paymentMethod: 'card',
  receiptNumber: null,
  lineItems: [],
  notes: null,
  confidence: { overall: 0.9, vendor: 0.9, date: 0.8, total: 0.95 },
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
  normalized?: NormalizedReceipt,
  error?: Error,
): jest.Mocked<IReceiptParsingStrategy> {
  return {
    strategyType: 'llm',
    parse: error
      ? jest.fn().mockRejectedValue(error)
      : jest.fn().mockResolvedValue(normalized ?? makeNormalized()),
  };
}

describe('TextBasedReceiptProcessor', () => {
  describe('image file', () => {
    it('calls ocrAdapter.extractText with the image URI', async () => {
      const ocrAdapter = makeOcrAdapter();
      const strategy = makeParsingStrategy();
      const pdfConverter = new MockPdfConverter();
      const processor = new TextBasedReceiptProcessor(ocrAdapter, pdfConverter, strategy);

      await processor.process('file:///app/receipt.jpg', 'image/jpeg');

      expect(ocrAdapter.extractText).toHaveBeenCalledWith('file:///app/receipt.jpg');
    });

    it('passes OcrResult to parsingStrategy.parse()', async () => {
      const ocrResult = makeOcrResult('Custom text');
      const ocrAdapter = makeOcrAdapter(ocrResult);
      const strategy = makeParsingStrategy();
      const pdfConverter = new MockPdfConverter();
      const processor = new TextBasedReceiptProcessor(ocrAdapter, pdfConverter, strategy);

      await processor.process('file:///app/receipt.jpg', 'image/jpeg');

      expect(strategy.parse).toHaveBeenCalledWith(ocrResult);
    });

    it('returns normalized result and rawOcrText', async () => {
      const ocrResult = makeOcrResult('Some OCR text');
      const ocrAdapter = makeOcrAdapter(ocrResult);
      const normalized = makeNormalized();
      const strategy = makeParsingStrategy(normalized);
      const pdfConverter = new MockPdfConverter();
      const processor = new TextBasedReceiptProcessor(ocrAdapter, pdfConverter, strategy);

      const result = await processor.process('file:///app/receipt.jpg', 'image/jpeg');

      expect(result.normalized).toEqual(normalized);
      expect(result.rawOcrText).toBe('Some OCR text');
    });

    it('propagates parsingStrategy.parse() errors', async () => {
      const ocrAdapter = makeOcrAdapter();
      const strategy = makeParsingStrategy(undefined, new Error('LLM failure'));
      const pdfConverter = new MockPdfConverter();
      const processor = new TextBasedReceiptProcessor(ocrAdapter, pdfConverter, strategy);

      await expect(processor.process('file:///app/receipt.jpg', 'image/jpeg')).rejects.toThrow('LLM failure');
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
      const processor = new TextBasedReceiptProcessor(ocrAdapter, pdfConverter, strategy);

      await processor.process('file:///app/receipt.pdf', 'application/pdf');

      expect(pdfConverter.convertToImages).toHaveBeenCalledWith('file:///app/receipt.pdf');
    });

    it('returns empty result when PDF has 0 pages', async () => {
      const ocrAdapter = makeOcrAdapter();
      const strategy = makeParsingStrategy();
      const pdfConverter = new MockPdfConverter([]);
      const processor = new TextBasedReceiptProcessor(ocrAdapter, pdfConverter, strategy);

      const result = await processor.process('file:///app/receipt.pdf', 'application/pdf');

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
      const processor = new TextBasedReceiptProcessor(ocrAdapter, pdfConverter, strategy);

      await processor.process('file:///app/receipt.pdf', 'application/pdf');

      expect(ocrAdapter.extractText).toHaveBeenCalledWith('file:///tmp/p0.jpg');
      expect(strategy.parse).toHaveBeenCalled();
    });
  });
});
