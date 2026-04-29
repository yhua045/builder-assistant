/**
 * useInvoiceUpload — View-Model Facade for InvoiceScreen
 *
 * Design: design/issue-210-ocr-screens-refactor.md §4.2
 *
 * Encapsulates all state (multi-step pipeline), adapter wiring, and Use Case
 * orchestration for the invoice upload flow. InvoiceScreen becomes a pure
 * presentation component.
 *
 * File validation and file IO (copy to app storage) are delegated entirely to
 * ProcessInvoiceUploadUseCase — no application-level logic remains here.
 */

import { useState, useMemo } from 'react';
import { Alert } from 'react-native';
import { useInvoices } from './useInvoices';
import { IOcrAdapter } from '../../../application/services/IOcrAdapter';
import { IInvoiceNormalizer, NormalizedInvoice } from '../application/IInvoiceNormalizer';
import { IPdfConverter } from '../../../infrastructure/files/IPdfConverter';
import { IFilePickerAdapter } from '../../../infrastructure/files/IFilePickerAdapter';
import { IFileSystemAdapter } from '../../../infrastructure/files/IFileSystemAdapter';
import { MobileFilePickerAdapter } from '../../../infrastructure/files/MobileFilePickerAdapter';
import { MobileFileSystemAdapter } from '../../../infrastructure/files/MobileFileSystemAdapter';
import { ICameraAdapter } from '../../../infrastructure/camera/ICameraAdapter';
import { MobileCameraAdapter } from '../../../infrastructure/camera/MobileCameraAdapter';
import { PdfFileMetadata } from '../../../types/PdfFileMetadata';
import { ProcessInvoiceUploadUseCase } from '../application/ProcessInvoiceUploadUseCase';
import { IInvoiceParsingStrategy } from '../application/IInvoiceParsingStrategy';
import { IInvoiceDocumentProcessor } from '../application/IInvoiceDocumentProcessor';
import { TextBasedInvoiceProcessor } from '../infrastructure/processors/TextBasedInvoiceProcessor';
import { VisionBasedInvoiceProcessor } from '../infrastructure/processors/VisionBasedInvoiceProcessor';
import { normalizedInvoiceToFormValues } from '../utils/normalizedInvoiceToFormValues';
import { Invoice } from '../../../domain/entities/Invoice';
import { FeatureFlags } from '../../../infrastructure/config/featureFlags';
import { LlmVisionInvoiceParser } from '../infrastructure/LlmVisionInvoiceParser';
import { ReactNativeImageReader } from '../../../infrastructure/files/ReactNativeImageReader';
import { GROQ_API_KEY } from '@env';

export type InvoiceUploadView = 'upload' | 'form' | 'review' | 'error';
export type InvoiceProcessingStep =
  | 'idle'
  | 'copying'
  | 'ocr'
  | 'normalizing'
  | 'review'
  | 'error';

export interface InvoiceUploadOptions {
  onClose: () => void;
  /** OCR adapter overrides (injected by Dashboard / tests) */
  ocrAdapter?: IOcrAdapter;
  invoiceNormalizer?: IInvoiceNormalizer;
  pdfConverter?: IPdfConverter;
  /** LLM parsing strategy — when provided, image OCR is routed through LLM */
  parsingStrategy?: IInvoiceParsingStrategy;
  /** Camera adapter — for camera capture support */
  cameraAdapter?: ICameraAdapter;
  /** File adapter overrides — for unit testing only */
  filePickerAdapter?: IFilePickerAdapter;
  fileSystemAdapter?: IFileSystemAdapter;
}

export interface InvoiceUploadViewModel {
  // View routing
  view: InvoiceUploadView;
  // Processing state
  processingStep: InvoiceProcessingStep;
  processingError: string | null;
  isProcessing: boolean;
  // Data
  normalizedResult: NormalizedInvoice | null;
  formInitialValues: Partial<Invoice> | undefined;
  formPdfFile: PdfFileMetadata | undefined;
  // Flags from useInvoices
  invoicesLoading: boolean;
  // Handlers
  handleSnapPhoto: () => Promise<void>;
  handleUploadPdf: () => Promise<void>;
  handleAcceptExtraction: (result: NormalizedInvoice) => void;
  handleRetryExtraction: () => Promise<void>;
  handleFallbackToManual: () => void;
  handleFormSave: (data: any) => Promise<void>;
  handleFormCancel: () => void;
}

