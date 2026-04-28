import {
  ProcessQuotationUploadUseCase,
  ProcessQuotationUploadInput,
} from '../../application/ProcessQuotationUploadUseCase';
import { IOcrAdapter, OcrResult } from '../../../../application/services/IOcrAdapter';
import {
  IQuotationParsingStrategy,
  NormalizedQuotation,
} from '../../application/ai/IQuotationParsingStrategy';
import { IPdfConverter } from '../../../../infrastructure/files/IPdfConverter';
import { IFileSystemAdapter } from '../../../../infrastructure/files/IFileSystemAdapter';

function makeOcrResult(text = 'OCR text'): OcrResult {
  return { fullText: text, tokens: [], imageUri: 'file:///tmp/img.jpg' };
}

const mockFileSystem: IFileSystemAdapter = {
  copyToAppStorage: jest.fn().mockImplementation((uri) => Promise.resolve(uri)),
  exists: jest.fn().mockResolvedValue(true),
  deleteFile: jest.fn().mockResolvedValue(undefined),
  getDocumentsDirectory: jest.fn().mockResolvedValue('/app/docs'),
};

function makeNormalizedQuotation(
  overrides: Partial<NormalizedQuotation> = {},
): NormalizedQuotation {
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

function makeOcrAdapter(ocrResult?: OcrResult): IOcrAdapter {
  return {
    extractText: jest.fn().mockResolvedValue(ocrResult ?? makeOcrResult()),
  };
}

function makeParsingStrategy(normalized?: NormalizedQuotation): IQuotationParsingStrategy {
  return {
    strategyType: 'llm',
    parse: jest.fn().mockResolvedValue(normalized ?? makeNormalizedQuotation()),
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
  describe('image path', () => {
    it('returns normalized quotation and documentRef for image file', async () => {
      const ocrAdapter = makeOcrAdapter();
      const strategy = makeParsingStrategy();
      const useCase = new ProcessQuotationUploadUseCase(strategy, undefined, mockFileSystem, ocrAdapter);

      const output = await useCase.execute(imageInput);

      expect(output.normalized.vendor).toBe('Builder Co');
      expect(output.documentRef).toMatchObject({
        localPath: imageInput.fileUri,
        filename: imageInput.filename,
        size: imageInput.fileSize,
        mimeType: imageInput.mimeType,
      });
    });

    it('passes OcrResult to strategy.parse()', async () => {
      const ocrResult = makeOcrResult('Custom OCR text');
      const ocrAdapter = makeOcrAdapter(ocrResult);
      const strategy = makeParsingStrategy();
      const useCase = new ProcessQuotationUploadUseCase(strategy, undefined, mockFileSystem, ocrAdapter);

      await useCase.execute(imageInput);

      expect(strategy.parse).toHaveBeenCalledWith(ocrResult);
    });

    it('rawOcrText is the fullText from OCR', async () => {
      const ocrAdapter = makeOcrAdapter(makeOcrResult('Some OCR text'));
      const strategy = makeParsingStrategy();
      const useCase = new ProcessQuotationUploadUseCase(strategy, undefined, mockFileSystem, ocrAdapter);

      const output = await useCase.execute(imageInput);

      expect(output.rawOcrText).toBe('Some OCR text');
    });

    it('throws wrapped error when OCR fails', async () => {
      const ocrAdapter: IOcrAdapter = {
        extractText: jest.fn().mockRejectedValue(new Error('OCR service down')),
      };
      const strategy = makeParsingStrategy();
      const useCase = new ProcessQuotationUploadUseCase(strategy, undefined, mockFileSystem, ocrAdapter);

      await expect(useCase.execute(imageInput)).rejects.toThrow(
        'Quotation processing failed: OCR service down',
      );
    });

    it('throws wrapped error when strategy.parse() fails', async () => {
      const ocrAdapter = makeOcrAdapter();
      const strategy: IQuotationParsingStrategy = {
        strategyType: 'llm',
        parse: jest.fn().mockRejectedValue(new Error('LLM error')),
      };
      const useCase = new ProcessQuotationUploadUseCase(strategy, undefined, mockFileSystem, ocrAdapter);

      await expect(useCase.execute(imageInput)).rejects.toThrow(
        'Quotation processing failed: LLM error',
      );
    });
  });

  describe('PDF path — no pdfConverter', () => {
    it('returns empty NormalizedQuotation gracefully', async () => {
      const ocrAdapter = makeOcrAdapter();
      const strategy = makeParsingStrategy();
      const useCase = new ProcessQuotationUploadUseCase(strategy, undefined, mockFileSystem, ocrAdapter);

      const output = await useCase.execute(pdfInput);

      expect(output.normalized.vendor).toBeNull();
      expect(output.normalized.currency).toBe('AUD');
      expect(output.normalized.lineItems).toHaveLength(0);
      expect(output.rawOcrText).toBe('');
      expect(strategy.parse).not.toHaveBeenCalled();
    });
  });

  describe('PDF path — with pdfConverter', () => {
    it('converts PDF to images, runs OCR, passes merged result to strategy', async () => {
      const pdfConverter: IPdfConverter = {
        convertToImages: jest.fn().mockResolvedValue([
          { uri: 'file:///tmp/page1.jpg', pageIndex: 0 },
          { uri: 'file:///tmp/page2.jpg', pageIndex: 1 },
        ]),
        getPageCount: jest.fn().mockResolvedValue(2),
      };
      const ocrAdapter = makeOcrAdapter(makeOcrResult('Page OCR'));
      const strategy = makeParsingStrategy();
      const useCase = new ProcessQuotationUploadUseCase(strategy, pdfConverter, mockFileSystem, ocrAdapter);

      const output = await useCase.execute(pdfInput);

      expect(pdfConverter.convertToImages).toHaveBeenCalledWith(pdfInput.fileUri);
      expect(ocrAdapter.extractText).toHaveBeenCalledTimes(2);
      expect(strategy.parse).toHaveBeenCalledTimes(1);
      expect(output.normalized.vendor).toBe('Builder Co');
    });

    it('returns empty NormalizedQuotation when PDF has no pages', async () => {
      const pdfConverter: IPdfConverter = {
        convertToImages: jest.fn().mockResolvedValue([]),
        getPageCount: jest.fn().mockResolvedValue(0),
      };
      const ocrAdapter = makeOcrAdapter();
      const strategy = makeParsingStrategy();
      const useCase = new ProcessQuotationUploadUseCase(strategy, pdfConverter, mockFileSystem, ocrAdapter);

      const output = await useCase.execute(pdfInput);

      expect(output.normalized.vendor).toBeNull();
      expect(output.rawOcrText).toBe('');
      expect(strategy.parse).not.toHaveBeenCalled();
    });

    it('throws wrapped error when PDF conversion fails', async () => {
      const pdfConverter: IPdfConverter = {
        convertToImages: jest.fn().mockRejectedValue(new Error('PDF conversion failed')),
        getPageCount: jest.fn().mockResolvedValue(0),
      };
      const ocrAdapter = makeOcrAdapter();
      const strategy = makeParsingStrategy();
      const useCase = new ProcessQuotationUploadUseCase(strategy, pdfConverter, mockFileSystem, ocrAdapter);

      await expect(useCase.execute(pdfInput)).rejects.toThrow(
        'Quotation processing failed: PDF conversion failed',
      );
    });
  });
});
