/**
 * Unit tests for useQuotationUpload View-Model hook
 * Design: design/issue-210-ocr-screens-refactor.md §8.3
 *
 * Acceptance criteria:
 * - Initial state: processingStep='idle', processingError=null, formInitialValues=undefined
 * - handleUploadPdf() with cancelled picker → processingStep='idle'
 * - handleUploadPdf() with invalid file → validation error, no 'ocr' step
 * - handleUploadPdf() without ocrAdapter/parsingStrategy → formPdfFile set, formInitialValues undefined
 * - handleUploadPdf() with full mock adapters → processingStep='ocr' during, then 'idle' with formInitialValues
 * - handleUploadPdf() pipeline failure → processingStep='error', processingError set, formPdfFile still set
 * - handleSubmit() calls createQuotation then onSuccess and onClose
 * - handleSubmit() on entity error shows Alert, does not call onClose
 * - Default adapters created when no overrides provided
 */

import { renderHook, act } from '@testing-library/react-native';
import { Alert } from 'react-native';

// ── Module mocks ─────────────────────────────────────────────────────────────

jest.mock('../../../src/hooks/useQuotations', () => ({
  useQuotations: jest.fn(),
}));

jest.mock('../../../src/infrastructure/files/MobileFilePickerAdapter', () => ({
  MobileFilePickerAdapter: jest.fn().mockImplementation(() => ({
    pickDocument: jest.fn().mockResolvedValue({ cancelled: true }),
  })),
}));

jest.mock('../../../src/infrastructure/files/MobileFileSystemAdapter', () => ({
  MobileFileSystemAdapter: jest.fn().mockImplementation(() => ({
    copyToAppStorage: jest.fn().mockResolvedValue('file:///app/storage/quote.pdf'),
    exists: jest.fn().mockResolvedValue(true),
    deleteFile: jest.fn(),
    getDocumentsDirectory: jest.fn().mockResolvedValue('/app/documents'),
  })),
}));

