import React from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { Paperclip } from 'lucide-react-native';
import { ExtractionResultsPanel } from '../components/ExtractionResultsPanel';
import { InvoiceForm } from '../components/InvoiceForm';
import { IOcrAdapter } from '../../../application/services/IOcrAdapter';
import { IInvoiceNormalizer } from '../application/IInvoiceNormalizer';
import { IPdfConverter } from '../../../infrastructure/files/IPdfConverter';
import { IFilePickerAdapter } from '../../../infrastructure/files/IFilePickerAdapter';
import { IFileSystemAdapter } from '../../../infrastructure/files/IFileSystemAdapter';
import { useInvoiceUpload } from '../hooks/useInvoiceUpload';

interface InvoiceScreenProps {
  onClose: () => void;
  /** Optional OCR / AI adapters — forwarded to useInvoiceUpload */
  ocrAdapter?: IOcrAdapter;
  invoiceNormalizer?: IInvoiceNormalizer;
  pdfConverter?: IPdfConverter;
  /** File adapter overrides — for testing only */
  filePickerAdapter?: IFilePickerAdapter;
  fileSystemAdapter?: IFileSystemAdapter;
  /** @deprecated Navigation is handled inline; kept for backward compat with tests */
  onNavigateToForm?: () => void;
}

export const InvoiceScreen = ({
  onClose,
  ocrAdapter,
  invoiceNormalizer,
  pdfConverter,
  filePickerAdapter,
  fileSystemAdapter,
}: InvoiceScreenProps) => {
  const vm = useInvoiceUpload({ onClose, ocrAdapter, invoiceNormalizer, pdfConverter, filePickerAdapter, fileSystemAdapter });

  // ── Render: ExtractionResultsPanel (review state) ───────────────────────
  if (vm.processingStep === 'review' && vm.normalizedResult && vm.view !== 'form') {
    return (
      <View className="flex-1 bg-background" testID="invoice-screen">
        <View className="px-4 pt-8 pb-2 flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-foreground">Review Extraction</Text>
          <Pressable
            onPress={vm.handleFallbackToManual}
            testID="skip-extraction-button"
          >
            <Text className="text-primary font-medium">Skip</Text>
          </Pressable>
        </View>
        <ExtractionResultsPanel
          extractionResult={vm.normalizedResult}
          onAccept={vm.handleAcceptExtraction}
          onRetry={vm.handleRetryExtraction}
          onEdit={() => { /* inline edits tracked inside ExtractionResultsPanel */ }}
        />
      </View>
    );
  }

  // ── Render: inline form when view === 'form' ─────────────────────────────
  if (vm.view === 'form') {
    return (
      <View className="flex-1 bg-background" testID="invoice-screen">
        <View className="px-4 pt-4 pb-2 flex-row items-center">
          <Pressable onPress={vm.handleFormCancel} testID="invoice-form-back">
            <Text className="text-primary">← Back</Text>
          </Pressable>
          <Text className="text-2xl font-bold text-foreground ml-4">New Invoice</Text>
        </View>
        <View className="flex-1 px-4 text-foreground">
          <InvoiceForm
            mode="create"
            initialValues={vm.formInitialValues}
            onCreate={vm.handleFormSave}
            onCancel={vm.handleFormCancel}
            isLoading={vm.invoicesLoading}
            pdfFile={vm.formPdfFile}
          />
        </View>
      </View>
    );
  }

  // ── Render: Error state ──────────────────────────────────────────────────
  if (vm.processingStep === 'error') {
    return (
      <View className="flex-1 bg-background p-4 pt-8 justify-center" testID="invoice-screen">
        <Text className="text-2xl font-bold text-foreground mb-4">Processing Failed</Text>
        <Text className="text-muted-foreground mb-8" testID="ocr-error-message">
          {vm.processingError || 'An unexpected error occurred while processing the invoice.'}
        </Text>

        <Pressable
          className="bg-primary rounded-lg p-4 mb-4 items-center"
          onPress={vm.handleRetryExtraction}
          testID="retry-ocr-button"
        >
          <Text className="text-white font-semibold text-lg">Retry OCR</Text>
        </Pressable>

        <Pressable
          className="bg-secondary rounded-lg p-4 mb-4 items-center"
          onPress={vm.handleFallbackToManual}
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

  // ── Render: Default upload view — PDF button at top, form immediately below ──
  return (
    <View className="flex-1 bg-background" testID="invoice-screen">
      {/* Upload Invoice PDF — always shown at the top */}
      <View className="px-4 pt-8 pb-4">
        <Text className="text-2xl font-bold text-foreground mb-4">New Invoice</Text>
        <Pressable
          testID="upload-pdf-button"
          onPress={vm.handleUploadPdf}
          disabled={vm.isProcessing}
          className="bg-primary/10 border border-primary/30 p-4 rounded-xl flex-row items-center justify-center active:opacity-70"
        >
          {vm.isProcessing ? (
            <ActivityIndicator size="small" color="#6366f1" />
          ) : (
            <Paperclip size={20} color="#6366f1" />
          )}
          <Text className="text-primary font-semibold ml-2">
            {vm.isProcessing ? 'Processing PDF…' : vm.formPdfFile ? vm.formPdfFile.name : 'Upload Invoice PDF'}
          </Text>
        </Pressable>
      </View>

      {/* Invoice form — always visible below the upload button */}
      <View className="flex-1 px-4 pt-4 text-foreground">
        <InvoiceForm
          mode="create"
          initialValues={vm.formInitialValues}
          onCreate={vm.handleFormSave}
          onCancel={onClose}
          isLoading={vm.invoicesLoading}
          pdfFile={vm.formPdfFile}
        />
      </View>
    </View>
  );
};
