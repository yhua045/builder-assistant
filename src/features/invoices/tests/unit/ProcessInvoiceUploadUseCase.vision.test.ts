import { ProcessInvoiceUploadUseCase } from '../../application/ProcessInvoiceUploadUseCase';
import { IOcrAdapter, OcrResult } from '../../../../application/services/IOcrAdapter';
import { IInvoiceNormalizer, NormalizedInvoice } from '../../application/IInvoiceNormalizer';
import { IInvoiceVisionParsingStrategy } from '../../application/IInvoiceVisionParsingStrategy';
import { MockPdfConverter } from '../../../../../__mocks__/MockPdfConverter';

const makeOcrResult = (): OcrResult => ({
  fullText: 'Some OCR text',
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
  currency: 'AUD',
  lineItems: [],
  confidence: { overall: 0.9, vendor: 0.9, invoiceNumber: 0.9, invoiceDate: 0.8, total: 0.95 },
  suggestedCorrections: [],
});

function makeMockOcr(): jest.Mocked<IOcrAdapter> {
  return {
    extractText: jest.fn().mockResolvedValue(makeOcrResult()),
  };
}

function makeMockNormalizer(): jest.Mocked<IInvoiceNormalizer> {
  return {
    extractCandidates: jest.fn().mockReturnValue({}),
    normalize: jest.fn().mockResolvedValue(makeNormalized()),
  };
}

function makeMockVisionStrategy(
  normalized?: NormalizedInvoice,
): jest.Mocked<IInvoiceVisionParsingStrategy> {
  return {
    strategyType: 'llm-vision' as const,
    parse: jest.fn().mockResolvedValue(normalized ?? makeNormalized()),
  };
}

const baseImageInput = {
  fileUri: 'file:///app/documents/invoice.jpg',
  filename: 'invoice.jpg',
  mimeType: 'image/jpeg',
  fileSize: 512_000,
};

describe('ProcessInvoiceUploadUseCase — vision routing', () => {
  describe('vision strategy injected, image file', () => {
    it('calls visionStrategy.parse with the image URI', async () => {
      const visionStrategy = makeMockVisionStrategy();
      const useCase = new ProcessInvoiceUploadUseCase(
        undefined,
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
      const visionStrategy = makeMockVisionStrategy();
      const useCase = new ProcessInvoiceUploadUseCase(
        ocrAdapter,
        undefined,
        undefined,
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
      const useCase = new ProcessInvoiceUploadUseCase(
        undefined,
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
        { uri: 'file:///tmp/page_1.jpg', width: 1240, height: 1754, pageIndex: 1 },
      ]);
      const useCase = new ProcessInvoiceUploadUseCase(
        undefined,
        undefined,
        pdfConverter,
        undefined,
        undefined,
        visionStrategy,
      );

      await useCase.execute({
        fileUri: 'file:///app/invoice.pdf',
        filename: 'invoice.pdf',
        mimeType: 'application/pdf',
        fileSize: 1_024_000,
      });

      expect(visionStrategy.parse).toHaveBeenCalledWith('file:///tmp/page_0.jpg');
      expect(visionStrategy.parse).toHaveBeenCalledTimes(1);
    });

    it('returns empty invoice if PDF has no pages in vision path', async () => {
      const visionStrategy = makeMockVisionStrategy();
      const pdfConverter = new MockPdfConverter([], false);
      const useCase = new ProcessInvoiceUploadUseCase(
        undefined,
        undefined,
        pdfConverter,
        undefined,
        undefined,
        visionStrategy,
      );

      const result = await useCase.execute({
        fileUri: 'file:///app/invoice.pdf',
        filename: 'invoice.pdf',
        mimeType: 'application/pdf',
        fileSize: 1_024_000,
      });

      expect(result.normalized.vendor).toBeNull();
      expect(result.rawOcrText).toBe('');
      expect(visionStrategy.parse).not.toHaveBeenCalled();
    });
  });

  describe('text OCR path (vision strategy absent)', () => {
    it('calls ocrAdapter when vision strategy is not provided', async () => {
      const ocrAdapter = makeMockOcr();
      const normalizer = makeMockNormalizer();
      const useCase = new ProcessInvoiceUploadUseCase(ocrAdapter, normalizer);

      await useCase.execute(baseImageInput);

      expect(ocrAdapter.extractText).toHaveBeenCalledWith(baseImageInput.fileUri);
    });
  });

  describe('neither strategy present', () => {
    it('returns empty NormalizedInvoice with no adapter calls', async () => {
      const useCase = new ProcessInvoiceUploadUseCase();

      const result = await useCase.execute(baseImageInput);

      expect(result.normalized.vendor).toBeNull();
      expect(result.normalized.total).toBeNull();
      expect(result.rawOcrText).toBe('');
    });
  });
});
