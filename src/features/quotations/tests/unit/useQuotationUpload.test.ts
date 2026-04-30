/**
 * Unit tests for useQuotationUpload View-Model hook
 *
 * Acceptance criteria:
 * - Initial state: processingStep='idle', processingError=null
 * - handleUploadPdf() with cancelled picker → processingStep='idle', no state change
 * - handleUploadPdf() when use case throws 'Validation failed:' → processingStep='idle', Alert shown
 * - handleUploadPdf() without ocrAdapter → use case returns empty, formInitialValues=undefined
 * - handleUploadPdf() with full mock adapters → transitions and populates formInitialValues
 * - handleSnapPhoto() calls cameraAdapter.capturePhoto()
 * - handleSnapPhoto() passes mimeType='image/jpeg' to use case
 * - handleSnapPhoto() populates formInitialValues after successful capture
 * - handleSnapPhoto() does nothing when camera returns cancelled=true
 * - handleSnapPhoto() sets processingError when OCR/LLM fails
 * - handleSubmit() on success calls onClose
 * - handleSubmit() on failure shows Alert
 * - Default adapters are created when no overrides are provided
 */

import { renderHook, act } from '@testing-library/react-native';
import { Alert } from 'react-native';

// ── Module mocks ─────────────────────────────────────────────────────────────

jest.mock('../../hooks/useQuotations', () => ({
  useQuotations: jest.fn(),
}));

jest.mock('../../../../infrastructure/files/MobileFilePickerAdapter', () => ({
  MobileFilePickerAdapter: jest.fn().mockImplementation(() => ({
    pickDocument: jest.fn().mockResolvedValue({ cancelled: true }),
  })),
}));

jest.mock('../../../../infrastructure/files/MobileFileSystemAdapter', () => ({
  MobileFileSystemAdapter: jest.fn().mockImplementation(() => ({
    copyToAppStorage: jest.fn().mockResolvedValue('file:///app/storage/quotation.pdf'),
    exists: jest.fn().mockResolvedValue(true),
    deleteFile: jest.fn(),
    getDocumentsDirectory: jest.fn().mockResolvedValue('/app/documents'),
  })),
}));

jest.mock('../../../../infrastructure/camera/MobileCameraAdapter', () => ({
  MobileCameraAdapter: jest.fn().mockImplementation(() => ({
    capturePhoto: jest.fn().mockResolvedValue({ cancelled: true, uri: '', width: 0, height: 0, fileSize: 0 }),
    hasPermissions: jest.fn().mockResolvedValue(true),
    requestPermissions: jest.fn().mockResolvedValue(true),
  })),
}));

jest.mock('../../application/ProcessQuotationUploadUseCase', () => ({
  ProcessQuotationUploadUseCase: jest.fn().mockImplementation(() => ({
    execute: jest.fn().mockResolvedValue({
      normalized: {
        supplier: null,
        total: null,
        confidence: { overall: 0 },
        suggestedCorrections: [],
      },
      documentRef: {
        localPath: 'file:///app/storage/quotation.pdf',
        filename: 'quotation.pdf',
        size: 102400,
        mimeType: 'application/pdf',
      },
      rawOcrText: '',
    }),
  })),
}));

// ── Imports ──────────────────────────────────────────────────────────────────

import { useQuotations } from '../../hooks/useQuotations';
import { useQuotationUpload } from '../../hooks/useQuotationUpload';
import { ProcessQuotationUploadUseCase } from '../../application/ProcessQuotationUploadUseCase';
import type { IFilePickerAdapter, FilePickerResult } from '../../../../infrastructure/files/IFilePickerAdapter';
import type { IFileSystemAdapter } from '../../../../infrastructure/files/IFileSystemAdapter';
import type { ICameraAdapter } from '../../../../infrastructure/camera/ICameraAdapter';

// ── Typed mock helpers ───────────────────────────────────────────────────────

