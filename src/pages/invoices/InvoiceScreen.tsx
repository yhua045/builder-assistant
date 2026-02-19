import React, { useState } from 'react';
import { View, Alert, Text, Pressable, ActivityIndicator } from 'react-native';
import { Paperclip, Edit } from 'lucide-react-native';
import { IFilePickerAdapter } from '../../infrastructure/files/IFilePickerAdapter';
import { IFileSystemAdapter } from '../../infrastructure/files/IFileSystemAdapter';
import { MobileFilePickerAdapter } from '../../infrastructure/files/MobileFilePickerAdapter';
import { MobileFileSystemAdapter } from '../../infrastructure/files/MobileFileSystemAdapter';
import { validatePdfFile } from '../../utils/fileValidation';
import { PdfFileMetadata } from '../../types/PdfFileMetadata';
import { IOcrAdapter } from '../../application/services/IOcrAdapter';
import { IInvoiceNormalizer, NormalizedInvoice } from '../../application/ai/IInvoiceNormalizer';
import {
  ProcessInvoiceUploadUseCase,
} from '../../application/usecases/invoice/ProcessInvoiceUploadUseCase';
import { IPdfConverter } from '../../infrastructure/files/IPdfConverter';
import { ExtractionResultsPanel } from '../../components/invoices/ExtractionResultsPanel';
import { InvoiceForm } from '../../components/invoices/InvoiceForm';
import { useInvoices } from '../../hooks/useInvoices';
import { normalizedInvoiceToFormValues } from '../../utils/normalizedInvoiceToFormValues';
import { Invoice } from '../../domain/entities/Invoice';

/** Steps in the upload processing pipeline. */
type ProcessingStep = 'idle' | 'copying' | 'ocr' | 'normalizing' | 'review' | 'error';

interface InvoiceScreenProps {
  onClose: () => void;
  /** @deprecated: prefer inline form via view state; kept for backward compat in tests */
  onNavigateToForm?: (options: {
    mode: 'create';
    pdfFile?: PdfFileMetadata;
    initialValues?: Partial<Invoice>;
  }) => void;
  /** Optional for dependency injection (testing) */
  filePickerAdapter?: IFilePickerAdapter;
  fileSystemAdapter?: IFileSystemAdapter;
  /** Optional OCR / AI adapters for dependency injection (testing) */
  ocrAdapter?: IOcrAdapter;
  invoiceNormalizer?: IInvoiceNormalizer;
  /** Optional PDF converter for dependency injection. When provided, PDF uploads
   * are converted to images before OCR. Defaults to no conversion (empty result). */
  pdfConverter?: IPdfConverter;
  /** Feature flag — currently unused; reserved for future PDF OCR support */
  enablePdfParsing?: boolean;
}

