import {
  ProcessReceiptUploadUseCase,
  ProcessReceiptUploadInput,
} from '../../application/ProcessReceiptUploadUseCase';
import { IReceiptDocumentProcessor } from '../../application/IReceiptDocumentProcessor';
import { NormalizedReceipt } from '../../application/IReceiptNormalizer';

function makeNormalizedReceipt(overrides: Partial<NormalizedReceipt> = {}): NormalizedReceipt {
  return {
    vendor: 'Bunnings',
    date: new Date('2026-04-10'),
    total: 150.0,
    subtotal: 136.36,
    tax: 13.64,
    currency: 'AUD',
    paymentMethod: 'card',
    receiptNumber: 'REC-001',
    lineItems: [],
    notes: null,
    confidence: { overall: 0.9, vendor: 0.9, date: 0.9, total: 0.9 },
    suggestedCorrections: [],
    ...overrides,
  };
}

function makeProcessor(
  normalized?: NormalizedReceipt,
  error?: Error,
): jest.Mocked<IReceiptDocumentProcessor> {
  return {
    process: error
      ? jest.fn().mockRejectedValue(error)
      : jest.fn().mockResolvedValue({
          normalized: normalized ?? makeNormalizedReceipt(),
          rawOcrText: 'OCR receipt text',
        }),
  };
}

const imageInput: ProcessReceiptUploadInput = {
  fileUri: 'file:///app/receipt_123.jpg',
  filename: 'receipt.jpg',
  mimeType: 'image/jpeg',
  fileSize: 102400,
};

const pdfInput: ProcessReceiptUploadInput = {
  fileUri: 'file:///app/receipt_123.pdf',
  filename: 'receipt.pdf',
  mimeType: 'application/pdf',
  fileSize: 204800,
};

describe('ProcessReceiptUploadUseCase', () => {
  describe('validation', () => {
    it('throws Validation failed for invalid mimeType', async () => {
      const processor = makeProcessor();
      const useCase = new ProcessReceiptUploadUseCase(processor);

      await expect(
        useCase.execute({ ...imageInput, mimeType: 'text/csv' }),
      ).rejects.toThrow('Validation failed');
    });

    it('throws Validation failed for oversized file', async () => {
      const processor = makeProcessor();
      const useCase = new ProcessReceiptUploadUseCase(processor);

      await expect(
        useCase.execute({ ...imageInput, fileSize: 999_999_999 }),
      ).rejects.toThrow('Validation failed');
    });
  });

  describe('processor delegation — image path', () => {
    it('calls processor.process with fileUri and mimeType', async () => {
      const processor = makeProcessor();
      const useCase = new ProcessReceiptUploadUseCase(processor);

      await useCase.execute(imageInput);

      expect(processor.process).toHaveBeenCalledWith(imageInput.fileUri, imageInput.mimeType);
    });

    it('returns normalized receipt and rawOcrText from processor', async () => {
      const normalized = makeNormalizedReceipt();
      const processor = makeProcessor(normalized);
      const useCase = new ProcessReceiptUploadUseCase(processor);

      const output = await useCase.execute(imageInput);

      expect(output.normalized.vendor).toBe('Bunnings');
      expect(output.rawOcrText).toBe('OCR receipt text');
    });

    it('propagates processor errors', async () => {
      const processor = makeProcessor(undefined, new Error('Processing failed'));
      const useCase = new ProcessReceiptUploadUseCase(processor);

      await expect(useCase.execute(imageInput)).rejects.toThrow('Processing failed');
    });
  });

  describe('processor delegation — PDF path', () => {
    it('calls processor.process with PDF fileUri and mimeType', async () => {
      const processor = makeProcessor();
      const useCase = new ProcessReceiptUploadUseCase(processor);

      await useCase.execute(pdfInput);

      expect(processor.process).toHaveBeenCalledWith(pdfInput.fileUri, pdfInput.mimeType);
    });
  });
});