const mockUseQuotations = useQuotations as jest.MockedFunction<typeof useQuotations>;
const MockProcessQuotationUploadUseCase = ProcessQuotationUploadUseCase as jest.MockedClass<
  typeof ProcessQuotationUploadUseCase
>;

const NORMALIZED_QUOTATION = {
  supplier: 'BuildCo Pty Ltd',
  reference: 'QT-2026-001',
  date: new Date('2026-03-01'),
  validUntil: new Date('2026-04-01'),
  subtotal: 5000,
  tax: 500,
  total: 5500,
  currency: 'AUD',
  lineItems: [],
  confidence: { overall: 0.9, supplier: 0.85, reference: 0.8, total: 0.95 },
  suggestedCorrections: [],
};

const DEFAULT_USE_CASE_OUTPUT = {
  normalized: {
    supplier: null,
    total: null,
    confidence: { overall: 0 },
    suggestedCorrections: [],
  },
  documentRef: {
    localPath: 'file:///app/storage/quotation.pdf',
    filename: 'quotation.pdf',
    size: 102400,
    mimeType: 'application/pdf',
  },
  rawOcrText: '',
};

const DEFAULT_USE_QUOTATIONS = {
  quotations: [],
  loading: false,
  error: null,
  createQuotation: jest.fn().mockResolvedValue({ id: 'q-1', reference: 'QT-001' }),
  updateQuotation: jest.fn(),
  deleteQuotation: jest.fn(),
  getQuotationById: jest.fn(),
  refreshQuotations: jest.fn(),
};

function makeFilePicker(override: Partial<FilePickerResult> = {}): IFilePickerAdapter {
  return {
    pickDocument: jest.fn().mockResolvedValue({
      cancelled: false,
      uri: 'file:///tmp/quotation.pdf',
      name: 'quotation.pdf',
      size: 102400,
      type: 'application/pdf',
      ...override,
    }),
  };
}

function makeFileSystem(): IFileSystemAdapter {
  return {
    copyToAppStorage: jest.fn().mockResolvedValue('file:///app/storage/quotation_123.pdf'),
    exists: jest.fn().mockResolvedValue(true),
    deleteFile: jest.fn().mockResolvedValue(undefined),
    getDocumentsDirectory: jest.fn().mockResolvedValue('/app/documents'),
  };
}

