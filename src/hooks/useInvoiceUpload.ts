/**
 * useInvoiceUpload — View-Model Facade for InvoiceScreen
 *
 * Design: design/issue-210-ocr-screens-refactor.md §4.2
 *
 * Encapsulates all state (multi-step pipeline), adapter wiring, and Use Case
 * orchestration for the invoice upload flow. InvoiceScreen becomes a pure
 * presentation component.
 */

import { useState, useMemo } from 'react';
import { Alert } from 'react-native';
import { useInvoices } from './useInvoices';
import { IOcrAdapter } from '../application/services/IOcrAdapter';
import { IInvoiceNormalizer, NormalizedInvoice } from '../application/ai/IInvoiceNormalizer';
import { IPdfConverter } from '../infrastructure/files/IPdfConverter';
import { IFilePickerAdapter } from '../infrastructure/files/IFilePickerAdapter';
import { IFileSystemAdapter } from '../infrastructure/files/IFileSystemAdapter';
import { MobileFilePickerAdapter } from '../infrastructure/files/MobileFilePickerAdapter';
import { MobileFileSystemAdapter } from '../infrastructure/files/MobileFileSystemAdapter';
import { validatePdfFile } from '../utils/fileValidation';
import { PdfFileMetadata } from '../types/PdfFileMetadata';
import { ProcessInvoiceUploadUseCase } from '../application/usecases/invoice/ProcessInvoiceUploadUseCase';
import { normalizedInvoiceToFormValues } from '../utils/normalizedInvoiceToFormValues';
import { Invoice } from '../domain/entities/Invoice';

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
    filePickerAdapter,
    fileSystemAdapter,
  } = options;

  const [processingStep, setProcessingStep] = useState<InvoiceProcessingStep>('idle');
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [normalizedResult, setNormalizedResult] = useState<NormalizedInvoice | null>(null);
  const [cachedPdfFile, setCachedPdfFile] = useState<PdfFileMetadata | null>(null);
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

  const buildUseCase = (): ProcessInvoiceUploadUseCase | null => {
    if (ocrAdapter && invoiceNormalizer) {
      return new ProcessInvoiceUploadUseCase(ocrAdapter, invoiceNormalizer, pdfConverter);
    }
    return null;
  };

  const runProcessingPipeline = async (pdfFile: PdfFileMetadata) => {
    const useCase = buildUseCase();
    if (!useCase) {
      // No OCR adapters — skip to form directly (graceful degradation)
      setProcessingStep('idle');
      setFormPdfFile(pdfFile);
      setFormInitialValues(undefined);
      setView('form');
      return;
    }

    setProcessingStep('ocr');
    const output = await useCase.execute({
      fileUri: pdfFile.uri,
      filename: pdfFile.name,
      mimeType: pdfFile.mimeType ?? 'application/pdf',
      fileSize: pdfFile.size,
    });

    // Populate form directly with normalized OCR result
    setNormalizedResult(output.normalized);
    const initialValues = normalizedInvoiceToFormValues(output.normalized);
    setFormInitialValues(initialValues);
    setFormPdfFile(pdfFile);
    setProcessingStep('idle');
    setView('form');
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

      const validation = validatePdfFile(result.type, result.size);
      if (!validation.isValid) {
        setProcessingStep('idle');
        const alertTitle = validation.error?.includes('20MB')
          ? 'File Too Large'
          : 'Invalid File';
        Alert.alert(alertTitle, validation.error || 'Invalid file');
        return;
      }

      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).slice(2, 8);
      const destinationFilename = `invoice_${timestamp}_${randomSuffix}.pdf`;

      const appStorageUri = await fileSystem.copyToAppStorage(
        result.uri!,
        destinationFilename,
      );

      const pdfFile: PdfFileMetadata = {
        uri: appStorageUri,
        originalUri: result.uri!,
        name: result.name!,
        size: result.size!,
        mimeType: result.type || 'application/pdf',
      };
      setCachedPdfFile(pdfFile);

      await runProcessingPipeline(pdfFile);
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to process invoice';
      setProcessingError(errorMessage);
      setProcessingStep('error');
    }
  };

  const handleAcceptExtraction = (result: NormalizedInvoice) => {
    const initialValues = normalizedInvoiceToFormValues(result);
    setFormInitialValues(initialValues);
    setFormPdfFile(cachedPdfFile ?? undefined);
    setView('form');
  };

  const handleRetryExtraction = async () => {
    if (!cachedPdfFile) return;
    setNormalizedResult(null);
    setProcessingError(null);
    try {
      await runProcessingPipeline(cachedPdfFile);
    } catch (err: any) {
      setProcessingError(err?.message || 'Retry failed');
      setProcessingStep('error');
    }
  };

  const handleFallbackToManual = () => {
    setFormInitialValues(undefined);
    setFormPdfFile(cachedPdfFile ?? undefined);
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
    handleAcceptExtraction,
    handleRetryExtraction,
    handleFallbackToManual,
    handleFormSave,
    handleFormCancel,
  };
}
