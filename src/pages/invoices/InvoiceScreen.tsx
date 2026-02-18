import React, { useState } from 'react';
import { View, Alert, Text, Pressable, ActivityIndicator } from 'react-native';
import { Paperclip, Edit } from 'lucide-react-native';
import { IFilePickerAdapter } from '../../infrastructure/files/IFilePickerAdapter';
import { IFileSystemAdapter } from '../../infrastructure/files/IFileSystemAdapter';
import { MobileFilePickerAdapter } from '../../infrastructure/files/MobileFilePickerAdapter';
import { MobileFileSystemAdapter } from '../../infrastructure/files/MobileFileSystemAdapter';
import { validatePdfFile } from '../../utils/fileValidation';
import { PdfFileMetadata } from '../../types/PdfFileMetadata';

interface InvoiceScreenProps {
  onClose: () => void;
  onNavigateToForm: (options: { mode: 'create'; pdfFile?: PdfFileMetadata }) => void;
  filePickerAdapter?: IFilePickerAdapter; // Optional for dependency injection (testing)
  fileSystemAdapter?: IFileSystemAdapter; // Optional for dependency injection (testing)
  enablePdfParsing?: boolean; // Feature flag for future PDF parsing
}

export const InvoiceScreen = ({
  onClose,
  onNavigateToForm,
  filePickerAdapter,
  fileSystemAdapter,
  enablePdfParsing = false,
}: InvoiceScreenProps) => {
  const [isUploading, setIsUploading] = useState(false);

  // Use provided adapters or create default instances
  const filePicker = filePickerAdapter || new MobileFilePickerAdapter();
  const fileSystem = fileSystemAdapter || new MobileFileSystemAdapter();

  const handleUploadPdf = async () => {
    try {
      setIsUploading(true);

      // Step 1: Open file picker
      const result = await filePicker.pickDocument();

      // User cancelled
      if (result.cancelled) {
        setIsUploading(false);
        return;
      }

      // Step 2: Validate file
      const validation = validatePdfFile(result.type, result.size);
      if (!validation.isValid) {
        setIsUploading(false);
        
        // Determine alert title based on error type
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
        destinationFilename
      );

      // Step 4: Cache metadata in memory (not saved to DB yet)
      const pdfFile: PdfFileMetadata = {
        uri: appStorageUri,
        originalUri: result.uri!,
        name: result.name!,
        size: result.size!,
        mimeType: result.type || 'application/pdf',
      };

      // Step 5: Navigate to InvoiceForm with pdfFile metadata
      setIsUploading(false);
      onNavigateToForm({ mode: 'create', pdfFile });
    } catch (err: any) {
      setIsUploading(false);
      const errorMessage = err?.message || 'Failed to upload PDF';

      Alert.alert('Upload Error', errorMessage);
    }
  };

  const handleManualEntry = () => {
    // Navigate to InvoiceForm without pdfFile prop
    onNavigateToForm({ mode: 'create' });
  };

  return (
    <View className="flex-1 bg-background p-4 pt-8" testID="invoice-screen">
      <Text className="text-2xl font-bold mb-6 text-foreground">Add Invoice</Text>

      {/* Upload PDF Button */}
      <Pressable
        className="bg-primary rounded-lg p-4 mb-4 flex-row items-center justify-center"
        onPress={handleUploadPdf}
        disabled={isUploading}
        testID="upload-pdf-button"
      >
        {isUploading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Paperclip color="#fff" size={24} strokeWidth={2} />
            <Text className="text-white font-semibold text-lg ml-3">Upload Invoice PDF</Text>
          </>
        )}
      </Pressable>

      {isUploading && (
        <Text className="text-sm text-muted-foreground text-center mb-4">
          Copying file to app storage...
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
        disabled={isUploading}
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
