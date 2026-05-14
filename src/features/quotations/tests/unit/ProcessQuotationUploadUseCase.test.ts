import {
  ProcessQuotationUploadUseCase,
  ProcessQuotationUploadInput,
} from '../../application/ProcessQuotationUploadUseCase';
import { IQuotationDocumentProcessor } from '../../application/IQuotationDocumentProcessor';
import { IFileSystemAdapter } from '../../../../infrastructure/files/IFileSystemAdapter';
import { NormalizedQuotation } from '../../application/ai/IQuotationParsingStrategy';

const mockFileSystem: jest.Mocked<IFileSystemAdapter> = {
  copyToAppStorage: jest.fn().mockImplementation((_uri: string) => Promise.resolve(_uri)),
  exists: jest.fn().mockResolvedValue(true),
  deleteFile: jest.fn().mockResolvedValue(undefined),
  getDocumentsDirectory: jest.fn().mockResolvedValue('/app/docs'),
};

function makeNormalizedQuotation(overrides: Partial<NormalizedQuotation> = {}): NormalizedQuotation {
  return {
    reference: 'QUO-001',
    vendor: 'Builder Co',
    vendorEmail: null,
    vendorPhone: null,
    vendorAddress: null,
    taxId: null,
    date: new Date('2026-03-01'),
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
    confidence: { overall: 0.9, vendor: 0.9, reference: 0.9, date: 0.9, total: 0.9 },
    suggestedCorrections: [],
    ...overrides,
  };
}

function makeProcessor(
  normalized?: NormalizedQuotation,
  error?: Error,
): jest.Mocked<IQuotationDocumentProcessor> {
  return {
    process: error
      ? jest.fn().mockRejectedValue(error)
      : jest.fn().mockResolvedValue({
          normalized: normalized ?? makeNormalizedQuotation(),
          rawOcrText: 'OCR text',
        }),
  };
}

const imageInput: ProcessQuotationUploadInput = {
  fileUri: 'file:///app/quote_123.jpg',
  filename: 'quote.jpg',
  mimeType: 'image/jpeg',
  fileSize: 102400,
};

const pdfInput: ProcessQuotationUploadInput = {
  fileUri: 'file:///app/quote_123.pdf',
  filename: 'quote.pdf',
  mimeType: 'application/pdf',
  fileSize: 204800,
};

describe('ProcessQuotationUploadUseCase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFileSystem.copyToAppStorage.mockImplementation((_uri: string) => Promise.resolve(_uri));
  });

  describe('validation', () => {
    it('throws Validation failed for invalid mimeType', async () => {
      const processor = makeProcessor();
      const useCase = new ProcessQuotationUploadUseCase(mockFileSystem, processor);

      await expect(
        useCase.execute({ ...imageInput, mimeType: 'text/csv' }),
      ).rejects.toThrow('Validation failed');
    });

    it('throws Validation failed for oversized file', async () => {
      const processor = makeProcessor();
      const useCase = new ProcessQuotationUploadUseCase(mockFileSystem, processor);

      await expect(
        useCase.execute({ ...imageInput, fileSize: 999_999_999 }),
      ).rejects.toThrow('Validation failed');
    });
  });

  describe('file copy', () => {
    it('calls fileSystemAdapter.copyToAppStorage for image input', async () => {
      const processor = makeProcessor();
      const useCase = new ProcessQuotationUploadUseCase(mockFileSystem, processor);

      await useCase.execute(imageInput);

      expect(mockFileSystem.copyToAppStorage).toHaveBeenCalledWith(
        imageInput.fileUri,
        expect.stringMatching(/^quote_\d+_[a-z0-9]+\.pdf$/),
      );
    });

    it('returns documentRef with localPath from copyToAppStorage', async () => {
      const localPath = 'file:///app/storage/quote_stored.pdf';
      mockFileSystem.copyToAppStorage.mockResolvedValueOnce(localPath);
      const processor = makeProcessor();
      const useCase = new ProcessQuotationUploadUseCase(mockFileSystem, processor);

      const output = await useCase.execute(imageInput);

      expect(output.documentRef.localPath).toBe(localPath);
      expect(output.documentRef.filename).toBe(imageInput.filename);
      expect(output.documentRef.size).toBe(imageInput.fileSize);
      expect(output.documentRef.mimeType).toBe(imageInput.mimeType);
    });
  });

  describe('processor delegation', () => {
    it('returns normalized quotation and documentRef for image file', async () => {
      const normalized = makeNormalizedQuotation();
      const processor = makeProcessor(normalized);
      const useCase = new ProcessQuotationUploadUseCase(mockFileSystem, processor);

      const output = await useCase.execute(imageInput);

      expect(output.normalized.vendor).toBe('Builder Co');
      expect(output.documentRef).toMatchObject({
        filename: imageInput.filename,
        size: imageInput.fileSize,
        mimeType: imageInput.mimeType,
      });
    });

    it('calls processor.process with the copied localPath and mimeType', async () => {
      const localPath = 'file:///app/storage/quote_stored.jpg';
      mockFileSystem.copyToAppStorage.mockResolvedValueOnce(localPath);
      const processor = makeProcessor();
      const useCase = new ProcessQuotationUploadUseCase(mockFileSystem, processor);

      await useCase.execute(imageInput);

      expect(processor.process).toHaveBeenCalledWith(localPath, imageInput.mimeType);
    });

    it('calls processor.process with PDF mimeType for PDF input', async () => {
      const processor = makeProcessor();
      const useCase = new ProcessQuotationUploadUseCase(mockFileSystem, processor);

      await useCase.execute(pdfInput);

      expect(processor.process).toHaveBeenCalledWith(expect.any(String), 'application/pdf');
    });

    it('propagates processor errors', async () => {
      const processor = makeProcessor(undefined, new Error('Processing failed'));
      const useCase = new ProcessQuotationUploadUseCase(mockFileSystem, processor);

      await expect(useCase.execute(imageInput)).rejects.toThrow('Processing failed');
    });
  });
});
