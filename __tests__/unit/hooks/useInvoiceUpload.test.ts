/**
 * Unit tests for useInvoiceUpload View-Model hook
 * Design: design/issue-210-ocr-screens-refactor.md §8.2
 *
 * Acceptance criteria:
 * - Initial state: view='upload', processingStep='idle', processingError=null, normalizedResult=null
 * - handleUploadPdf() with cancelled picker → processingStep='idle', no state change
 * - handleUploadPdf() with invalid file type/size → processingStep='idle', Alert shown
 * - handleUploadPdf() without ocrAdapter/invoiceNormalizer → skips pipeline, view='form'
 * - handleUploadPdf() with full mock adapters → transitions 'idle'→'copying'→'ocr'→view='form'
 * - handleRetryExtraction() with cached PDF re-runs pipeline
 * - handleFallbackToManual() → view='form', formInitialValues=undefined
 * - handleFormSave() on success calls onClose
 * - handleFormSave() on failure shows Alert
 * - handleFormCancel() → view='upload'
 * - Default adapters are created when no overrides are provided
 */

import { renderHook, act } from '@testing-library/react-native';
import { Alert } from 'react-native';

// ── Module mocks ─────────────────────────────────────────────────────────────

jest.mock('../../../src/hooks/useInvoices', () => ({
  useInvoices: jest.fn(),
}));

jest.mock('../../../src/infrastructure/files/MobileFilePickerAdapter', () => ({
  MobileFilePickerAdapter: jest.fn().mockImplementation(() => ({
    pickDocument: jest.fn().mockResolvedValue({ cancelled: true }),
  })),
}));

jest.mock('../../../src/infrastructure/files/MobileFileSystemAdapter', () => ({
  MobileFileSystemAdapter: jest.fn().mockImplementation(() => ({
    copyToAppStorage: jest.fn().mockResolvedValue('file:///app/storage/invoice.pdf'),
    exists: jest.fn().mockResolvedValue(true),
    deleteFile: jest.fn(),
    getDocumentsDirectory: jest.fn().mockResolvedValue('/app/documents'),
  })),
}));

