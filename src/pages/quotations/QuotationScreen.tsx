import React from 'react';
import { Modal, View, Text, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Paperclip, X } from 'lucide-react-native';
import { cssInterop } from 'nativewind';
import { QuotationForm } from '../../components/quotations/QuotationForm';
import { Quotation } from '../../domain/entities/Quotation';
import { IFilePickerAdapter } from '../../infrastructure/files/IFilePickerAdapter';
import { IFileSystemAdapter } from '../../infrastructure/files/IFileSystemAdapter';
import { IOcrAdapter } from '../../application/services/IOcrAdapter';
import { IQuotationParsingStrategy } from '../../application/ai/IQuotationParsingStrategy';
import { IPdfConverter } from '../../infrastructure/files/IPdfConverter';
import { useQuotationUpload } from '../../hooks/useQuotationUpload';

cssInterop(X, { className: { target: 'style', nativeStyleToProp: { color: true } } });

export interface QuotationScreenProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: (quotation: Quotation) => void;
  /** Optional adapters for dependency injection (testing) */
  filePickerAdapter?: IFilePickerAdapter;
  fileSystemAdapter?: IFileSystemAdapter;
  ocrAdapter?: IOcrAdapter;
  pdfConverter?: IPdfConverter;
  parsingStrategy?: IQuotationParsingStrategy;
}

export const QuotationScreen: React.FC<QuotationScreenProps> = ({
  visible,
  onClose,
  onSuccess,
  filePickerAdapter,
  fileSystemAdapter,
  ocrAdapter,
  pdfConverter,
  parsingStrategy,
}) => {
  const vm = useQuotationUpload({
    onClose,
    onSuccess,
    ocrAdapter,
    pdfConverter,
    parsingStrategy,
    filePickerAdapter,
    fileSystemAdapter,
  });

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
            onPress={vm.handleUploadPdf}
            disabled={vm.isProcessing}
            className="bg-card border border-border rounded-xl p-4 items-center flex-row justify-center active:opacity-80"
          >
            {vm.isProcessing ? (
              <ActivityIndicator size="small" color="#6b7280" />
            ) : (
              <Paperclip size={20} color="#6b7280" />
            )}
            <Text className="text-foreground font-medium ml-2">
              {vm.processingStep === 'copying'
                ? 'Copying file…'
                : vm.processingStep === 'ocr'
                ? 'Extracting data…'
                : vm.formPdfFile
                ? vm.formPdfFile.name
                : 'Upload Quote PDF'}
            </Text>
          </Pressable>

          {/* Inline OCR error banner — non-blocking */}
          {vm.processingStep === 'error' && vm.processingError && (
            <View
              testID="ocr-error-banner"
              className="bg-destructive/10 border border-destructive rounded-xl p-3 mt-2"
            >
              <Text className="text-destructive text-sm">{vm.processingError}</Text>
            </View>
          )}
        </View>

        {/* QuotationForm — always visible below upload section */}
        <QuotationForm
          key={vm.formInitialValues ? 'loaded' : 'empty'}
          initialValues={vm.formInitialValues}
          onSubmit={vm.handleSubmit}
          onCancel={onClose}
          isLoading={vm.loading}
          pdfFile={vm.formPdfFile}
          embedded
        />
      </SafeAreaView>
    </Modal>
  );
};
