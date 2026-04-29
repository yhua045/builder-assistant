import { ProcessReceiptUploadUseCase } from '../../application/ProcessReceiptUploadUseCase';
import { IOcrAdapter, OcrResult } from '../../../../application/services/IOcrAdapter';
import { NormalizedReceipt } from '../../application/IReceiptNormalizer';
import { IReceiptParsingStrategy } from '../../application/IReceiptParsingStrategy';
import { IReceiptVisionParsingStrategy } from '../../application/IReceiptVisionParsingStrategy';
import { MockPdfConverter } from '../../../../../__mocks__/MockPdfConverter';

const makeOcrResult = (): OcrResult => ({
  fullText: 'Some OCR text',
  tokens: [],
  imageUri: 'file:///app/receipt.jpg',
});

const makeNormalized = (): NormalizedReceipt => ({
  vendor: 'Bunnings',
  date: new Date('2026-01-15'),
  total: 200,
  subtotal: 180,
  tax: 20,
  currency: 'AUD',
  paymentMethod: 'card',
  receiptNumber: 'REC-001',
  lineItems: [],
  notes: null,
  confidence: { overall: 0.9, vendor: 0.9, date: 0.9, total: 0.9 },
  suggestedCorrections: [],
});

function makeMockOcr(): jest.Mocked<IOcrAdapter> {
  return { extractText: jest.fn().mockResolvedValue(makeOcrResult()) };
}

function makeMockParsingStrategy(): jest.Mocked<IReceiptParsingStrategy> {
  return {
    strategyType: 'llm' as const,
    parse: jest.fn().mockResolvedValue(makeNormalized()),
  };
}

function makeMockVisionStrategy(
  normalized?: NormalizedReceipt,
): jest.Mocked<IReceiptVisionParsingStrategy> {
  return {
    strategyType: 'llm-vision' as const,
    parse: jest.fn().mockResolvedValue(normalized ?? makeNormalized()),
  };
}

const baseImageInput = {
  fileUri: 'file:///app/receipt.jpg',
  filename: 'receipt.jpg',
  mimeType: 'image/jpeg',
  fileSize: 256_000,
};

describe('ProcessReceiptUploadUseCase — vision routing', () => {
  describe('vision strategy injected, image file', () => {
    it('calls visionStrategy.parse with the image URI', async () => {
      const visionStrategy = makeMockVisionStrategy();
      const ocrAdapter = makeMockOcr();
      const parsingStrategy = makeMockParsingStrategy();
      const useCase = new ProcessReceiptUploadUseCase(
        ocrAdapter,
        parsingStrategy,
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
      const useCase = new ProcessReceiptUploadUseCase(
        ocrAdapter,
        parsingStrategy,
        undefined,
        undefined,
        visionStrategy,
      );

      await useCase.execute(baseImageInput);

      expect(ocrAdapter.extractText).not.toHaveBeenCalled();
    });

    it('returns normalized result from visionStrategy with empty rawOcrText', async () => {
      const normalized = makeNormalized();
      const visionStrategy = makeMockVisionStrategy(normalized);
      const ocrAdapter = makeMockOcr();
      const parsingStrategy = makeMockParsingStrategy();
      const useCase = new ProcessReceiptUploadUseCase(
        ocrAdapter,
        parsingStrategy,
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
      const ocrAdapter = makeMockOcr();
      const parsingStrategy = makeMockParsingStrategy();
      const useCase = new ProcessReceiptUploadUseCase(
        ocrAdapter,
        parsingStrategy,
        pdfConverter,
        undefined,
        visionStrategy,
      );

      await useCase.execute({
        fileUri: 'file:///app/receipt.pdf',
        filename: 'receipt.pdf',
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
      const useCase = new ProcessReceiptUploadUseCase(ocrAdapter, parsingStrategy);

      await useCase.execute(baseImageInput);

      expect(ocrAdapter.extractText).toHaveBeenCalledWith(baseImageInput.fileUri);
    });
  });
});