export function useInvoiceUpload(options: InvoiceUploadOptions): InvoiceUploadViewModel {
  const {
    onClose,
    ocrAdapter,
    invoiceNormalizer,
    pdfConverter,
    parsingStrategy,
    cameraAdapter,
    filePickerAdapter,
    fileSystemAdapter,
  } = options;

  const [processingStep, setProcessingStep] = useState<InvoiceProcessingStep>('idle');
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [normalizedResult, setNormalizedResult] = useState<NormalizedInvoice | null>(null);
  // Stores the raw picker result so handleRetryExtraction can re-run the full pipeline
  const [cachedPickerResult, setCachedPickerResult] = useState<{
    uri: string;
    name: string;
    size: number;
    mimeType: string;
  } | null>(null);
  const [view, setView] = useState<InvoiceUploadView>('upload');
  const [formInitialValues, setFormInitialValues] = useState<Partial<Invoice> | undefined>(
    undefined,
  );
  const [formPdfFile, setFormPdfFile] = useState<PdfFileMetadata | undefined>(undefined);

  const { createInvoice, loading: invoicesLoading } = useInvoices();

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

  /**
   * Builds the document processor based on FeatureFlags.useVisionOcr.
   * The processor encapsulates all mimeType branching and OCR/vision strategy selection.
   */
  const buildProcessor = (): IInvoiceDocumentProcessor => {
    if (FeatureFlags.useVisionOcr && GROQ_API_KEY && pdfConverter) {
      return new VisionBasedInvoiceProcessor(
        new LlmVisionInvoiceParser(GROQ_API_KEY, new ReactNativeImageReader()),
        pdfConverter,
      );
    }
    return new TextBasedInvoiceProcessor(
      ocrAdapter!,
      pdfConverter!,
      parsingStrategy!,
      invoiceNormalizer,
    );
  };

  /**
   * Builds the ProcessInvoiceUploadUseCase with the appropriate processor.
   * Validation and file IO are always delegated to the use case.
   */
  const buildUseCase = (): ProcessInvoiceUploadUseCase =>
    new ProcessInvoiceUploadUseCase(fileSystem, buildProcessor());

  /**
   * Runs the full pipeline: validation → file copy → OCR → normalisation.
   * All application logic executes inside ProcessInvoiceUploadUseCase.
   */
  const runProcessingPipeline = async (
    originalUri: string,
    filename: string,
    mimeType: string,
    size: number,
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

      // Detect graceful-degradation (no OCR result) vs real extraction
      const isFallback = !output.rawOcrText && output.normalized.confidence.overall === 0;

      setNormalizedResult(output.normalized);
      setFormInitialValues(isFallback ? undefined : normalizedInvoiceToFormValues(output.normalized));
      setFormPdfFile({
        uri: output.documentRef.localPath,
        originalUri,
        name: filename,
        size,
        mimeType,
      });
      setProcessingStep('idle');
      setView('form');
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to process invoice';

      // Validation errors (bad file type / file too large) are non-critical —
      // surface them as an alert and return to idle rather than the error screen.
      if (errorMessage.includes('Validation failed:')) {
        Alert.alert('Invalid File', errorMessage.replace('Validation failed: ', ''));
        setProcessingStep('idle');
        return;
      }

      setProcessingError(errorMessage);
      setProcessingStep('error');
      // Provide minimal formPdfFile so the error screen can show the filename
      setFormPdfFile({ uri: originalUri, originalUri, name: filename, size, mimeType });
    }
  };

  const handleSnapPhoto = async () => {
    try {
      const captured = await camera.capturePhoto({ quality: 0.85 });
      if (captured.cancelled) return;

      await runProcessingPipeline(
        captured.uri,
        'invoice_photo.jpg',
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

      const pickerResult = {
        uri: result.uri!,
        name: result.name!,
        size: result.size!,
        mimeType: result.type || 'application/pdf',
      };
      setCachedPickerResult(pickerResult);

      await runProcessingPipeline(
        pickerResult.uri,
        pickerResult.name,
        pickerResult.mimeType,
        pickerResult.size,
      );
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to process invoice';
      setProcessingError(errorMessage);
      setProcessingStep('error');
    }
  };

  const handleAcceptExtraction = (result: NormalizedInvoice) => {
    setFormInitialValues(normalizedInvoiceToFormValues(result));
    // formPdfFile is already set from the pipeline run; no need to reset it here
    setView('form');
  };

  const handleRetryExtraction = async () => {
    if (!cachedPickerResult) return;
    setNormalizedResult(null);
    setProcessingError(null);
    await runProcessingPipeline(
      cachedPickerResult.uri,
      cachedPickerResult.name,
      cachedPickerResult.mimeType,
      cachedPickerResult.size,
    );
  };

  const handleFallbackToManual = () => {
    setFormInitialValues(undefined);
    // formPdfFile retains whatever was set by the pipeline run
    setView('form');
  };

  const handleFormSave = async (data: any) => {
    const result = await createInvoice(data);
    if (result.success) {
      onClose();
    } else {
      Alert.alert('Error', result.error || 'Failed to save invoice');
    }
  };

  const handleFormCancel = () => {
    setView('upload');
  };

  const isProcessing =
    processingStep === 'copying' ||
    processingStep === 'ocr' ||
    processingStep === 'normalizing';

  return {
    view,
    processingStep,
    processingError,
    isProcessing,
    normalizedResult,
    formInitialValues,
    formPdfFile,
    invoicesLoading,
    handleUploadPdf,
    handleSnapPhoto,
    handleAcceptExtraction,
    handleRetryExtraction,
    handleFallbackToManual,
    handleFormSave,
    handleFormCancel,
  };
}
