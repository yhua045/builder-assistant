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
import { IOcrAdapter } from '../application/services/IOcrAdapter';
import { IQuotationParsingStrategy } from '../application/ai/IQuotationParsingStrategy';
import { IPdfConverter } from '../infrastructure/files/IPdfConverter';
import { IFilePickerAdapter } from '../infrastructure/files/IFilePickerAdapter';
import { IFileSystemAdapter } from '../infrastructure/files/IFileSystemAdapter';
import { MobileFilePickerAdapter } from '../infrastructure/files/MobileFilePickerAdapter';
import { MobileFileSystemAdapter } from '../infrastructure/files/MobileFileSystemAdapter';
import { validatePdfFile } from '../utils/fileValidation';
import { PdfFileMetadata } from '../types/PdfFileMetadata';
import { ProcessQuotationUploadUseCase } from '../application/usecases/quotation/ProcessQuotationUploadUseCase';
import { normalizedQuotationToFormValues } from '../utils/normalizedQuotationToFormValues';
import { Quotation, QuotationEntity } from '../domain/entities/Quotation';

export type QuotationProcessingStep = 'idle' | 'copying' | 'ocr' | 'error';

export interface QuotationUploadOptions {
  onClose: () => void;
  onSuccess?: (quotation: Quotation) => void;
  /** OCR adapter overrides (injected by Dashboard / tests) */
  ocrAdapter?: IOcrAdapter;
  pdfConverter?: IPdfConverter;
  parsingStrategy?: IQuotationParsingStrategy;
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

  const buildUseCase = (): ProcessQuotationUploadUseCase | null => {
    if (ocrAdapter && parsingStrategy) {
      return new ProcessQuotationUploadUseCase(ocrAdapter, parsingStrategy, pdfConverter);
    }
    return null;
  };

  const runProcessingPipeline = async (pdfFile: PdfFileMetadata) => {
    const useCase = buildUseCase();
    if (!useCase) {
      // No OCR adapters — show form without pre-fill (graceful degradation)
      setProcessingStep('idle');
      setFormPdfFile(pdfFile);
      setFormInitialValues(undefined);
      return;
    }

    setProcessingStep('ocr');
    try {
      const output = await useCase.execute({
        fileUri: pdfFile.uri,
        filename: pdfFile.name,
        mimeType: pdfFile.mimeType ?? 'application/pdf',
        fileSize: pdfFile.size,
      });

      const initialValues = normalizedQuotationToFormValues(output.normalized);
      setFormInitialValues(initialValues);
      setFormPdfFile(pdfFile);
      setProcessingStep('idle');
      setProcessingError(null);
    } catch (err: any) {
      setProcessingError(err?.message || 'OCR processing failed');
      setProcessingStep('error');
      // Form remains editable — non-blocking error
      setFormPdfFile(pdfFile);
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

      const validation = validatePdfFile(result.type, result.size);
      if (!validation.isValid) {
        setProcessingStep('idle');
        const alertTitle = validation.error?.includes('20MB') ? 'File Too Large' : 'Invalid File';
        Alert.alert(alertTitle, validation.error || 'Invalid file');
        return;
      }

      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).slice(2, 8);
      const destinationFilename = `quote_${timestamp}_${randomSuffix}.pdf`;
      const appStorageUri = await fileSystem.copyToAppStorage(result.uri!, destinationFilename);

      const pdfFile: PdfFileMetadata = {
        uri: appStorageUri,
        originalUri: result.uri!,
        name: result.name!,
        size: result.size!,
        mimeType: result.type || 'application/pdf',
      };

      await runProcessingPipeline(pdfFile);
    } catch (err: any) {
      setProcessingError(err?.message || 'Failed to process quote');
      setProcessingStep('error');
    }
  };

  const handleSubmit = async (data: Omit<Quotation, 'id' | 'createdAt' | 'updatedAt'>) => {
    try {
      const entity = QuotationEntity.create(data as any);
      const validated = entity.data();
      const created = await createQuotation(validated);
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
    handleUploadPdf,
    handleSubmit,
  };
}
