/**
 * Unit tests for useSnapReceiptScreen View-Model hook
 * Design: design/issue-210-ocr-screens-refactor.md §8.1
 *
 * Acceptance criteria:
 * - Initial state: view='selecting', isCapturing=false, loading=false, normalizedData=null
 * - When imageUri is provided, initial view is 'capturing'
 * - handleManualEntry() → view='form' without triggering OCR
 * - handleSnapPhoto() with cancelled camera → view stays 'selecting'
 * - handleSnapPhoto() with success → view='form', normalizedData populated
 * - handleSnapPhoto() with camera error → view='selecting' after error
 * - handleUploadPdf() with cancelled picker → view unchanged
 * - handleUploadPdf() with successful PDF → view='form'
 * - handleSave() on success calls onClose
 * - Default MobileCameraAdapter and MobileFilePickerAdapter instantiate without throwing
 */

import { renderHook, act } from '@testing-library/react-native';
import { Alert } from 'react-native';

// ── Module mocks (must be hoisted before imports) ────────────────────────────

jest.mock('../../../src/hooks/useSnapReceipt', () => ({
  useSnapReceipt: jest.fn(),
}));

jest.mock('../../../src/infrastructure/camera/MobileCameraAdapter', () => ({
  MobileCameraAdapter: jest.fn().mockImplementation(() => ({
    capturePhoto: jest.fn().mockResolvedValue({ cancelled: true, uri: '', width: 0, height: 0, fileSize: 0 }),
  })),
}));

jest.mock('../../../src/infrastructure/files/MobileFilePickerAdapter', () => ({
  MobileFilePickerAdapter: jest.fn().mockImplementation(() => ({
    pickDocument: jest.fn().mockResolvedValue({ cancelled: true }),
  })),
}));

