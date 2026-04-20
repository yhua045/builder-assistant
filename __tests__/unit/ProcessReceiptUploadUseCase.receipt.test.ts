import {
  ProcessReceiptUploadUseCase,
  ProcessReceiptUploadInput,
} from '../../src/application/usecases/receipt/ProcessReceiptUploadUseCase';
import { IOcrAdapter, OcrResult } from '../../src/application/services/IOcrAdapter';
import { IReceiptParsingStrategy } from '../../src/application/receipt/IReceiptParsingStrategy';
import { NormalizedReceipt } from '../../src/application/receipt/IReceiptNormalizer';
import { IPdfConverter } from '../../src/infrastructure/files/IPdfConverter';

function makeOcrResult(text = 'OCR receipt text'): OcrResult {
  return { fullText: text, tokens: [], imageUri: 'file:///tmp/img.jpg' };
}

function makeNormalizedReceipt(
  overrides: Partial<NormalizedReceipt> = {},
): NormalizedReceipt {
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

function makeOcrAdapter(ocrResult?: OcrResult): IOcrAdapter {
  return {
    extractText: jest.fn().mockResolvedValue(ocrResult ?? makeOcrResult()),
  };
}

function makeParsingStrategy(normalized?: NormalizedReceipt): IReceiptParsingStrategy {
  return {
    strategyType: 'llm',
    parse: jest.fn().mockResolvedValue(normalized ?? makeNormalizedReceipt()),
  };
}

function makePdfConverter(pages: { uri: string }[] = [{ uri: 'file:///tmp/page1.jpg' }]): IPdfConverter {
  return {
    convertToImages: jest.fn().mockResolvedValue(pages),
    getPageCount: jest.fn().mockResolvedValue(pages.length),
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
  describe('image path', () => {
    it('returns normalized receipt and rawOcrText for image file', async () => {
      const ocrAdapter = makeOcrAdapter();
      const strategy = makeParsingStrategy();
      const useCase = new ProcessReceiptUploadUseCase(ocrAdapter, strategy);

      const output = await useCase.execute(imageInput);

      expect(output.normalized.vendor).toBe('Bunnings');
      expect(output.rawOcrText).toBe('OCR receipt text');
    });

    it('passes OcrResult to strategy.parse()', async () => {
      const ocrResult = makeOcrResult('Custom OCR text');
      const ocrAdapter = makeOcrAdapter(ocrResult);
      const strategy = makeParsingStrategy();
      const useCase = new ProcessReceiptUploadUseCase(ocrAdapter, strategy);

      await useCase.execute(imageInput);

      expect(strategy.parse).toHaveBeenCalledWith(ocrResult);
    });

    it('throws wrapped error when OCR fails', async () => {
      const ocrAdapter: IOcrAdapter = {
        extractText: jest.fn().mockRejectedValue(new Error('OCR service down')),
      };
      const strategy = makeParsingStrategy();
      const useCase = new ProcessReceiptUploadUseCase(ocrAdapter, strategy);

      await expect(useCase.execute(imageInput)).rejects.toThrow(
        'Receipt processing failed: OCR service down',
      );
    });
  });

  describe('PDF path', () => {
    it('returns empty result when no pdfConverter provided', async () => {
      const ocrAdapter = makeOcrAdapter();
      const strategy = makeParsingStrategy();
      const useCase = new ProcessReceiptUploadUseCase(ocrAdapter, strategy);

      const output = await useCase.execute(pdfInput);

      expect(output.normalized.vendor).toBeNull();
      expect(output.rawOcrText).toBe('');
    });

    it('converts PDF pages and passes merged OCR to strategy', async () => {
      const ocrAdapter = makeOcrAdapter();
      const strategy = makeParsingStrategy();
      const pdfConverter = makePdfConverter([
        { uri: 'file:///tmp/page1.jpg' },
        { uri: 'file:///tmp/page2.jpg' },
      ]);
      const useCase = new ProcessReceiptUploadUseCase(ocrAdapter, strategy, pdfConverter);

      const output = await useCase.execute(pdfInput);

      expect(pdfConverter.convertToImages).toHaveBeenCalledWith(pdfInput.fileUri);
      expect(output.normalized.vendor).toBe('Bunnings');
    });

    it('returns empty result when PDF has no pages', async () => {
      const ocrAdapter = makeOcrAdapter();
      const strategy = makeParsingStrategy();
      const pdfConverter = makePdfConverter([]); // zero pages
      const useCase = new ProcessReceiptUploadUseCase(ocrAdapter, strategy, pdfConverter);

      const output = await useCase.execute(pdfInput);

      expect(output.normalized.vendor).toBeNull();
      expect(output.rawOcrText).toBe('');
    });

    it('throws wrapped error when PDF conversion fails', async () => {
      const ocrAdapter = makeOcrAdapter();
      const strategy = makeParsingStrategy();
      const pdfConverter: IPdfConverter = {
        convertToImages: jest.fn().mockRejectedValue(new Error('PDF conversion failed')),
        getPageCount: jest.fn().mockResolvedValue(0),
      };
      const useCase = new ProcessReceiptUploadUseCase(ocrAdapter, strategy, pdfConverter);

      await expect(useCase.execute(pdfInput)).rejects.toThrow(
        'Receipt processing failed: PDF conversion failed',
      );
    });
  });
});
