import { ProcessQuotationUploadUseCase } from '../../application/ProcessQuotationUploadUseCase';
import { IOcrAdapter, OcrResult } from '../../../../application/services/IOcrAdapter';
import { NormalizedQuotation } from '../../application/ai/IQuotationParsingStrategy';
import { IQuotationParsingStrategy } from '../../application/ai/IQuotationParsingStrategy';
import { IQuotationVisionParsingStrategy } from '../../application/ai/IQuotationVisionParsingStrategy';
import { MockPdfConverter } from '../../../../../__mocks__/MockPdfConverter';

const makeOcrResult = (): OcrResult => ({
  fullText: 'Some OCR text',
  tokens: [],
  imageUri: 'file:///app/quote.jpg',
});

const makeNormalized = (): NormalizedQuotation => ({
  reference: 'QT-001',
  vendor: 'Ace Roofing',
  vendorEmail: null,
  vendorPhone: null,
  vendorAddress: null,
  taxId: null,
  date: new Date('2026-04-01'),
  expiryDate: null,
  currency: 'AUD',
  subtotal: 5000,
  tax: 500,
  total: 5500,
  lineItems: [],
  paymentTerms: null,
  scope: null,
  exclusions: null,
  notes: null,
  confidence: { overall: 0.9, vendor: 0.9, reference: 0.9, date: 0.9, total: 0.9 },
  suggestedCorrections: [],
});

function makeMockOcr(): jest.Mocked<IOcrAdapter> {
  return { extractText: jest.fn().mockResolvedValue(makeOcrResult()) };
}

function makeMockParsingStrategy(): jest.Mocked<IQuotationParsingStrategy> {
  return {
    strategyType: 'llm' as const,
    parse: jest.fn().mockResolvedValue(makeNormalized()),
  };
}

function makeMockVisionStrategy(
  normalized?: NormalizedQuotation,
): jest.Mocked<IQuotationVisionParsingStrategy> {
  return {
    strategyType: 'llm-vision' as const,
    parse: jest.fn().mockResolvedValue(normalized ?? makeNormalized()),
  };
}

const baseImageInput = {
  fileUri: 'file:///app/quote.jpg',
  filename: 'quote.jpg',
  mimeType: 'image/jpeg',
  fileSize: 256_000,
};

describe('ProcessQuotationUploadUseCase — vision routing', () => {
  describe('vision strategy injected, image file', () => {
    it('calls visionStrategy.parse with the image URI', async () => {
      const visionStrategy = makeMockVisionStrategy();
      const useCase = new ProcessQuotationUploadUseCase(
        undefined,
        undefined,
        undefined,
        undefined,
        visionStrategy,
      );

      await useCase.execute(baseImageInput);

      expect(visionStrategy.parse).toHaveBeenCalledWith(baseImageInput.fileUri);
    });

    it('does NOT call ocrAdapter when vision strategy is present', async () => {
      const ocrAdapter = makeMockOcr();
      const parsingStrategy = makeMockParsingStrategy();
      const visionStrategy = makeMockVisionStrategy();
      const useCase = new ProcessQuotationUploadUseCase(
        parsingStrategy,
        undefined,
        undefined,
        ocrAdapter,
        visionStrategy,
      );

      await useCase.execute(baseImageInput);

      expect(ocrAdapter.extractText).not.toHaveBeenCalled();
    });

    it('returns normalized result from visionStrategy with empty rawOcrText', async () => {
      const normalized = makeNormalized();
      const visionStrategy = makeMockVisionStrategy(normalized);
      const useCase = new ProcessQuotationUploadUseCase(
        undefined,
        undefined,
        undefined,
        undefined,
        visionStrategy,
      );

      const result = await useCase.execute(baseImageInput);

      expect(result.normalized).toEqual(normalized);
      expect(result.rawOcrText).toBe('');
    });
  });

  describe('vision strategy injected, PDF file', () => {
    it('calls pdfConverter then visionStrategy.parse with page 1 URI', async () => {
      const visionStrategy = makeMockVisionStrategy();
      const pdfConverter = new MockPdfConverter([
        { uri: 'file:///tmp/page_0.jpg', width: 1240, height: 1754, pageIndex: 0 },
      ]);
      const useCase = new ProcessQuotationUploadUseCase(
        undefined,
        pdfConverter,
        undefined,
        undefined,
        visionStrategy,
      );

      await useCase.execute({
        fileUri: 'file:///app/quote.pdf',
        filename: 'quote.pdf',
        mimeType: 'application/pdf',
        fileSize: 1_024_000,
      });

      expect(visionStrategy.parse).toHaveBeenCalledWith('file:///tmp/page_0.jpg');
      expect(visionStrategy.parse).toHaveBeenCalledTimes(1);
    });
  });

  describe('text OCR path (vision strategy absent)', () => {
    it('calls ocrAdapter when vision strategy is not provided', async () => {
      const ocrAdapter = makeMockOcr();
      const parsingStrategy = makeMockParsingStrategy();
      const useCase = new ProcessQuotationUploadUseCase(
        parsingStrategy,
        undefined,
        undefined,
        ocrAdapter,
      );

      await useCase.execute(baseImageInput);

      expect(ocrAdapter.extractText).toHaveBeenCalledWith(baseImageInput.fileUri);
    });
  });

  describe('neither strategy present', () => {
    it('returns empty NormalizedQuotation with no adapter calls', async () => {
      const useCase = new ProcessQuotationUploadUseCase();

      const result = await useCase.execute(baseImageInput);

      expect(result.normalized.vendor).toBeNull();
      expect(result.normalized.total).toBeNull();
      expect(result.rawOcrText).toBe('');
    });
  });
});