export const InvoiceScreen = ({
  onClose,
  onNavigateToForm,
  filePickerAdapter,
  fileSystemAdapter,
  ocrAdapter,
  invoiceNormalizer,
  pdfConverter,
  enablePdfParsing = false,
}: InvoiceScreenProps) => {
  const [processingStep, setProcessingStep] = useState<ProcessingStep>('idle');
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [normalizedResult, setNormalizedResult] = useState<NormalizedInvoice | null>(null);
  const [cachedPdfFile, setCachedPdfFile] = useState<PdfFileMetadata | null>(null);
  // View state for inline form embedding
  const [view, setView] = useState<'upload' | 'form' | 'review' | 'error'>('upload');
  const [formInitialValues, setFormInitialValues] = useState<Partial<Invoice> | undefined>(undefined);
  const [formPdfFile, setFormPdfFile] = useState<PdfFileMetadata | undefined>(undefined);

  const { createInvoice, updateInvoice, loading: invoicesLoading } = useInvoices();

  // Use provided adapters or create default instances
  const filePicker = filePickerAdapter ?? new MobileFilePickerAdapter();
  const fileSystem = fileSystemAdapter ?? new MobileFileSystemAdapter();

  const buildUseCase = (): ProcessInvoiceUploadUseCase | null => {
    if (ocrAdapter && invoiceNormalizer) {
      return new ProcessInvoiceUploadUseCase(ocrAdapter, invoiceNormalizer, pdfConverter);
    }
    return null;
  };

  const runProcessingPipeline = async (pdfFile: PdfFileMetadata) => {
    const useCase = buildUseCase();
    if (!useCase) {
      // No OCR adapters injected — skip to form directly
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

    setNormalizedResult(output.normalized);
    setProcessingStep('review');
  };

  const handleUploadPdf = async () => {
    try {
      setProcessingStep('copying');
      setProcessingError(null);

      // Step 1: Open file picker
      const result = await filePicker.pickDocument();

      if (result.cancelled) {
        setProcessingStep('idle');
        return;
      }

      // Step 2: Validate file
      const validation = validatePdfFile(result.type, result.size);
      if (!validation.isValid) {
        setProcessingStep('idle');
        const alertTitle = validation.error?.includes('20MB')
          ? 'File Too Large'
          : 'Invalid File';
        Alert.alert(alertTitle, validation.error || 'Invalid file');
        return;
      }

      // Step 3: Copy file to app's private storage
      const timestamp = Date.now();
      const randomSuffix = Math.random().toString(36).slice(2, 8);
      const destinationFilename = `invoice_${timestamp}_${randomSuffix}.pdf`;

      const appStorageUri = await fileSystem.copyToAppStorage(
        result.uri!,
        destinationFilename,
      );

      // Step 4: Cache metadata in memory
      const pdfFile: PdfFileMetadata = {
        uri: appStorageUri,
        originalUri: result.uri!,
        name: result.name!,
        size: result.size!,
        mimeType: result.type || 'application/pdf',
      };
      setCachedPdfFile(pdfFile);

      // Step 5: Run OCR + normalization pipeline
      await runProcessingPipeline(pdfFile);
    } catch (err: any) {
      const errorMessage = err?.message || 'Failed to process invoice';
      setProcessingError(errorMessage);
      setProcessingStep('error');
    }
  };

  const handleManualEntry = () => {
    setFormInitialValues(undefined);
    setFormPdfFile(undefined);
    setView('form');
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
    // data is the invoice DTO from InvoiceForm
    const result = await createInvoice(data);
    if (result.success) {
      onClose();
    } else {
      Alert.alert('Error', result.error || 'Failed to save invoice');
    }
  };

  const handleFormCancel = () => {
    // Return to upload view
    setView('upload');
  };

  // ── Render: ExtractionResultsPanel (review state) ───────────────────────
  if (processingStep === 'review' && normalizedResult && view !== 'form') {
    return (
      <View className="flex-1 bg-background" testID="invoice-screen">
        <View className="px-4 pt-8 pb-2 flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-foreground">Review Extraction</Text>
          <Pressable
            onPress={handleFallbackToManual}
            testID="skip-extraction-button"
          >
            <Text className="text-primary font-medium">Skip</Text>
          </Pressable>
        </View>
        <ExtractionResultsPanel
          extractionResult={normalizedResult}
          onAccept={handleAcceptExtraction}
          onRetry={handleRetryExtraction}
          onEdit={() => {/* inline edits tracked inside ExtractionResultsPanel */}}
        />
      </View>
    );
  }

  // Render inline form when view === 'form'
  if (view === 'form') {
    return (
      <View className="flex-1 bg-background" testID="invoice-screen">
        <View className="px-4 pt-4 pb-2 flex-row items-center">
          <Pressable onPress={() => setView('upload')} testID="invoice-form-back">
            <Text className="text-primary">← Back</Text>
          </Pressable>
          <Text className="text-2xl font-bold text-foreground ml-4">New Invoice</Text>
        </View>
        <InvoiceForm
          mode="create"
          initialValues={formInitialValues}
          onCreate={handleFormSave}
          onCancel={handleFormCancel}
          isLoading={invoicesLoading}
          pdfFile={formPdfFile}
          embedded
        />
      </View>
    );
  }

  // ── Render: Error state ──────────────────────────────────────────────────
  if (processingStep === 'error') {
    return (
      <View className="flex-1 bg-background p-4 pt-8 justify-center" testID="invoice-screen">
        <Text className="text-2xl font-bold text-foreground mb-4">Processing Failed</Text>
        <Text className="text-muted-foreground mb-8" testID="ocr-error-message">
          {processingError || 'An unexpected error occurred while processing the invoice.'}
        </Text>

        <Pressable
          className="bg-primary rounded-lg p-4 mb-4 items-center"
          onPress={handleRetryExtraction}
          testID="retry-ocr-button"
        >
          <Text className="text-white font-semibold text-lg">Retry OCR</Text>
        </Pressable>

        <Pressable
          className="bg-secondary rounded-lg p-4 mb-4 items-center"
          onPress={handleFallbackToManual}
          testID="fallback-manual-button"
        >
          <Text className="text-foreground font-semibold text-lg">Enter Manually</Text>
        </Pressable>

        <Pressable
          className="bg-transparent border border-border rounded-lg p-4 items-center"
          onPress={onClose}
          testID="cancel-button"
        >
          <Text className="text-foreground font-semibold">Cancel</Text>
        </Pressable>
      </View>
    );
  }

  // ── Render: OCR/Normalizing in-progress or idle ──────────────────────────
  const isProcessing =
    processingStep === 'copying' ||
    processingStep === 'ocr' ||
    processingStep === 'normalizing';

  const processingLabel: Partial<Record<ProcessingStep, string>> = {
    copying: 'Copying file to app storage…',
    ocr: 'Extracting text from invoice…',
    normalizing: 'Analysing invoice fields…',
  };

  return (
    <View className="flex-1 bg-background p-4 pt-8" testID="invoice-screen">
      <Text className="text-2xl font-bold mb-6 text-foreground">Add Invoice</Text>

      {/* Upload PDF Button */}
      <Pressable
        className="bg-primary rounded-lg p-4 mb-4 flex-row items-center justify-center"
        onPress={handleUploadPdf}
        disabled={isProcessing}
        testID="upload-pdf-button"
      >
        {isProcessing ? (
          <ActivityIndicator color="#fff" testID="upload-progress-indicator" />
        ) : (
          <>
            <Paperclip color="#fff" size={24} strokeWidth={2} />
            <Text className="text-white font-semibold text-lg ml-3">Upload Invoice PDF</Text>
          </>
        )}
      </Pressable>

      {isProcessing && processingLabel[processingStep] && (
        <Text
          className="text-sm text-muted-foreground text-center mb-4"
          testID="processing-status-text"
        >
          {processingLabel[processingStep]}
        </Text>
      )}

      {/* Separator */}
      <View className="flex-row items-center my-6">
        <View className="flex-1 h-px bg-border" />
        <Text className="text-muted-foreground mx-4">Or enter manually</Text>
        <View className="flex-1 h-px bg-border" />
      </View>

      {/* Manual Entry Button */}
      <Pressable
        className="bg-secondary rounded-lg p-4 mb-4 flex-row items-center justify-center"
        onPress={handleManualEntry}
        disabled={isProcessing}
        testID="manual-entry-button"
      >
        <Edit color="#000" size={24} strokeWidth={2} />
        <Text className="text-foreground font-semibold text-lg ml-3">
          Enter Invoice Details
        </Text>
      </Pressable>

      <Text className="text-sm text-muted-foreground text-center mb-6">
        Manually create an invoice
      </Text>

      {/* Cancel Button */}
      <Pressable
        className="bg-transparent border border-border rounded-lg p-4 mt-auto"
        onPress={onClose}
        testID="cancel-button"
      >
        <Text className="text-foreground text-center font-semibold">Cancel</Text>
      </Pressable>
    </View>
  );
};
