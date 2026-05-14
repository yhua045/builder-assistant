import { VisionBasedInvoiceProcessor } from '../../infrastructure/processors/VisionBasedInvoiceProcessor';
import { IInvoiceVisionParsingStrategy } from '../../application/IInvoiceVisionParsingStrategy';
import { NormalizedInvoice } from '../../application/IInvoiceNormalizer';
import { MockPdfConverter } from '../../../../../__mocks__/MockPdfConverter';

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

function makeVisionStrategy(
  normalized?: NormalizedInvoice,
  error?: Error,
): jest.Mocked<IInvoiceVisionParsingStrategy> {
  return {
    strategyType: 'llm-vision',
    parse: error
      ? jest.fn().mockRejectedValue(error)
      : jest.fn().mockResolvedValue(normalized ?? makeNormalized()),
  };
}

describe('VisionBasedInvoiceProcessor', () => {
  describe('image file', () => {
    it('calls visionStrategy.parse with the image URI directly', async () => {
      const visionStrategy = makeVisionStrategy();
      const pdfConverter = new MockPdfConverter();
      const processor = new VisionBasedInvoiceProcessor(visionStrategy, pdfConverter);

      await processor.process('file:///app/invoice.jpg', 'image/jpeg');

      expect(visionStrategy.parse).toHaveBeenCalledWith('file:///app/invoice.jpg');
    });

    it('does NOT call pdfConverter for image files', async () => {
      const visionStrategy = makeVisionStrategy();
      const pdfConverter = new MockPdfConverter();
      jest.spyOn(pdfConverter, 'convertToImages');
      const processor = new VisionBasedInvoiceProcessor(visionStrategy, pdfConverter);

      await processor.process('file:///app/invoice.jpg', 'image/jpeg');

      expect(pdfConverter.convertToImages).not.toHaveBeenCalled();
    });

    it('returns normalized result with empty rawOcrText', async () => {
      const normalized = makeNormalized();
      const visionStrategy = makeVisionStrategy(normalized);
      const pdfConverter = new MockPdfConverter();
      const processor = new VisionBasedInvoiceProcessor(visionStrategy, pdfConverter);

      const result = await processor.process('file:///app/invoice.jpg', 'image/jpeg');

      expect(result.normalized).toEqual(normalized);
      expect(result.rawOcrText).toBe('');
    });

    it('propagates visionStrategy.parse() errors', async () => {
      const visionStrategy = makeVisionStrategy(undefined, new Error('Vision API error'));
      const pdfConverter = new MockPdfConverter();
      const processor = new VisionBasedInvoiceProcessor(visionStrategy, pdfConverter);

      await expect(processor.process('file:///app/invoice.jpg', 'image/jpeg')).rejects.toThrow('Vision API error');
    });
  });

  describe('PDF file', () => {
    it('calls pdfConverter.convertToImages then passes page[0].uri to visionStrategy.parse()', async () => {
      const visionStrategy = makeVisionStrategy();
      const pdfConverter = new MockPdfConverter([
        { uri: 'file:///tmp/p0.jpg', width: 1240, height: 1754, pageIndex: 0 },
      ]);
      jest.spyOn(pdfConverter, 'convertToImages');
      const processor = new VisionBasedInvoiceProcessor(visionStrategy, pdfConverter);

      await processor.process('file:///app/invoice.pdf', 'application/pdf');

      expect(pdfConverter.convertToImages).toHaveBeenCalledWith('file:///app/invoice.pdf');
      expect(visionStrategy.parse).toHaveBeenCalledWith('file:///tmp/p0.jpg');
    });

    it('returns empty result when PDF has 0 pages', async () => {
      const visionStrategy = makeVisionStrategy();
      const pdfConverter = new MockPdfConverter([]); // 0 pages
      const processor = new VisionBasedInvoiceProcessor(visionStrategy, pdfConverter);

      const result = await processor.process('file:///app/invoice.pdf', 'application/pdf');

      expect(result.normalized.vendor).toBeNull();
      expect(result.rawOcrText).toBe('');
      expect(visionStrategy.parse).not.toHaveBeenCalled();
    });

    it('rawOcrText is always empty string for PDF path', async () => {
      const visionStrategy = makeVisionStrategy();
      const pdfConverter = new MockPdfConverter([
        { uri: 'file:///tmp/p0.jpg', width: 1240, height: 1754, pageIndex: 0 },
      ]);
      const processor = new VisionBasedInvoiceProcessor(visionStrategy, pdfConverter);

      const result = await processor.process('file:///app/invoice.pdf', 'application/pdf');

      expect(result.rawOcrText).toBe('');
    });

    it('propagates visionStrategy.parse() errors from PDF path', async () => {
      const visionStrategy = makeVisionStrategy(undefined, new Error('Vision PDF error'));
      const pdfConverter = new MockPdfConverter([
        { uri: 'file:///tmp/p0.jpg', width: 1240, height: 1754, pageIndex: 0 },
      ]);
      const processor = new VisionBasedInvoiceProcessor(visionStrategy, pdfConverter);

      await expect(processor.process('file:///app/invoice.pdf', 'application/pdf')).rejects.toThrow('Vision PDF error');
    });
  });
});
