/**
 * Vision routing for receipts is now tested via VisionBasedReceiptProcessor.test.ts.
 * This file verifies the simplified use case delegates to any processor uniformly.
 */
import {
  ProcessReceiptUploadUseCase,
  ProcessReceiptUploadInput,
} from '../../application/ProcessReceiptUploadUseCase';
import { IReceiptDocumentProcessor } from '../../application/IReceiptDocumentProcessor';
import { NormalizedReceipt } from '../../application/IReceiptNormalizer';

function makeNormalizedReceipt(): NormalizedReceipt {
  return {
    vendor: 'Bunnings',
    date: new Date('2026-04-10'),
    total: 150.0,
    subtotal: 136.36,
    tax: 13.64,
    currency: 'AUD',
    paymentMethod: 'card',
    receiptNumber: null,
    lineItems: [],
    notes: null,
    confidence: { overall: 0.9, vendor: 0.9, date: 0.9, total: 0.9 },
    suggestedCorrections: [],
  };
}

const imageInput: ProcessReceiptUploadInput = {
  fileUri: 'file:///app/receipt.jpg',
  filename: 'receipt.jpg',
  mimeType: 'image/jpeg',
  fileSize: 512_000,
};

describe('ProcessReceiptUploadUseCase — processor delegation', () => {
  it('calls processor.process and returns empty rawOcrText (vision path)', async () => {
    const processor: jest.Mocked<IReceiptDocumentProcessor> = {
      process: jest.fn().mockResolvedValue({ normalized: makeNormalizedReceipt(), rawOcrText: '' }),
    };
    const useCase = new ProcessReceiptUploadUseCase(processor);

    const result = await useCase.execute(imageInput);

    expect(processor.process).toHaveBeenCalledWith(imageInput.fileUri, imageInput.mimeType);
    expect(result.rawOcrText).toBe('');
  });

  it('calls processor.process and returns non-empty rawOcrText (text path)', async () => {
    const processor: jest.Mocked<IReceiptDocumentProcessor> = {
      process: jest.fn().mockResolvedValue({ normalized: makeNormalizedReceipt(), rawOcrText: 'some ocr' }),
    };
    const useCase = new ProcessReceiptUploadUseCase(processor);

    const result = await useCase.execute(imageInput);

    expect(result.rawOcrText).toBe('some ocr');
  });
});
