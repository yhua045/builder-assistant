import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { launchImageLibrary, ImagePickerResponse } from 'react-native-image-picker';
import { X, Upload, FileText } from 'lucide-react-native';

export interface UploadedFile {
  uri: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
}

export interface InvoiceUploadSectionProps {
  onUpload: (file: UploadedFile) => void;
  onError: (error: string) => void;
  uploading?: boolean;
  disabled?: boolean;
}

export const InvoiceUploadSection: React.FC<InvoiceUploadSectionProps> = ({
  onUpload,
  onError,
  uploading = false,
  disabled = false,
}) => {
  const [selectedFile, setSelectedFile] = useState<UploadedFile | null>(null);

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const handleFilePicker = async () => {
    try {
      const result: ImagePickerResponse = await launchImageLibrary({
        mediaType: 'photo',
        // selectionLimit is supported by the native library but TypeScript's
        // CameraOptions type may not include it depending on the version.
        // Cast to any to avoid a compile-time type mismatch while keeping
        // the runtime behavior intact.
        selectionLimit: 1,
        includeBase64: false,
      } as any);

      if (result.didCancel) {
        // User cancelled, do nothing
        return;
      }

      if (result.errorCode || result.errorMessage) {
        onError(result.errorMessage || 'Failed to pick file');
        return;
      }

      if (result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const file: UploadedFile = {
          uri: asset.uri!,
          fileName: asset.fileName || 'invoice',
          fileSize: asset.fileSize || 0,
          mimeType: asset.type || 'application/pdf',
        };

        setSelectedFile(file);
        onUpload(file);
      }
    } catch (error: any) {
      onError(error.message || 'File picker failed');
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
  };

  if (uploading) {
    return (
      <View testID="upload-progress" className="p-4 bg-background border border-border rounded-lg">
        <View className="flex-row items-center justify-center">
          <ActivityIndicator size="small" color="#3b82f6" />
          <Text className="ml-3 text-foreground">Uploading invoice...</Text>
        </View>
      </View>
    );
  }

  if (selectedFile) {
    return (
      <View className="p-4 bg-background border border-border rounded-lg">
        <View className="flex-row items-center justify-between">
          <View className="flex-1 flex-row items-center">
            <FileText size={24} color="#3b82f6" />
            <View className="ml-3 flex-1">
              <Text className="text-foreground font-medium">{selectedFile.fileName}</Text>
              <Text className="text-sm text-muted-foreground">
                {formatFileSize(selectedFile.fileSize)}
              </Text>
            </View>
          </View>
          <Pressable
            testID="remove-file-button"
            onPress={handleRemoveFile}
            className="p-2 rounded-full bg-destructive/10"
          >
            <X size={20} color="#ef4444" />
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View className="space-y-2">
      <Pressable
        onPress={handleFilePicker}
        disabled={disabled}
        className={`p-6 border-2 border-dashed rounded-lg items-center justify-center ${
          disabled ? 'border-border bg-muted' : 'border-primary bg-primary/5'
        }`}
      >
        <Upload size={32} color={disabled ? '#9ca3af' : '#3b82f6'} />
        <Text
          className={`mt-3 text-base font-medium ${
            disabled ? 'text-muted-foreground' : 'text-primary'
          }`}
        >
          Upload Invoice
        </Text>
        <Text className="mt-1 text-sm text-muted-foreground text-center">
          PDF or Image files (.pdf, .jpg, .png)
        </Text>
      </Pressable>
    </View>
  );
};
