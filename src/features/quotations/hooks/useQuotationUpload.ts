/**
 * useQuotationUpload — View-Model Facade for QuotationScreen
 *
 * Design: design/issue-210-ocr-screens-refactor.md §4.3
 *
 * Encapsulates all state, adapter wiring, Use Case orchestration, and domain
 * entity validation for the quotation upload flow. QuotationScreen becomes a
 * pure presentation component.
 */

import { useState, useMemo } from 'react';
import { Alert } from 'react-native';
import { useQuotations } from './useQuotations';
import { IOcrAdapter } from '../../../application/services/IOcrAdapter';
import { IQuotationParsingStrategy } from '../application/ai/IQuotationParsingStrategy';
import { IPdfConverter } from '../../../infrastructure/files/IPdfConverter';
import { IFilePickerAdapter } from '../../../infrastructure/files/IFilePickerAdapter';
import { IFileSystemAdapter } from '../../../infrastructure/files/IFileSystemAdapter';
import { MobileFilePickerAdapter } from '../../../infrastructure/files/MobileFilePickerAdapter';
import { MobileFileSystemAdapter } from '../../../infrastructure/files/MobileFileSystemAdapter';
import { ICameraAdapter } from '../../../infrastructure/camera/ICameraAdapter';
import { MobileCameraAdapter } from '../../../infrastructure/camera/MobileCameraAdapter';
import { PdfFileMetadata } from '../../../types/PdfFileMetadata';
import { ProcessQuotationUploadUseCase } from '../application/ProcessQuotationUploadUseCase';
import { normalizedQuotationToFormValues } from './normalizedQuotationToFormValues';
import { Quotation } from '../../../domain/entities/Quotation';
import { FeatureFlags } from '../../../infrastructure/config/featureFlags';
import { LlmVisionQuotationParser } from '../infrastructure/ai/LlmVisionQuotationParser';
import { ReactNativeImageReader } from '../../../infrastructure/files/ReactNativeImageReader';
import { GROQ_API_KEY } from '@env';

export type QuotationProcessingStep = 'idle' | 'copying' | 'ocr' | 'error';

export interface QuotationUploadOptions {
  onClose: () => void;
  onSuccess?: (quotation: Quotation) => void;
  /** OCR adapter overrides (injected by Dashboard / tests) */
  ocrAdapter?: IOcrAdapter;
  pdfConverter?: IPdfConverter;
  parsingStrategy?: IQuotationParsingStrategy;
  /** Camera adapter — for camera capture support */
  cameraAdapter?: ICameraAdapter;
  /** File adapter overrides — for unit testing only */
  filePickerAdapter?: IFilePickerAdapter;
  fileSystemAdapter?: IFileSystemAdapter;
}