jest.mock('../../../src/utils/normalizedReceiptToFormValues', () => ({
  normalizedReceiptToFormValues: jest.fn((data: any) => ({
    vendor: data.vendor,
    amount: data.total,
  })),
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { useSnapReceipt } from '../../../src/hooks/useSnapReceipt';
import { useSnapReceiptScreen } from '../../../src/hooks/useSnapReceiptScreen';
import type { ICameraAdapter } from '../../../src/infrastructure/camera/ICameraAdapter';
import type { IFilePickerAdapter } from '../../../src/infrastructure/files/IFilePickerAdapter';

// ── Typed mock helpers ───────────────────────────────────────────────────────

const mockUseSnapReceipt = useSnapReceipt as jest.MockedFunction<typeof useSnapReceipt>;

const DEFAULT_SNAP_RECEIPT = {
  saveReceipt: jest.fn().mockResolvedValue({ success: true }),
  processReceipt: jest.fn().mockResolvedValue(null),
  processPdfReceipt: jest.fn().mockResolvedValue(null),
  saveNormalizedReceipt: jest.fn(),
  loading: false,
  processing: false,
  error: null,
};

const NORMALIZED_RECEIPT = {
  vendor: 'Home Depot',
  total: 127.50,
  date: new Date('2026-02-15'),
  paymentMethod: 'card' as const,
  currency: 'AUD',
  notes: null,
  lineItems: [],
  confidence: { vendor: 0.9, total: 0.95, date: 0.85 },
  suggestedCorrections: [],
};

function makeCameraAdapter(overrides: Partial<ICameraAdapter> = {}): ICameraAdapter {
  return {
    capturePhoto: jest.fn().mockResolvedValue({
      uri: 'file:///mock/photo.jpg',
      width: 1920,
      height: 1080,
      fileSize: 500000,
      cancelled: false,
    }),
    hasPermissions: jest.fn().mockResolvedValue(true),
    requestPermissions: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function makeFilePickerAdapter(cancelled = false): IFilePickerAdapter {
  return {
    pickDocument: jest.fn().mockResolvedValue(
      cancelled
        ? { cancelled: true }
        : {
            cancelled: false,
            uri: 'file:///tmp/receipt.pdf',
            name: 'receipt.pdf',
            size: 102400,
            type: 'application/pdf',
          },
    ),
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useSnapReceiptScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSnapReceipt.mockReturnValue({ ...DEFAULT_SNAP_RECEIPT });
  });

  // AC: Initial state
  describe('initial state', () => {
    it('returns view="selecting" when no imageUri is provided', () => {
      const { result } = renderHook(() =>
        useSnapReceiptScreen({ onClose: jest.fn() }),
      );
      expect(result.current.view).toBe('selecting');
    });

    it('returns isCapturing=false, loading=false, normalizedData=null initially', () => {
      const { result } = renderHook(() =>
        useSnapReceiptScreen({ onClose: jest.fn() }),
      );
      expect(result.current.isCapturing).toBe(false);
      expect(result.current.loading).toBe(false);
      expect(result.current.normalizedData).toBeNull();
    });

    it('returns view="capturing" when imageUri is provided', () => {
      const { result } = renderHook(() =>
        useSnapReceiptScreen({ onClose: jest.fn(), imageUri: 'file:///pre/capture.jpg' }),
      );
      expect(result.current.view).toBe('capturing');
    });
  });

  // AC: handleManualEntry
  describe('handleManualEntry', () => {
    it('transitions view to "form" without calling processReceipt', () => {
      const { result } = renderHook(() =>
        useSnapReceiptScreen({ onClose: jest.fn() }),
      );

      act(() => {
        result.current.handleManualEntry();
      });

      expect(result.current.view).toBe('form');
      expect(DEFAULT_SNAP_RECEIPT.processReceipt).not.toHaveBeenCalled();
    });
  });

  // AC: handleSnapPhoto with cancelled camera
  describe('handleSnapPhoto — cancelled', () => {
    it('does not change view when camera returns cancelled=true', async () => {
      const camera = makeCameraAdapter({
        capturePhoto: jest.fn().mockResolvedValue({
          cancelled: true,
          uri: '',
          width: 0,
          height: 0,
          fileSize: 0,
        }),
      });
      const { result } = renderHook(() =>
        useSnapReceiptScreen({ onClose: jest.fn(), cameraAdapter: camera }),
      );

      await act(async () => {
        await result.current.handleSnapPhoto();
      });

      expect(result.current.view).toBe('selecting');
      expect(DEFAULT_SNAP_RECEIPT.processReceipt).not.toHaveBeenCalled();
    });
  });

  // AC: handleSnapPhoto with success
  describe('handleSnapPhoto — success', () => {
    it('transitions to form and populates normalizedData after successful OCR', async () => {
      const mockProcessReceipt = jest.fn().mockResolvedValue(NORMALIZED_RECEIPT);
      mockUseSnapReceipt.mockReturnValue({
        ...DEFAULT_SNAP_RECEIPT,
        processReceipt: mockProcessReceipt,
      });

      const camera = makeCameraAdapter();

      const { result } = renderHook(() =>
        useSnapReceiptScreen({
          onClose: jest.fn(),
          enableOcr: true,
          cameraAdapter: camera,
        }),
      );

      await act(async () => {
        await result.current.handleSnapPhoto();
      });

      expect(result.current.view).toBe('form');
      expect(result.current.normalizedData).toEqual(NORMALIZED_RECEIPT);
      expect(mockProcessReceipt).toHaveBeenCalledWith('file:///mock/photo.jpg');
    });
  });

  // AC: handleSnapPhoto with camera error
  describe('handleSnapPhoto — camera error', () => {
    it('returns view to "selecting" after generic camera error', async () => {
      const camera = makeCameraAdapter({
        capturePhoto: jest.fn().mockRejectedValue(new Error('Camera error occurred')),
      });

      const { result } = renderHook(() =>
        useSnapReceiptScreen({ onClose: jest.fn(), cameraAdapter: camera }),
      );

      await act(async () => {
        await result.current.handleSnapPhoto();
      });

      expect(result.current.view).toBe('selecting');
    });

    it('shows Camera Permission alert on permission error', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
      const camera = makeCameraAdapter({
        capturePhoto: jest.fn().mockRejectedValue(new Error('Camera permission denied')),
      });

      const { result } = renderHook(() =>
        useSnapReceiptScreen({ onClose: jest.fn(), cameraAdapter: camera }),
      );

      await act(async () => {
        await result.current.handleSnapPhoto();
      });

      expect(alertSpy).toHaveBeenCalledWith(
        'Camera Permission',
        expect.any(String),
      );
    });

    it('shows Camera Unavailable alert on not-available error', async () => {
      const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());
      const camera = makeCameraAdapter({
        capturePhoto: jest.fn().mockRejectedValue(new Error('Camera not available on this device')),
      });

      const { result } = renderHook(() =>
        useSnapReceiptScreen({ onClose: jest.fn(), cameraAdapter: camera }),
      );

      await act(async () => {
        await result.current.handleSnapPhoto();
      });

      expect(alertSpy).toHaveBeenCalledWith(
        'Camera Unavailable',
        expect.any(String),
      );
    });
  });

  // AC: handleUploadPdf with cancelled picker
  describe('handleUploadPdf — cancelled', () => {
    it('does not change view when picker returns cancelled=true', async () => {
      const picker = makeFilePickerAdapter(true);

      const { result } = renderHook(() =>
        useSnapReceiptScreen({ onClose: jest.fn(), filePickerAdapter: picker }),
      );

      await act(async () => {
        await result.current.handleUploadPdf();
      });

      expect(result.current.view).toBe('selecting');
    });
  });

  // AC: handleUploadPdf with successful PDF
  describe('handleUploadPdf — success', () => {
    it('transitions to form after successful PDF upload', async () => {
      const mockProcessPdf = jest.fn().mockResolvedValue(NORMALIZED_RECEIPT);
      mockUseSnapReceipt.mockReturnValue({
        ...DEFAULT_SNAP_RECEIPT,
        processPdfReceipt: mockProcessPdf,
      });

      const picker = makeFilePickerAdapter(false);

      const { result } = renderHook(() =>
        useSnapReceiptScreen({ onClose: jest.fn(), filePickerAdapter: picker }),
      );

      await act(async () => {
        await result.current.handleUploadPdf();
      });

      expect(result.current.view).toBe('form');
    });
  });

  // AC: handleSave on success calls onClose
  describe('handleSave', () => {
    it('calls onClose when save succeeds', async () => {
      const onClose = jest.fn();
      mockUseSnapReceipt.mockReturnValue({
        ...DEFAULT_SNAP_RECEIPT,
        saveReceipt: jest.fn().mockResolvedValue({ success: true }),
      });

      const { result } = renderHook(() =>
        useSnapReceiptScreen({ onClose }),
      );

      await act(async () => {
        await result.current.handleSave({
          vendor: 'Test',
          amount: 100,
          date: new Date().toISOString(),
          paymentMethod: 'card',
          currency: 'AUD',
        });
      });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose when save fails', async () => {
      const onClose = jest.fn();
      mockUseSnapReceipt.mockReturnValue({
        ...DEFAULT_SNAP_RECEIPT,
        saveReceipt: jest.fn().mockResolvedValue({ success: false, error: 'DB error' }),
      });

      const { result } = renderHook(() =>
        useSnapReceiptScreen({ onClose }),
      );

      await act(async () => {
        await result.current.handleSave({
          vendor: 'Test',
          amount: 100,
          date: new Date().toISOString(),
          paymentMethod: 'card',
          currency: 'AUD',
        });
      });

      expect(onClose).not.toHaveBeenCalled();
    });
  });

  // AC: Default adapters instantiate without throwing
  describe('default adapter instantiation', () => {
    it('does not throw when no adapter overrides are provided', () => {
      expect(() => {
        renderHook(() =>
          useSnapReceiptScreen({ onClose: jest.fn() }),
        );
      }).not.toThrow();
    });
  });
});
