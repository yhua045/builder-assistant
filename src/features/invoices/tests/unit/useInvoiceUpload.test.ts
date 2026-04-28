/**
 * Unit tests for useInvoiceUpload View-Model hook
 * Design: design/issue-210-ocr-screens-refactor.md §8.2
 *
 * Acceptance criteria:
 * - Initial state: view='upload', processingStep='idle', processingError=null, normalizedResult=null
 * - handleUploadPdf() with cancelled picker → processingStep='idle', no state change
 * - handleUploadPdf() when use case throws 'Validation failed:' → processingStep='idle', Alert shown
 * - handleUploadPdf() without ocrAdapter/invoiceNormalizer → use case returns empty, view='form', formInitialValues=undefined
 * - handleUploadPdf() with full mock adapters → transitions 'idle'→'copying'→'ocr'→view='form'
 * - handleRetryExtraction() with cached picker result re-runs pipeline
 * - handleFallbackToManual() → view='form', formInitialValues=undefined
 * - handleFormSave() on success calls onClose
 * - handleFormSave() on failure shows Alert
 * - handleFormCancel() → view='upload'
 * - Default adapters are created when no overrides are provided
 */

import { renderHook, act } from '@testing-library/react-native';
import { Alert } from 'react-native';

// ── Module mocks ─────────────────────────────────────────────────────────────

jest.mock('../../hooks/useInvoices', () => ({
  useInvoices: jest.fn(),
}));

jest.mock('../../../../infrastructure/files/MobileFilePickerAdapter', () => ({
  MobileFilePickerAdapter: jest.fn().mockImplementation(() => ({
    pickDocument: jest.fn().mockResolvedValue({ cancelled: true }),
  })),
}));

jest.mock('../../../../infrastructure/files/MobileFileSystemAdapter', () => ({
  MobileFileSystemAdapter: jest.fn().mockImplementation(() => ({
    copyToAppStorage: jest.fn().mockResolvedValue('file:///app/storage/invoice.pdf'),
    exists: jest.fn().mockResolvedValue(true),
    deleteFile: jest.fn(),
    getDocumentsDirectory: jest.fn().mockResolvedValue('/app/documents'),
  })),
}));

jest.mock('../../application/ProcessInvoiceUploadUseCase', () => ({
  ProcessInvoiceUploadUseCase: jest.fn().mockImplementation(() => ({
    // Default: return an empty (no-OCR) result so the hook navigates to the form
    execute: jest.fn().mockResolvedValue({
      normalized: {
        vendor: null,
        total: null,
        confidence: { overall: 0 },
        suggestedCorrections: [],
      },
      documentRef: {
        localPath: 'file:///app/storage/invoice.pdf',
        filename: 'invoice.pdf',
        size: 102400,
        mimeType: 'application/pdf',
      },
      rawOcrText: '',
    }),
  })),
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import { useInvoices } from '../../hooks/useInvoices';
import { useInvoiceUpload } from '../../hooks/useInvoiceUpload';
import { ProcessInvoiceUploadUseCase } from '../../application/ProcessInvoiceUploadUseCase';
import type { IFilePickerAdapter, FilePickerResult } from '../../../../infrastructure/files/IFilePickerAdapter';
import type { IFileSystemAdapter } from '../../../../infrastructure/files/IFileSystemAdapter';
import type { IOcrAdapter } from '../../../../application/services/IOcrAdapter';
import type { IInvoiceNormalizer } from '../../application/IInvoiceNormalizer';

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

const DEFAULT_USE_CASE_OUTPUT = {
  normalized: {
    vendor: null,
    total: null,
    confidence: { overall: 0 },
    suggestedCorrections: [],
  },
  documentRef: {
    localPath: 'file:///app/storage/invoice.pdf',
    filename: 'invoice.pdf',
    size: 102400,
    mimeType: 'application/pdf',
  },
  rawOcrText: '',
};

describe('useInvoiceUpload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseInvoices.mockReturnValue({ ...DEFAULT_USE_INVOICES } as any);
    // Restore default (empty/fallback) use-case mock so invalid-file tests
    // don't pollute subsequent tests.
    MockProcessInvoiceUploadUseCase.mockImplementation(() => ({
      execute: jest.fn().mockResolvedValue({ ...DEFAULT_USE_CASE_OUTPUT }),
      processPdf: jest.fn(),
      emptyNormalizedInvoice: jest.fn(),
    } as any));
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

  // AC: handleUploadPdf when use case rejects with validation error
  describe('handleUploadPdf — validation error from use case', () => {
    it('sets processingStep="idle" and shows Alert when use case throws Validation failed', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
      const picker = makeFilePicker({ type: 'application/msword', name: 'document.doc' });

      MockProcessInvoiceUploadUseCase.mockImplementation(() => ({
        execute: jest.fn().mockRejectedValue(
          new Error('Validation failed: Please select a PDF or image file'),
        ),
      }) as any);

      const { result } = renderHook(() =>
        useInvoiceUpload({ onClose: jest.fn(), filePickerAdapter: picker }),
      );

      await act(async () => {
        await result.current.handleUploadPdf();
      });

      expect(result.current.processingStep).toBe('idle');
      expect(alertSpy).toHaveBeenCalledWith('Invalid File', expect.any(String));
    });

    it('shows "Invalid File" alert for file over 20MB', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
      const picker = makeFilePicker({ size: 25 * 1024 * 1024 }); // 25MB

      MockProcessInvoiceUploadUseCase.mockImplementation(() => ({
        execute: jest.fn().mockRejectedValue(
          new Error('Validation failed: File must be under 20MB'),
        ),
      }) as any);

      const { result } = renderHook(() =>
        useInvoiceUpload({ onClose: jest.fn(), filePickerAdapter: picker }),
      );

      await act(async () => {
        await result.current.handleUploadPdf();
      });

      expect(alertSpy).toHaveBeenCalledWith('Invalid File', expect.stringContaining('20MB'));
    });
  });

  // AC: handleUploadPdf without OCR adapters — use case returns empty result
  describe('handleUploadPdf — no OCR adapters', () => {
    it('transitions to view="form" with formInitialValues=undefined when use case returns empty result', async () => {
      const picker = makeFilePicker();
      const fileSystem = makeFileSystem();

      // Default mock returns empty result (no rawOcrText, confidence.overall === 0)
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
