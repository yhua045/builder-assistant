import { VisionBasedQuotationProcessor } from '../../infrastructure/processors/VisionBasedQuotationProcessor';
import { IQuotationVisionParsingStrategy } from '../../application/ai/IQuotationVisionParsingStrategy';
import { NormalizedQuotation } from '../../application/ai/IQuotationParsingStrategy';
import { MockPdfConverter } from '../../../../../__mocks__/MockPdfConverter';

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

function makeVisionStrategy(
  normalized?: NormalizedQuotation,
  error?: Error,
): jest.Mocked<IQuotationVisionParsingStrategy> {
  return {
    strategyType: 'llm-vision',
    parse: error
      ? jest.fn().mockRejectedValue(error)
      : jest.fn().mockResolvedValue(normalized ?? makeNormalized()),
  };
}

describe('VisionBasedQuotationProcessor', () => {
  describe('image file', () => {
    it('calls visionStrategy.parse with the image URI directly', async () => {
      const visionStrategy = makeVisionStrategy();
      const pdfConverter = new MockPdfConverter();
      const processor = new VisionBasedQuotationProcessor(visionStrategy, pdfConverter);

      await processor.process('file:///app/quote.jpg', 'image/jpeg');

      expect(visionStrategy.parse).toHaveBeenCalledWith('file:///app/quote.jpg');
    });

    it('does NOT call pdfConverter for image files', async () => {
      const visionStrategy = makeVisionStrategy();
      const pdfConverter = new MockPdfConverter();
      jest.spyOn(pdfConverter, 'convertToImages');
      const processor = new VisionBasedQuotationProcessor(visionStrategy, pdfConverter);

      await processor.process('file:///app/quote.jpg', 'image/jpeg');

      expect(pdfConverter.convertToImages).not.toHaveBeenCalled();
    });

    it('returns normalized result with empty rawOcrText', async () => {
      const normalized = makeNormalized();
      const visionStrategy = makeVisionStrategy(normalized);
      const pdfConverter = new MockPdfConverter();
      const processor = new VisionBasedQuotationProcessor(visionStrategy, pdfConverter);

      const result = await processor.process('file:///app/quote.jpg', 'image/jpeg');

      expect(result.normalized).toEqual(normalized);
      expect(result.rawOcrText).toBe('');
    });

    it('propagates visionStrategy.parse() errors', async () => {
      const visionStrategy = makeVisionStrategy(undefined, new Error('Vision API error'));
      const pdfConverter = new MockPdfConverter();
      const processor = new VisionBasedQuotationProcessor(visionStrategy, pdfConverter);

      await expect(processor.process('file:///app/quote.jpg', 'image/jpeg')).rejects.toThrow('Vision API error');
    });
  });

  describe('PDF file', () => {
    it('converts PDF and passes page[0].uri to visionStrategy.parse()', async () => {
      const visionStrategy = makeVisionStrategy();
      const pdfConverter = new MockPdfConverter([
        { uri: 'file:///tmp/p0.jpg', width: 1240, height: 1754, pageIndex: 0 },
      ]);
      jest.spyOn(pdfConverter, 'convertToImages');
      const processor = new VisionBasedQuotationProcessor(visionStrategy, pdfConverter);

      await processor.process('file:///app/quote.pdf', 'application/pdf');

      expect(pdfConverter.convertToImages).toHaveBeenCalledWith('file:///app/quote.pdf');
      expect(visionStrategy.parse).toHaveBeenCalledWith('file:///tmp/p0.jpg');
    });

    it('returns empty result when PDF has 0 pages', async () => {
      const visionStrategy = makeVisionStrategy();
      const pdfConverter = new MockPdfConverter([]);
      const processor = new VisionBasedQuotationProcessor(visionStrategy, pdfConverter);

      const result = await processor.process('file:///app/quote.pdf', 'application/pdf');

      expect(result.normalized.vendor).toBeNull();
      expect(result.rawOcrText).toBe('');
      expect(visionStrategy.parse).not.toHaveBeenCalled();
    });

    it('rawOcrText is always empty string', async () => {
      const visionStrategy = makeVisionStrategy();
      const pdfConverter = new MockPdfConverter([
        { uri: 'file:///tmp/p0.jpg', width: 1240, height: 1754, pageIndex: 0 },
      ]);
      const processor = new VisionBasedQuotationProcessor(visionStrategy, pdfConverter);

      const result = await processor.process('file:///app/quote.pdf', 'application/pdf');

      expect(result.rawOcrText).toBe('');
    });
  });
});