jest.mock('../../../src/application/usecases/quotation/ProcessQuotationUploadUseCase', () => ({
  ProcessQuotationUploadUseCase: jest.fn().mockImplementation(() => ({
    execute: jest.fn(),
  })),
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import { useQuotations } from '../../../src/hooks/useQuotations';
import { useQuotationUpload } from '../../../src/hooks/useQuotationUpload';
import { ProcessQuotationUploadUseCase } from '../../../src/application/usecases/quotation/ProcessQuotationUploadUseCase';
import type { IFilePickerAdapter, FilePickerResult } from '../../../src/infrastructure/files/IFilePickerAdapter';
import type { IFileSystemAdapter } from '../../../src/infrastructure/files/IFileSystemAdapter';
import type { IOcrAdapter } from '../../../src/application/services/IOcrAdapter';
import type { IQuotationParsingStrategy, NormalizedQuotation } from '../../../src/application/ai/IQuotationParsingStrategy';

// ── Typed mock helpers ───────────────────────────────────────────────────────

const mockUseQuotations = useQuotations as jest.MockedFunction<typeof useQuotations>;
const MockProcessQuotationUploadUseCase = ProcessQuotationUploadUseCase as jest.MockedClass<
  typeof ProcessQuotationUploadUseCase
>;

const MOCK_CREATED_QUOTATION = {
  id: 'quot_test_123',
  reference: 'QUO-20260327-ABCDEF',
  date: new Date('2026-03-27'),
  total: 1100,
  currency: 'AUD',
  status: 'draft' as const,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const DEFAULT_USE_QUOTATIONS = {
  createQuotation: jest.fn().mockResolvedValue(MOCK_CREATED_QUOTATION),
  listQuotations: jest.fn(),
  getQuotation: jest.fn(),
  updateQuotation: jest.fn(),
  deleteQuotation: jest.fn(),
  approveQuotation: jest.fn(),
  declineQuotation: jest.fn(),
  taskQuotations: undefined,
  loading: false,
  error: null,
};

const NORMALIZED_QUOTATION: NormalizedQuotation = {
  reference: 'Q-001',
  vendor: 'Builder Co',
  vendorEmail: null,
  vendorPhone: null,
  vendorAddress: null,
  taxId: null,
  date: new Date('2026-03-01'),
  expiryDate: new Date('2026-04-01'),
  currency: 'AUD',
  subtotal: 1000,
  tax: 100,
  total: 1100,
  lineItems: [],
  paymentTerms: null,
  scope: null,
  exclusions: null,
  notes: null,
  confidence: { overall: 0.9, vendor: 0.9, reference: 0.8, date: 0.9, total: 0.95 },
  suggestedCorrections: [],
};

function makeFilePicker(override: Partial<FilePickerResult> = {}): IFilePickerAdapter {
  return {
    pickDocument: jest.fn().mockResolvedValue({
      cancelled: false,
      uri: 'file:///tmp/quote.pdf',
      name: 'quote.pdf',
      size: 102400,
      type: 'application/pdf',
      ...override,
    }),
  };
}

function makeFileSystem(): IFileSystemAdapter {
  return {
    copyToAppStorage: jest.fn().mockResolvedValue('file:///app/storage/quote_123.pdf'),
    exists: jest.fn().mockResolvedValue(true),
    deleteFile: jest.fn().mockResolvedValue(undefined),
    getDocumentsDirectory: jest.fn().mockResolvedValue('/app/documents'),
  };
}

function makeOcrAdapter(): IOcrAdapter {
  return {
    extractText: jest.fn().mockResolvedValue({
      fullText: 'Quote from Builder Co',
      tokens: [],
      confidence: 0.9,
    }),
  };
}

function makeParsingStrategy(normalized?: NormalizedQuotation): IQuotationParsingStrategy {
  return {
    strategyType: 'llm',
    parse: jest.fn().mockResolvedValue(normalized ?? NORMALIZED_QUOTATION),
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useQuotationUpload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseQuotations.mockReturnValue({ ...DEFAULT_USE_QUOTATIONS } as any);
  });

  // AC: Initial state
  describe('initial state', () => {
    it('returns processingStep="idle", processingError=null, formInitialValues=undefined', () => {
      const { result } = renderHook(() =>
        useQuotationUpload({ onClose: jest.fn() }),
      );
      expect(result.current.processingStep).toBe('idle');
      expect(result.current.processingError).toBeNull();
      expect(result.current.formInitialValues).toBeUndefined();
      expect(result.current.formPdfFile).toBeUndefined();
    });
  });

  // AC: handleUploadPdf with cancelled picker
  describe('handleUploadPdf — cancelled picker', () => {
    it('returns processingStep="idle" without error', async () => {
      const picker = makeFilePicker({ cancelled: true });

      const { result } = renderHook(() =>
        useQuotationUpload({ onClose: jest.fn(), filePickerAdapter: picker }),
      );

      await act(async () => {
        await result.current.handleUploadPdf();
      });

      expect(result.current.processingStep).toBe('idle');
      expect(result.current.processingError).toBeNull();
    });
  });

  // AC: handleUploadPdf with invalid file
  describe('handleUploadPdf — invalid file', () => {
    it('shows validation error and does not enter ocr step', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
      const picker = makeFilePicker({ type: 'application/msword', name: 'doc.doc' });

      const { result } = renderHook(() =>
        useQuotationUpload({ onClose: jest.fn(), filePickerAdapter: picker }),
      );

      await act(async () => {
        await result.current.handleUploadPdf();
      });

      expect(alertSpy).toHaveBeenCalled();
      expect(result.current.processingStep).toBe('idle');
    });
  });

  // AC: handleUploadPdf without OCR adapters
  describe('handleUploadPdf — no OCR adapters (graceful degradation)', () => {
    it('sets formPdfFile but leaves formInitialValues undefined', async () => {
      const picker = makeFilePicker();
      const fileSystem = makeFileSystem();

      const { result } = renderHook(() =>
        useQuotationUpload({
          onClose: jest.fn(),
          filePickerAdapter: picker,
          fileSystemAdapter: fileSystem,
          // no ocrAdapter, no parsingStrategy
        }),
      );

      await act(async () => {
        await result.current.handleUploadPdf();
      });

      expect(result.current.processingStep).toBe('idle');
      expect(result.current.formPdfFile).toBeDefined();
      expect(result.current.formInitialValues).toBeUndefined();
    });
  });

  // AC: handleUploadPdf with full mock adapters
  describe('handleUploadPdf — full OCR pipeline success', () => {
    it('resolves to processingStep="idle" and formInitialValues populated', async () => {
      const picker = makeFilePicker({ type: 'image/jpeg', name: 'quote.jpg' }); // image path avoids pdfConverter
      const fileSystem = makeFileSystem();
      const ocrAdapter = makeOcrAdapter();
      const parsingStrategy = makeParsingStrategy();

      MockProcessQuotationUploadUseCase.mockImplementation(() => ({
        execute: jest.fn().mockResolvedValue({
          normalized: NORMALIZED_QUOTATION,
          documentRef: { localPath: '/file', filename: 'quote.jpg', size: 100, mimeType: 'image/jpeg' },
          rawOcrText: 'quote raw text',
        }),
      }) as any);

      const { result } = renderHook(() =>
        useQuotationUpload({
          onClose: jest.fn(),
          filePickerAdapter: picker,
          fileSystemAdapter: fileSystem,
          ocrAdapter,
          parsingStrategy,
        }),
      );

      await act(async () => {
        await result.current.handleUploadPdf();
      });

      expect(result.current.processingStep).toBe('idle');
      expect(result.current.formInitialValues).toBeDefined();
      expect(result.current.processingError).toBeNull();
    });
  });

  // AC: handleUploadPdf pipeline failure
  describe('handleUploadPdf — OCR pipeline failure', () => {
    it('sets processingStep="error" and processingError, formPdfFile still set', async () => {
      const picker = makeFilePicker({ type: 'image/jpeg', name: 'quote.jpg' });
      const fileSystem = makeFileSystem();
      const ocrAdapter = makeOcrAdapter();
      const parsingStrategy = makeParsingStrategy();

      MockProcessQuotationUploadUseCase.mockImplementation(() => ({
        execute: jest.fn().mockRejectedValue(new Error('Quotation processing failed: OCR service unavailable')),
      }) as any);

      const { result } = renderHook(() =>
        useQuotationUpload({
          onClose: jest.fn(),
          filePickerAdapter: picker,
          fileSystemAdapter: fileSystem,
          ocrAdapter,
          parsingStrategy,
        }),
      );

      await act(async () => {
        await result.current.handleUploadPdf();
      });

      expect(result.current.processingStep).toBe('error');
      expect(result.current.processingError).toContain('OCR service unavailable');
      expect(result.current.formPdfFile).toBeDefined();
    });
  });

  // AC: handleSubmit calls createQuotation then onSuccess and onClose
  describe('handleSubmit — success', () => {
    it('calls createQuotation, then onSuccess and onClose', async () => {
      const onClose = jest.fn();
      const onSuccess = jest.fn();
      const createQuotation = jest.fn().mockResolvedValue(MOCK_CREATED_QUOTATION);
      mockUseQuotations.mockReturnValue({
        ...DEFAULT_USE_QUOTATIONS,
        createQuotation,
      } as any);

      const { result } = renderHook(() =>
        useQuotationUpload({ onClose, onSuccess }),
      );

      await act(async () => {
        await result.current.handleSubmit({
          reference: 'Q-001',
          vendorName: 'Builder Co',
          total: 1100,
          currency: 'AUD',
          status: 'draft',
          projectId: undefined,
          date: new Date().toISOString(),
        } as any);
      });

      expect(createQuotation).toHaveBeenCalled();
      expect(onSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'quot_test_123' }),
      );
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  // AC: handleSubmit on entity validation error
  describe('handleSubmit — entity validation error', () => {
    it('shows Alert and does not call onClose', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
      const onClose = jest.fn();

      // Provide invalid data to trigger QuotationEntity.create validation error
      const createQuotation = jest.fn().mockRejectedValue(new Error('Validation failed'));
      mockUseQuotations.mockReturnValue({
        ...DEFAULT_USE_QUOTATIONS,
        createQuotation,
      } as any);

      const { result } = renderHook(() =>
        useQuotationUpload({ onClose }),
      );

      await act(async () => {
        await result.current.handleSubmit({
          reference: 'Q-001',
          vendorName: 'Builder Co',
          total: 1100,
          currency: 'AUD',
          status: 'draft',
          projectId: undefined,
          date: new Date().toISOString(),
        } as any);
      });

      expect(alertSpy).toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // AC: Default adapter instantiation
  describe('default adapter instantiation', () => {
    it('does not throw when no adapter overrides are provided', () => {
      expect(() => {
        renderHook(() =>
          useQuotationUpload({ onClose: jest.fn() }),
        );
      }).not.toThrow();
    });
  });
});