export interface QuotationUploadViewModel {
  // Processing state
  processingStep: QuotationProcessingStep;
  processingError: string | null;
  isProcessing: boolean;
  // Data
  formInitialValues: Partial<Quotation> | undefined;
  formPdfFile: PdfFileMetadata | undefined;
  // Flags from useQuotations
  loading: boolean;
  // Handlers
  handleSnapPhoto: () => Promise<void>;
  handleUploadPdf: () => Promise<void>;
  handleSubmit: (data: Omit<Quotation, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
}

export function useQuotationUpload(options: QuotationUploadOptions): QuotationUploadViewModel {
  const {
    onClose,
    onSuccess,
    ocrAdapter,
    pdfConverter,
    parsingStrategy,
    cameraAdapter,
    filePickerAdapter,
    fileSystemAdapter,
  } = options;

  const { createQuotation, loading } = useQuotations();

  const [processingStep, setProcessingStep] = useState<QuotationProcessingStep>('idle');
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [formInitialValues, setFormInitialValues] = useState<Partial<Quotation> | undefined>(
    undefined,
  );
  const [formPdfFile, setFormPdfFile] = useState<PdfFileMetadata | undefined>(undefined);

  const filePicker = useMemo(
    () => filePickerAdapter ?? new MobileFilePickerAdapter(),
    [filePickerAdapter],
  );
  const fileSystem = useMemo(
    () => fileSystemAdapter ?? new MobileFileSystemAdapter(),
    [fileSystemAdapter],
  );
  const camera = useMemo(
    () => cameraAdapter ?? new MobileCameraAdapter(),
    [cameraAdapter],
  );

  const buildUseCase = (): ProcessQuotationUploadUseCase => {
    if (FeatureFlags.useVisionOcr && GROQ_API_KEY) {
      return new ProcessQuotationUploadUseCase(
        undefined,
        pdfConverter,
        fileSystem,
        undefined,
        new LlmVisionQuotationParser(GROQ_API_KEY, new ReactNativeImageReader()),
      );
    }
    return new ProcessQuotationUploadUseCase(
      parsingStrategy,
      pdfConverter,
      fileSystem,
      ocrAdapter
    );
  };

  const runProcessingPipeline = async (
    originalUri: string,
    filename: string,
    mimeType: string,
    size: number
  ) => {
    const useCase = buildUseCase();

    setProcessingStep('ocr');
    try {
      const output = await useCase.execute({
        fileUri: originalUri,
        filename,
        mimeType,
        fileSize: size,
      });

      // Distinguish between successful OCR vs fallback (empty values because OCR is off or missing)
      const isFallback = !output.rawOcrText && output.normalized.confidence.overall === 0;
      
      if (isFallback) {
         setFormInitialValues(undefined);
      } else {
         setFormInitialValues(normalizedQuotationToFormValues(output.normalized));
      }

      // Capture the file metadata generated inside the Use Case
      setFormPdfFile({
        uri: output.documentRef.localPath,
        originalUri,
        name: filename,
        size: size,
        mimeType: mimeType,
      });
      setProcessingStep('idle');
      setProcessingError(null);
    } catch (err: any) {
      const msg = err?.message || 'OCR processing failed';
      
      if (msg.includes('Validation failed:')) {
        Alert.alert('Invalid File', msg.replace('Validation failed: ', ''));
        setProcessingStep('idle');
        return;
      }

      setProcessingError(msg);
      setProcessingStep('error');
      // Set the minimal info so the UI can fall back to manual entry
      setFormPdfFile({
        uri: originalUri,
        originalUri,
        name: filename,
        size,
        mimeType,
      });
    }
  };

  const handleSnapPhoto = async () => {
    try {
      const captured = await camera.capturePhoto({ quality: 0.85 });
      if (captured.cancelled) return;

      await runProcessingPipeline(
        captured.uri,
        'quotation_photo.jpg',
        'image/jpeg',
        captured.fileSize,
      );
    } catch (err: any) {
      const errorMessage = err?.message || 'Camera error occurred';
      setProcessingError(errorMessage);
      setProcessingStep('error');
    }
  };

  const handleUploadPdf = async () => {
    try {
      setProcessingStep('copying');
      setProcessingError(null);

      const result = await filePicker.pickDocument();
      if (result.cancelled) {
        setProcessingStep('idle');
        return;
      }

      await runProcessingPipeline(
        result.uri!,
        result.name!,
        result.type || 'application/pdf',
        result.size!
      );
    } catch (err: any) {
      setProcessingError(err?.message || 'Failed to process quote');
      setProcessingStep('error');
    }
  };

  const handleSubmit = async (data: Omit<Quotation, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      // createQuotation delegates to CreateQuotationUseCase which handles QuotationEntity instantiation
      const created = await createQuotation(data);
      onSuccess?.(created);
      onClose();
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to create quotation',
      );
    }
  };

  const isProcessing = processingStep === 'copying' || processingStep === 'ocr';

  return {
    processingStep,
    processingError,
    isProcessing,
    formInitialValues,
    formPdfFile,
    loading,
    handleSnapPhoto,
    handleUploadPdf,
    handleSubmit,
  };
}
