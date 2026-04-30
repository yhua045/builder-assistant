/**
 * useSnapReceiptScreen — View-Model Facade for SnapReceiptScreen
 *
 * Design: design/issue-210-ocr-screens-refactor.md §4.1
 *
 * Encapsulates all state, adapter instantiation, and orchestration logic for
 * the snap-receipt flow. The React component becomes a "dumb" presentation
 * layer that only reads from `SnapReceiptScreenViewModel`.
 */

import { useState, useEffect, useMemo } from 'react';
import { Alert } from 'react-native';
import { useSnapReceipt } from './useSnapReceipt';
import { NormalizedReceipt } from '../application/IReceiptNormalizer';
import { SnapReceiptDTO } from '../application/SnapReceiptUseCase';
import { normalizedReceiptToFormValues } from '../utils/normalizedReceiptToFormValues';
import { ICameraAdapter } from '../../../infrastructure/camera/ICameraAdapter';
import { MobileCameraAdapter } from '../../../infrastructure/camera/MobileCameraAdapter';
import { IFilePickerAdapter } from '../../../infrastructure/files/IFilePickerAdapter';
import { MobileFilePickerAdapter } from '../../../infrastructure/files/MobileFilePickerAdapter';
import { IReceiptParsingStrategy } from '../application/IReceiptParsingStrategy';

export type SnapReceiptScreenView = 'selecting' | 'capturing' | 'processing' | 'form';

export interface SnapReceiptScreenOptions {
  enableOcr?: boolean;
  imageUri?: string;
  receiptParsingStrategy?: IReceiptParsingStrategy;
  onClose: () => void;
  /** Adapter overrides — for unit testing only */
  cameraAdapter?: ICameraAdapter;
  filePickerAdapter?: IFilePickerAdapter;
}

export interface SnapReceiptScreenViewModel {
  // View state machine
  view: SnapReceiptScreenView;
  isCapturing: boolean;
  // OCR / save flags delegated from useSnapReceipt
  loading: boolean;
  processing: boolean;
  error: string | null;
  // Populated after successful OCR
  normalizedData: NormalizedReceipt | null;
  formInitialValues: Partial<SnapReceiptDTO> | undefined;
  // Handlers
  handleSnapPhoto: () => Promise<void>;
  handleUploadPdf: () => Promise<void>;
  handleManualEntry: () => void;
  handleSave: (data: SnapReceiptDTO) => Promise<void>;
}

export function useSnapReceiptScreen(
  options: SnapReceiptScreenOptions,
): SnapReceiptScreenViewModel {
  const {
    enableOcr = false,
    imageUri,
    receiptParsingStrategy,
    onClose,
    cameraAdapter,
    filePickerAdapter,
  } = options;

  const { saveReceipt, processReceipt, processPdfReceipt, loading, processing, error } =
    useSnapReceipt(enableOcr, receiptParsingStrategy);

  const [view, setView] = useState<SnapReceiptScreenView>(
    imageUri ? 'capturing' : 'selecting',
  );
  const [normalizedData, setNormalizedData] = useState<NormalizedReceipt | null>(null);
  const [formInitialValues, setFormInitialValues] = useState<
    Partial<SnapReceiptDTO> | undefined
  >(undefined);
  const [isCapturing, setIsCapturing] = useState(false);

  const camera = useMemo(
    () => cameraAdapter ?? new MobileCameraAdapter(),
    [cameraAdapter],
  );
  const filePicker = useMemo(
    () => filePickerAdapter ?? new MobileFilePickerAdapter(),
    [filePickerAdapter],
  );

  // Process pre-supplied imageUri on mount (existing integration path)
  useEffect(() => {
    if (imageUri && enableOcr && view === 'capturing') {
      (async () => {
        setView('processing');
        const result = await processReceipt(imageUri);
        if (result) {
          setNormalizedData(result);
          setFormInitialValues(normalizedReceiptToFormValues(result));
        } else {
          Alert.alert(
            'OCR Error',
            error || 'Could not extract receipt data. Please enter manually.',
          );
        }
        setView('form');
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSnapPhoto = async () => {
    try {
      setIsCapturing(true);
      const result = await camera.capturePhoto();
      if (result.cancelled) {
        setIsCapturing(false);
        return;
      }
      setView('processing');

      let normalizedResult: NormalizedReceipt | null = null;

      if (receiptParsingStrategy) {
        // AD3: Route through ProcessReceiptUploadUseCase → LLM path
        normalizedResult = await processPdfReceipt({
          fileUri: result.uri,
          filename: 'receipt.jpg',
          mimeType: 'image/jpeg',
          fileSize: result.fileSize,
        });
      } else {
        // Existing deterministic path
        normalizedResult = await processReceipt(result.uri);
      }

      if (normalizedResult) {
        setNormalizedData(normalizedResult);
        setFormInitialValues(normalizedReceiptToFormValues(normalizedResult));
      } else {
        Alert.alert(
          'OCR Error',
          error || 'Could not extract receipt data. Please enter manually.',
        );
      }
      setView('form');
    } catch (err: any) {
      const msg = err?.message || 'Camera error occurred';
      if (msg.toLowerCase().includes('permission')) {
        Alert.alert(
          'Camera Permission',
          'Enable camera access in your device settings to snap receipts.',
        );
      } else if (msg.toLowerCase().includes('not available')) {
        Alert.alert(
          'Camera Unavailable',
          'Camera is not available on this device. Please enter details manually.',
        );
      } else {
        Alert.alert('Camera Error', msg);
      }
      setView('selecting');
    } finally {
      setIsCapturing(false);
    }
  };

  const handleUploadPdf = async () => {
    try {
      const picked = await filePicker.pickDocument();
      if (picked.cancelled || !picked.uri) return;

      setView('processing');
      const normalizedResult = await processPdfReceipt({
        fileUri: picked.uri,
        filename: picked.name ?? 'receipt.pdf',
        mimeType: picked.type ?? 'application/pdf',
        fileSize: picked.size ?? 0,
      });

      if (normalizedResult) {
        setNormalizedData(normalizedResult);
        setFormInitialValues(normalizedReceiptToFormValues(normalizedResult));
      } else {
        Alert.alert(
          'Processing Error',
          error || 'Could not extract receipt data. Please enter manually.',
        );
      }
      setView('form');
    } catch (err: any) {
      Alert.alert('Upload Error', err?.message || 'Failed to process PDF.');
      setView('selecting');
    }
  };

  const handleManualEntry = () => {
    setView('form');
  };

  const handleSave = async (data: SnapReceiptDTO) => {
    const result = await saveReceipt(data);
    if (result.success) {
      Alert.alert('Success', 'Receipt saved successfully');
      onClose();
    } else {
      Alert.alert('Error', result.error || 'Failed to save');
    }
  };

  return {
    view,
    isCapturing,
    loading,
    processing,
    error,
    normalizedData,
    formInitialValues,
    handleSnapPhoto,
    handleUploadPdf,
    handleManualEntry,
    handleSave,
  };
}
