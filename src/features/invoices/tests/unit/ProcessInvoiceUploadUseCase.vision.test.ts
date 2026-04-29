/**
 * Vision routing is now tested via VisionBasedInvoiceProcessor.test.ts.
 * This file verifies that the simplified ProcessInvoiceUploadUseCase correctly
 * delegates to whatever processor is injected (text or vision alike).
 */
import { ProcessInvoiceUploadUseCase } from '../../application/ProcessInvoiceUploadUseCase';
import { IInvoiceDocumentProcessor } from '../../application/IInvoiceDocumentProcessor';
import { IFileSystemAdapter } from '../../../../infrastructure/files/IFileSystemAdapter';
import { NormalizedInvoice } from '../../application/IInvoiceNormalizer';

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

function makeFileSystem(localUri = 'file:///app/storage/invoice.pdf'): jest.Mocked<IFileSystemAdapter> {
  return {
    copyToAppStorage: jest.fn().mockResolvedValue(localUri),
    exists: jest.fn().mockResolvedValue(true),
    deleteFile: jest.fn().mockResolvedValue(undefined),
    getDocumentsDirectory: jest.fn().mockResolvedValue('/app/docs'),
  };
}

const baseImageInput = {
  fileUri: 'file:///app/documents/invoice.jpg',
  filename: 'invoice.jpg',
  mimeType: 'image/jpeg',
  fileSize: 512_000,
};

describe('ProcessInvoiceUploadUseCase — processor delegation (vision + text alike)', () => {
  it('calls processor.process with localUri (not original fileUri)', async () => {
    const localUri = 'file:///app/storage/invoice_stored.jpg';
    const fileSystem = makeFileSystem(localUri);
    const processor: jest.Mocked<IInvoiceDocumentProcessor> = {
      process: jest.fn().mockResolvedValue({ normalized: makeNormalized(), rawOcrText: '' }),
    };
    const useCase = new ProcessInvoiceUploadUseCase(fileSystem, processor);

    await useCase.execute(baseImageInput);

    expect(processor.process).toHaveBeenCalledWith(localUri, baseImageInput.mimeType);
  });

  it('returns rawOcrText from processor (empty string for vision)', async () => {
    const fileSystem = makeFileSystem();
    const processor: jest.Mocked<IInvoiceDocumentProcessor> = {
      process: jest.fn().mockResolvedValue({ normalized: makeNormalized(), rawOcrText: '' }),
    };
    const useCase = new ProcessInvoiceUploadUseCase(fileSystem, processor);

    const result = await useCase.execute(baseImageInput);

    expect(result.rawOcrText).toBe('');
  });

  it('returns rawOcrText from processor (non-empty for text-based)', async () => {
    const fileSystem = makeFileSystem();
    const processor: jest.Mocked<IInvoiceDocumentProcessor> = {
      process: jest.fn().mockResolvedValue({ normalized: makeNormalized(), rawOcrText: 'OCR text from image' }),
    };
    const useCase = new ProcessInvoiceUploadUseCase(fileSystem, processor);

    const result = await useCase.execute(baseImageInput);

    expect(result.rawOcrText).toBe('OCR text from image');
  });
});
