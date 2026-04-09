import React, { useState } from 'react';
import { Modal, View, Alert, Text, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Paperclip, X } from 'lucide-react-native';
import { cssInterop } from 'nativewind';
import { QuotationForm } from '../../components/quotations/QuotationForm';
import { useQuotations } from '../../hooks/useQuotations';
import { Quotation, QuotationEntity } from '../../domain/entities/Quotation';
import { IFilePickerAdapter } from '../../infrastructure/files/IFilePickerAdapter';
import { IFileSystemAdapter } from '../../infrastructure/files/IFileSystemAdapter';
import { MobileFilePickerAdapter } from '../../infrastructure/files/MobileFilePickerAdapter';
import { MobileFileSystemAdapter } from '../../infrastructure/files/MobileFileSystemAdapter';
import { validatePdfFile } from '../../utils/fileValidation';
import { PdfFileMetadata } from '../../types/PdfFileMetadata';
import { IOcrAdapter } from '../../application/services/IOcrAdapter';
import { IInvoiceNormalizer } from '../../application/ai/IInvoiceNormalizer';
import {
  ProcessInvoiceUploadUseCase,
} from '../../application/usecases/invoice/ProcessInvoiceUploadUseCase';
import { IPdfConverter } from '../../infrastructure/files/IPdfConverter';
import { normalizedInvoiceToQuotationFormValues } from '../../utils/normalizedInvoiceToQuotationFormValues';

cssInterop(X, { className: { target: 'style', nativeStyleToProp: { color: true } } });

type ProcessingStep = 'idle' | 'copying' | 'ocr' | 'error';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (quotation: Quotation) => void;
  /** Optional adapters for dependency injection (testing) */
  filePickerAdapter?: IFilePickerAdapter;
  fileSystemAdapter?: IFileSystemAdapter;
  ocrAdapter?: IOcrAdapter;
  invoiceNormalizer?: IInvoiceNormalizer;
  pdfConverter?: IPdfConverter;
}

export const QuotationScreen: React.FC<Props> = ({
  visible,
  onClose,
  onSuccess,
  filePickerAdapter,
  fileSystemAdapter,
  ocrAdapter,
  invoiceNormalizer,
  pdfConverter,
}) => {
  const { createQuotation, loading } = useQuotations();

  const [processingStep, setProcessingStep] = useState<ProcessingStep>('idle');
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [formInitialValues, setFormInitialValues] = useState<Partial<Quotation> | undefined>(undefined);
  const [formPdfFile, setFormPdfFile] = useState<PdfFileMetadata | undefined>(undefined);

  // Use provided adapters or fall back to real mobile implementations
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
      // No OCR adapters injected — show form without pre-fill (graceful degradation)
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

      const initialValues = normalizedInvoiceToQuotationFormValues(output.normalized);
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

      // Validate file type/size
      const validation = validatePdfFile(result.type, result.size);
      if (!validation.isValid) {
        setProcessingStep('idle');
        const alertTitle = validation.error?.includes('20MB') ? 'File Too Large' : 'Invalid File';
        Alert.alert(alertTitle, validation.error || 'Invalid file');
        return;
      }

      // Copy to app storage
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
      Alert.alert('Error', error instanceof Error ? error.message : 'Failed to create quotation');
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView className="flex-1 bg-background">
        {/* Modal Header */}
        <View
          testID="quotation-modal-header"
          className="px-6 pt-8 pb-4 flex-row items-center justify-between border-b border-border"
        >
          <Text className="text-2xl font-bold text-foreground">New Quotation</Text>
          <Pressable testID="quotation-modal-close-button" onPress={onClose}>
            <X size={24} className="text-foreground" />
          </Pressable>
        </View>

        {/* Upload Pressable — always visible below header */}
        <View className="px-6 pt-4 pb-2">
          <Pressable
            testID="upload-quote-pdf-button"
            onPress={handleUploadPdf}
            disabled={processingStep === 'copying' || processingStep === 'ocr'}
            className="bg-card border border-border rounded-xl p-4 items-center flex-row justify-center active:opacity-80"
          >
            {processingStep === 'copying' || processingStep === 'ocr' ? (
              <ActivityIndicator size="small" color="#6b7280" />
            ) : (
              <Paperclip size={20} color="#6b7280" />
            )}
            <Text className="text-foreground font-medium ml-2">
              {processingStep === 'copying'
                ? 'Copying file…'
                : processingStep === 'ocr'
                ? 'Extracting data…'
                : formPdfFile
                ? formPdfFile.name
                : 'Upload Quote PDF'}
            </Text>
          </Pressable>

          {/* Inline OCR error banner — non-blocking */}
          {processingStep === 'error' && processingError && (
            <View
              testID="ocr-error-banner"
              className="bg-destructive/10 border border-destructive rounded-xl p-3 mt-2"
            >
              <Text className="text-destructive text-sm">{processingError}</Text>
            </View>
          )}
        </View>

        {/* QuotationForm — always visible below upload section */}
        <QuotationForm
            key={formInitialValues ? 'loaded' : 'empty'}
          initialValues={formInitialValues}
          onSubmit={handleSubmit}
          onCancel={onClose}
          isLoading={loading}
          pdfFile={formPdfFile}
          embedded
        />
      </SafeAreaView>
    </Modal>
  );
};