jest.mock('../../../src/application/usecases/invoice/ProcessInvoiceUploadUseCase', () => ({
  ProcessInvoiceUploadUseCase: jest.fn().mockImplementation(() => ({
    execute: jest.fn(),
  })),
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import { useInvoices } from '../../../src/hooks/useInvoices';
import { useInvoiceUpload } from '../../../src/hooks/useInvoiceUpload';
import { ProcessInvoiceUploadUseCase } from '../../../src/application/usecases/invoice/ProcessInvoiceUploadUseCase';
import type { IFilePickerAdapter, FilePickerResult } from '../../../src/infrastructure/files/IFilePickerAdapter';
import type { IFileSystemAdapter } from '../../../src/infrastructure/files/IFileSystemAdapter';
import type { IOcrAdapter } from '../../../src/application/services/IOcrAdapter';
import type { IInvoiceNormalizer } from '../../../src/application/ai/IInvoiceNormalizer';

// ── Typed mock helpers ───────────────────────────────────────────────────────

const mockUseInvoices = useInvoices as jest.MockedFunction<typeof useInvoices>;
const MockProcessInvoiceUploadUseCase = ProcessInvoiceUploadUseCase as jest.MockedClass<
  typeof ProcessInvoiceUploadUseCase
>;

const DEFAULT_USE_INVOICES = {
  invoices: [],
  loading: false,
  error: null,
  createInvoice: jest.fn().mockResolvedValue({ success: true }),
  updateInvoice: jest.fn(),
  deleteInvoice: jest.fn(),
  getInvoiceById: jest.fn(),
  refreshInvoices: jest.fn(),
};

const NORMALIZED_INVOICE = {
  vendor: 'ABC Supplies',
  invoiceNumber: 'INV-001',
  invoiceDate: new Date('2026-03-01'),
  dueDate: new Date('2026-04-01'),
  subtotal: 1000,
  tax: 100,
  total: 1100,
  currency: 'AUD',
  lineItems: [],
  confidence: { overall: 0.9, vendor: 0.9, invoiceNumber: 0.8, invoiceDate: 0.9, total: 0.95 },
  suggestedCorrections: [],
};

function makeFilePicker(override: Partial<FilePickerResult> = {}): IFilePickerAdapter {
  return {
    pickDocument: jest.fn().mockResolvedValue({
      cancelled: false,
      uri: 'file:///tmp/invoice.pdf',
      name: 'invoice.pdf',
      size: 102400,
      type: 'application/pdf',
      ...override,
    }),
  };
}

function makeFileSystem(): IFileSystemAdapter {
  return {
    copyToAppStorage: jest.fn().mockResolvedValue('file:///app/storage/invoice_123.pdf'),
    exists: jest.fn().mockResolvedValue(true),
    deleteFile: jest.fn().mockResolvedValue(undefined),
    getDocumentsDirectory: jest.fn().mockResolvedValue('/app/documents'),
  };
}

function makeOcrAdapter(): IOcrAdapter {
  return {
    extractText: jest.fn().mockResolvedValue({
      fullText: 'Invoice from ABC Supplies',
      tokens: [],
      confidence: 0.9,
    }),
  };
}

function makeInvoiceNormalizer(): IInvoiceNormalizer {
  return {
    extractCandidates: jest.fn().mockResolvedValue({}),
    normalize: jest.fn().mockResolvedValue(NORMALIZED_INVOICE),
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useInvoiceUpload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseInvoices.mockReturnValue({ ...DEFAULT_USE_INVOICES } as any);
  });

  // AC: Initial state
  describe('initial state', () => {
    it('returns view="upload", processingStep="idle", processingError=null, normalizedResult=null', () => {
      const { result } = renderHook(() =>
        useInvoiceUpload({ onClose: jest.fn() }),
      );
      expect(result.current.view).toBe('upload');
      expect(result.current.processingStep).toBe('idle');
      expect(result.current.processingError).toBeNull();
      expect(result.current.normalizedResult).toBeNull();
      expect(result.current.formInitialValues).toBeUndefined();
    });
  });

  // AC: handleUploadPdf with cancelled picker
  describe('handleUploadPdf — cancelled picker', () => {
    it('returns processingStep="idle" without changing view', async () => {
      const picker = makeFilePicker({ cancelled: true });

      const { result } = renderHook(() =>
        useInvoiceUpload({ onClose: jest.fn(), filePickerAdapter: picker }),
      );

      await act(async () => {
        await result.current.handleUploadPdf();
      });

      expect(result.current.processingStep).toBe('idle');
      expect(result.current.view).toBe('upload');
    });
  });

  // AC: handleUploadPdf with invalid file
  describe('handleUploadPdf — invalid file', () => {
    it('sets processingStep="idle" and shows Alert for unsupported file type', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
      const picker = makeFilePicker({ type: 'application/msword', name: 'document.doc' });

      const { result } = renderHook(() =>
        useInvoiceUpload({ onClose: jest.fn(), filePickerAdapter: picker }),
      );

      await act(async () => {
        await result.current.handleUploadPdf();
      });

      expect(result.current.processingStep).toBe('idle');
      expect(alertSpy).toHaveBeenCalled();
    });

    it('shows "File Too Large" alert for file over 20MB', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
      const picker = makeFilePicker({ size: 25 * 1024 * 1024 }); // 25MB

      const { result } = renderHook(() =>
        useInvoiceUpload({ onClose: jest.fn(), filePickerAdapter: picker }),
      );

      await act(async () => {
        await result.current.handleUploadPdf();
      });

      expect(alertSpy).toHaveBeenCalledWith('File Too Large', expect.any(String));
    });
  });

  // AC: handleUploadPdf without OCR adapters — skips pipeline
  describe('handleUploadPdf — no OCR adapters', () => {
    it('transitions to view="form" directly when ocrAdapter/invoiceNormalizer are absent', async () => {
      const picker = makeFilePicker();
      const fileSystem = makeFileSystem();

      const { result } = renderHook(() =>
        useInvoiceUpload({
          onClose: jest.fn(),
          filePickerAdapter: picker,
          fileSystemAdapter: fileSystem,
          // no ocrAdapter, no invoiceNormalizer
        }),
      );

      await act(async () => {
        await result.current.handleUploadPdf();
      });

      expect(result.current.view).toBe('form');
      expect(result.current.processingStep).toBe('idle');
      expect(result.current.formInitialValues).toBeUndefined();
    });
  });

  // AC: handleUploadPdf with full mock adapters
  describe('handleUploadPdf — with full OCR pipeline', () => {
    it('transitions to view="form" and populates formInitialValues', async () => {
      const picker = makeFilePicker();
      const fileSystem = makeFileSystem();
      const ocrAdapter = makeOcrAdapter();
      const invoiceNormalizer = makeInvoiceNormalizer();

      // Make ProcessInvoiceUploadUseCase.execute return our normalized invoice
      MockProcessInvoiceUploadUseCase.mockImplementation(() => ({
        execute: jest.fn().mockResolvedValue({
          normalized: NORMALIZED_INVOICE,
          documentRef: { localPath: '/file', filename: 'invoice.pdf', size: 100, mimeType: 'application/pdf' },
          rawOcrText: 'raw ocr text',
        }),
      }) as any);

      const { result } = renderHook(() =>
        useInvoiceUpload({
          onClose: jest.fn(),
          filePickerAdapter: picker,
          fileSystemAdapter: fileSystem,
          ocrAdapter,
          invoiceNormalizer,
        }),
      );

      await act(async () => {
        await result.current.handleUploadPdf();
      });

      expect(result.current.view).toBe('form');
      expect(result.current.formInitialValues).toBeDefined();
      expect(result.current.formPdfFile).toBeDefined();
    });
  });

  // AC: handleRetryExtraction with cached PDF
  describe('handleRetryExtraction', () => {
    it('re-runs the pipeline with cached PDF on retry', async () => {
      const picker = makeFilePicker();
      const fileSystem = makeFileSystem();
      const mockExecute = jest.fn().mockResolvedValue({
        normalized: NORMALIZED_INVOICE,
        documentRef: { localPath: '/file', filename: 'invoice.pdf', size: 100, mimeType: 'application/pdf' },
        rawOcrText: '',
      });
      MockProcessInvoiceUploadUseCase.mockImplementation(() => ({ execute: mockExecute }) as any);

      const ocrAdapter = makeOcrAdapter();
      const invoiceNormalizer = makeInvoiceNormalizer();

      const { result } = renderHook(() =>
        useInvoiceUpload({
          onClose: jest.fn(),
          filePickerAdapter: picker,
          fileSystemAdapter: fileSystem,
          ocrAdapter,
          invoiceNormalizer,
        }),
      );

      // First upload to populate cachedPdfFile
      await act(async () => {
        await result.current.handleUploadPdf();
      });
      expect(result.current.view).toBe('form');

      // Reset view to test retry
      act(() => { result.current.handleFormCancel(); });

      // Retry
      await act(async () => {
        await result.current.handleRetryExtraction();
      });

      // execute should have been called twice (initial + retry)
      expect(mockExecute).toHaveBeenCalledTimes(2);
    });
  });

  // AC: handleFallbackToManual
  describe('handleFallbackToManual', () => {
    it('transitions view to "form" with formInitialValues=undefined', () => {
      const { result } = renderHook(() =>
        useInvoiceUpload({ onClose: jest.fn() }),
      );

      act(() => {
        result.current.handleFallbackToManual();
      });

      expect(result.current.view).toBe('form');
      expect(result.current.formInitialValues).toBeUndefined();
    });
  });

  // AC: handleFormSave
  describe('handleFormSave', () => {
    it('calls onClose on successful save', async () => {
      const onClose = jest.fn();
      mockUseInvoices.mockReturnValue({
        ...DEFAULT_USE_INVOICES,
        createInvoice: jest.fn().mockResolvedValue({ success: true }),
      } as any);

      const { result } = renderHook(() =>
        useInvoiceUpload({ onClose }),
      );

      await act(async () => {
        await result.current.handleFormSave({ vendor: 'Test', total: 100 });
      });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('shows Alert and does not call onClose when save fails', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
      const onClose = jest.fn();
      mockUseInvoices.mockReturnValue({
        ...DEFAULT_USE_INVOICES,
        createInvoice: jest.fn().mockResolvedValue({ success: false, error: 'DB error' }),
      } as any);

      const { result } = renderHook(() =>
        useInvoiceUpload({ onClose }),
      );

      await act(async () => {
        await result.current.handleFormSave({ vendor: 'Test', total: 100 });
      });

      expect(onClose).not.toHaveBeenCalled();
      expect(alertSpy).toHaveBeenCalledWith('Error', 'DB error');
    });
  });

  // AC: handleFormCancel
  describe('handleFormCancel', () => {
    it('transitions view back to "upload"', () => {
      const { result } = renderHook(() =>
        useInvoiceUpload({ onClose: jest.fn() }),
      );

      act(() => { result.current.handleFallbackToManual(); });
      expect(result.current.view).toBe('form');

      act(() => { result.current.handleFormCancel(); });
      expect(result.current.view).toBe('upload');
    });
  });

  // AC: Default adapter instantiation
  describe('default adapter instantiation', () => {
    it('does not throw when no adapter overrides are provided', () => {
      expect(() => {
        renderHook(() =>
          useInvoiceUpload({ onClose: jest.fn() }),
        );
      }).not.toThrow();
    });
  });
});
