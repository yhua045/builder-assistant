/**
 * Vision routing for quotations is now tested via VisionBasedQuotationProcessor.test.ts.
 * This file verifies the simplified use case delegates to any processor uniformly.
 */
import {
  ProcessQuotationUploadUseCase,
  ProcessQuotationUploadInput,
} from '../../application/ProcessQuotationUploadUseCase';
import { IQuotationDocumentProcessor } from '../../application/IQuotationDocumentProcessor';
import { IFileSystemAdapter } from '../../../../infrastructure/files/IFileSystemAdapter';
import { NormalizedQuotation } from '../../application/ai/IQuotationParsingStrategy';

function makeNormalized(): NormalizedQuotation {
  return {
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
  };
}

function makeFileSystem(localUri = 'file:///app/storage/quote.pdf'): jest.Mocked<IFileSystemAdapter> {
  return {
    copyToAppStorage: jest.fn().mockResolvedValue(localUri),
    exists: jest.fn().mockResolvedValue(true),
    deleteFile: jest.fn().mockResolvedValue(undefined),
    getDocumentsDirectory: jest.fn().mockResolvedValue('/app/docs'),
  };
}

const baseImageInput: ProcessQuotationUploadInput = {
  fileUri: 'file:///app/quote.jpg',
  filename: 'quote.jpg',
  mimeType: 'image/jpeg',
  fileSize: 256_000,
};

describe('ProcessQuotationUploadUseCase — processor delegation (vision + text)', () => {
  it('calls processor.process with localPath (not original fileUri)', async () => {
    const localPath = 'file:///app/storage/quote_stored.jpg';
    const fileSystem = makeFileSystem(localPath);
    const processor: jest.Mocked<IQuotationDocumentProcessor> = {
      process: jest.fn().mockResolvedValue({ normalized: makeNormalized(), rawOcrText: '' }),
    };
    const useCase = new ProcessQuotationUploadUseCase(fileSystem, processor);

    await useCase.execute(baseImageInput);

    expect(processor.process).toHaveBeenCalledWith(localPath, baseImageInput.mimeType);
  });

  it('returns rawOcrText from processor (empty string for vision path)', async () => {
    const fileSystem = makeFileSystem();
    const processor: jest.Mocked<IQuotationDocumentProcessor> = {
      process: jest.fn().mockResolvedValue({ normalized: makeNormalized(), rawOcrText: '' }),
    };
    const useCase = new ProcessQuotationUploadUseCase(fileSystem, processor);

    const result = await useCase.execute(baseImageInput);

    expect(result.rawOcrText).toBe('');
  });

  it('returns rawOcrText from processor (non-empty for text-based path)', async () => {
    const fileSystem = makeFileSystem();
    const processor: jest.Mocked<IQuotationDocumentProcessor> = {
      process: jest.fn().mockResolvedValue({ normalized: makeNormalized(), rawOcrText: 'Some OCR text' }),
    };
    const useCase = new ProcessQuotationUploadUseCase(fileSystem, processor);

    const result = await useCase.execute(baseImageInput);

    expect(result.rawOcrText).toBe('Some OCR text');
  });
});
