import { ProcessInvoiceUploadUseCase } from '../../application/ProcessInvoiceUploadUseCase';
import { IInvoiceDocumentProcessor } from '../../application/IInvoiceDocumentProcessor';
import { IFileSystemAdapter } from '../../../../infrastructure/files/IFileSystemAdapter';
import { NormalizedInvoice } from '../../application/IInvoiceNormalizer';

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

function makeProcessor(normalized?: NormalizedInvoice, error?: Error): jest.Mocked<IInvoiceDocumentProcessor> {
  return {
    process: error
      ? jest.fn().mockRejectedValue(error)
      : jest.fn().mockResolvedValue({
          normalized: normalized ?? makeNormalized(),
          rawOcrText: 'some ocr text',
        }),
  };
}

function makeFileSystem(localUri = 'file:///app/storage/invoice.pdf'): jest.Mocked<IFileSystemAdapter> {
  return {
    copyToAppStorage: jest.fn().mockResolvedValue(localUri),
    exists: jest.fn().mockResolvedValue(true),
    deleteFile: jest.fn().mockResolvedValue(undefined),
    getDocumentsDirectory: jest.fn().mockResolvedValue('/app/docs'),
  };
}

const baseInput = {
  fileUri: 'file:///tmp/invoice.jpg',
  filename: 'invoice.jpg',
  mimeType: 'image/jpeg',
  fileSize: 512000,
};

describe('ProcessInvoiceUploadUseCase', () => {
  describe('validation', () => {
    it('throws Validation failed for invalid mimeType', async () => {
      const fileSystem = makeFileSystem();
      const processor = makeProcessor();
      const useCase = new ProcessInvoiceUploadUseCase(fileSystem, processor);

      await expect(
        useCase.execute({ ...baseInput, mimeType: 'text/csv' }),
      ).rejects.toThrow('Validation failed');
    });

    it('throws Validation failed for oversized file', async () => {
      const fileSystem = makeFileSystem();
      const processor = makeProcessor();
      const useCase = new ProcessInvoiceUploadUseCase(fileSystem, processor);

      await expect(
        useCase.execute({ ...baseInput, fileSize: 999_999_999 }),
      ).rejects.toThrow('Validation failed');
    });
  });

  describe('file copy', () => {
    it('calls fileSystemAdapter.copyToAppStorage with the original URI', async () => {
      const fileSystem = makeFileSystem();
      const processor = makeProcessor();
      const useCase = new ProcessInvoiceUploadUseCase(fileSystem, processor);

      await useCase.execute(baseInput);

      expect(fileSystem.copyToAppStorage).toHaveBeenCalledWith(
        baseInput.fileUri,
        expect.stringMatching(/^invoice_\d+_[a-z0-9]+\.pdf$/),
      );
    });

    it('returns documentRef with the localPath from copyToAppStorage', async () => {
      const localUri = 'file:///app/storage/invoice_stored.pdf';
      const fileSystem = makeFileSystem(localUri);
      const processor = makeProcessor();
      const useCase = new ProcessInvoiceUploadUseCase(fileSystem, processor);

      const result = await useCase.execute(baseInput);

      expect(result.documentRef.localPath).toBe(localUri);
      expect(result.documentRef.filename).toBe(baseInput.filename);
      expect(result.documentRef.size).toBe(baseInput.fileSize);
      expect(result.documentRef.mimeType).toBe(baseInput.mimeType);
    });
  });

  describe('processor delegation', () => {
    it('calls processor.process with the copied localUri and mimeType', async () => {
      const localUri = 'file:///app/storage/invoice_stored.pdf';
      const fileSystem = makeFileSystem(localUri);
      const processor = makeProcessor();
      const useCase = new ProcessInvoiceUploadUseCase(fileSystem, processor);

      await useCase.execute(baseInput);

      expect(processor.process).toHaveBeenCalledWith(localUri, baseInput.mimeType);
    });

    it('returns normalized and rawOcrText from processor', async () => {
      const normalized = makeNormalized();
      const fileSystem = makeFileSystem();
      const processor = makeProcessor(normalized);
      const useCase = new ProcessInvoiceUploadUseCase(fileSystem, processor);

      const result = await useCase.execute(baseInput);

      expect(result.normalized).toEqual(normalized);
      expect(result.rawOcrText).toBe('some ocr text');
    });

    it('does NOT branch on mimeType internally — delegates entirely to processor', async () => {
      const pdfInput = { ...baseInput, mimeType: 'application/pdf', fileSize: 512000 };
      const fileSystem = makeFileSystem();
      const processor = makeProcessor();
      const useCase = new ProcessInvoiceUploadUseCase(fileSystem, processor);

      await useCase.execute(pdfInput);

      // processor.process is called with 'application/pdf' — use case does not branch
      expect(processor.process).toHaveBeenCalledWith(expect.any(String), 'application/pdf');
    });

    it('propagates processor.process() errors', async () => {
      const fileSystem = makeFileSystem();
      const processor = makeProcessor(undefined, new Error('Processing failed'));
      const useCase = new ProcessInvoiceUploadUseCase(fileSystem, processor);

      await expect(useCase.execute(baseInput)).rejects.toThrow('Processing failed');
    });
  });
});