function makeCameraAdapter(overrides: Partial<ICameraAdapter> & Record<string, any> = {}): ICameraAdapter {
  return {
    capturePhoto: jest.fn().mockResolvedValue({
      uri: 'file:///mock/quotation_photo.jpg',
      width: 1920,
      height: 1080,
      fileSize: 800000,
      cancelled: false,
    }),
    hasPermissions: jest.fn().mockResolvedValue(true),
    requestPermissions: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useQuotationUpload', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseQuotations.mockReturnValue({ ...DEFAULT_USE_QUOTATIONS } as any);
    MockProcessQuotationUploadUseCase.mockImplementation(() => ({
      execute: jest.fn().mockResolvedValue({ ...DEFAULT_USE_CASE_OUTPUT }),
    }) as any);
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
    it('returns processingStep="idle" without changing state', async () => {
      const picker = makeFilePicker({ cancelled: true });

      const { result } = renderHook(() =>
        useQuotationUpload({ onClose: jest.fn(), filePickerAdapter: picker }),
      );

      await act(async () => {
        await result.current.handleUploadPdf();
      });

      expect(result.current.processingStep).toBe('idle');
      expect(result.current.formInitialValues).toBeUndefined();
    });
  });

  // AC: handleUploadPdf when use case rejects with validation error
  describe('handleUploadPdf — validation error from use case', () => {
    it('sets processingStep="idle" and shows Alert when use case throws Validation failed', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
      const picker = makeFilePicker({ type: 'application/msword', name: 'document.doc' });

      MockProcessQuotationUploadUseCase.mockImplementation(() => ({
        execute: jest.fn().mockRejectedValue(
          new Error('Validation failed: Please select a PDF or image file'),
        ),
      }) as any);

      const { result } = renderHook(() =>
        useQuotationUpload({ onClose: jest.fn(), filePickerAdapter: picker }),
      );

      await act(async () => {
        await result.current.handleUploadPdf();
      });

      expect(result.current.processingStep).toBe('idle');
      expect(alertSpy).toHaveBeenCalledWith('Invalid File', expect.any(String));
    });

    it('shows "Invalid File" alert for file over 20MB', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
      const picker = makeFilePicker({ size: 25 * 1024 * 1024 });

      MockProcessQuotationUploadUseCase.mockImplementation(() => ({
        execute: jest.fn().mockRejectedValue(
          new Error('Validation failed: File must be under 20MB'),
        ),
      }) as any);

      const { result } = renderHook(() =>
        useQuotationUpload({ onClose: jest.fn(), filePickerAdapter: picker }),
      );

      await act(async () => {
        await result.current.handleUploadPdf();
      });

      expect(alertSpy).toHaveBeenCalledWith('Invalid File', expect.stringContaining('20MB'));
    });
  });

  // AC: handleUploadPdf without OCR adapters — use case returns empty result
  describe('handleUploadPdf — no OCR adapters', () => {
    it('sets formInitialValues=undefined when use case returns empty result', async () => {
      const picker = makeFilePicker();
      const fileSystem = makeFileSystem();

      const { result } = renderHook(() =>
        useQuotationUpload({
          onClose: jest.fn(),
          filePickerAdapter: picker,
          fileSystemAdapter: fileSystem,
        }),
      );

      await act(async () => {
        await result.current.handleUploadPdf();
      });

      expect(result.current.processingStep).toBe('idle');
      expect(result.current.formInitialValues).toBeUndefined();
    });
  });

  // AC: handleUploadPdf with full mock adapters
  describe('handleUploadPdf — with full OCR pipeline', () => {
    it('populates formInitialValues after successful pipeline', async () => {
      const picker = makeFilePicker();
      const fileSystem = makeFileSystem();

      MockProcessQuotationUploadUseCase.mockImplementation(() => ({
        execute: jest.fn().mockResolvedValue({
          normalized: NORMALIZED_QUOTATION,
          documentRef: { localPath: '/file', filename: 'quotation.pdf', size: 100, mimeType: 'application/pdf' },
          rawOcrText: 'raw ocr text from quotation',
        }),
      }) as any);

      const { result } = renderHook(() =>
        useQuotationUpload({
          onClose: jest.fn(),
          filePickerAdapter: picker,
          fileSystemAdapter: fileSystem,
        }),
      );

      await act(async () => {
        await result.current.handleUploadPdf();
      });

      expect(result.current.processingStep).toBe('idle');
      expect(result.current.formInitialValues).toBeDefined();
      expect(result.current.formPdfFile).toBeDefined();
    });
  });

  // AC: handleSubmit
  describe('handleSubmit', () => {
    it('calls onClose on successful submit', async () => {
      const onClose = jest.fn();
      mockUseQuotations.mockReturnValue({
        ...DEFAULT_USE_QUOTATIONS,
        createQuotation: jest.fn().mockResolvedValue({ id: 'q-1', reference: 'QT-001' }),
      } as any);

      const { result } = renderHook(() =>
        useQuotationUpload({ onClose }),
      );

      await act(async () => {
        await result.current.handleSubmit({ reference: 'QT-001', total: 5500 } as any);
      });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('shows Alert and does not call onClose when submit fails', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
      const onClose = jest.fn();
      mockUseQuotations.mockReturnValue({
        ...DEFAULT_USE_QUOTATIONS,
        createQuotation: jest.fn().mockRejectedValue(new Error('DB write error')),
      } as any);

      const { result } = renderHook(() =>
        useQuotationUpload({ onClose }),
      );

      await act(async () => {
        await result.current.handleSubmit({ reference: 'QT-001', total: 5500 } as any);
      });

      expect(onClose).not.toHaveBeenCalled();
      expect(alertSpy).toHaveBeenCalledWith('Error', 'DB write error');
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

  // AC: handleSnapPhoto — camera capture support (AD4)
  describe('handleSnapPhoto — camera capture', () => {
    it('calls cameraAdapter.capturePhoto()', async () => {
      const camera = makeCameraAdapter();
      const { result } = renderHook(() =>
        useQuotationUpload({ onClose: jest.fn(), cameraAdapter: camera }),
      );

      await act(async () => {
        await result.current.handleSnapPhoto();
      });

      expect(camera.capturePhoto).toHaveBeenCalled();
    });

    it('calls ProcessQuotationUploadUseCase.execute() with mimeType="image/jpeg" on successful capture', async () => {
      const camera = makeCameraAdapter();
      const mockExecute = jest.fn().mockResolvedValue({
        normalized: NORMALIZED_QUOTATION,
        documentRef: { localPath: 'file:///mock/quotation_photo.jpg', filename: 'quotation_photo.jpg', size: 800000, mimeType: 'image/jpeg' },
        rawOcrText: 'BuildCo Pty Ltd quotation',
      });
      MockProcessQuotationUploadUseCase.mockImplementation(() => ({ execute: mockExecute }) as any);

      const { result } = renderHook(() =>
        useQuotationUpload({ onClose: jest.fn(), cameraAdapter: camera }),
      );

      await act(async () => {
        await result.current.handleSnapPhoto();
      });

      expect(mockExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          fileUri: 'file:///mock/quotation_photo.jpg',
          mimeType: 'image/jpeg',
        }),
      );
    });

    it('populates formInitialValues after successful camera capture', async () => {
      const camera = makeCameraAdapter();
      MockProcessQuotationUploadUseCase.mockImplementation(() => ({
        execute: jest.fn().mockResolvedValue({
          normalized: NORMALIZED_QUOTATION,
          documentRef: { localPath: 'file:///mock/quotation_photo.jpg', filename: 'quotation_photo.jpg', size: 800000, mimeType: 'image/jpeg' },
          rawOcrText: 'BuildCo Pty Ltd quotation',
        }),
      }) as any);

      const { result } = renderHook(() =>
        useQuotationUpload({ onClose: jest.fn(), cameraAdapter: camera }),
      );

      await act(async () => {
        await result.current.handleSnapPhoto();
      });

      expect(result.current.processingStep).toBe('idle');
      expect(result.current.formInitialValues).toBeDefined();
    });

    it('does nothing when camera returns cancelled=true', async () => {
      const camera = makeCameraAdapter({
        capturePhoto: jest.fn().mockResolvedValue({
          uri: '',
          width: 0,
          height: 0,
          fileSize: 0,
          cancelled: true,
        }),
      });

      const { result } = renderHook(() =>
        useQuotationUpload({ onClose: jest.fn(), cameraAdapter: camera }),
      );

      await act(async () => {
        await result.current.handleSnapPhoto();
      });

      expect(result.current.processingStep).toBe('idle');
      expect(result.current.formInitialValues).toBeUndefined();
    });

    it('sets processingError when OCR/LLM fails during camera capture', async () => {
      const camera = makeCameraAdapter();
      MockProcessQuotationUploadUseCase.mockImplementation(() => ({
        execute: jest.fn().mockRejectedValue(new Error('Quotation processing failed: Groq timeout')),
      }) as any);

      const { result } = renderHook(() =>
        useQuotationUpload({ onClose: jest.fn(), cameraAdapter: camera }),
      );

      await act(async () => {
        await result.current.handleSnapPhoto();
      });

      expect(result.current.processingError).toBeTruthy();
    });

    it('is exposed in the returned view model', () => {
      const { result } = renderHook(() =>
        useQuotationUpload({ onClose: jest.fn() }),
      );

      expect(typeof result.current.handleSnapPhoto).toBe('function');
    });
  });
});
