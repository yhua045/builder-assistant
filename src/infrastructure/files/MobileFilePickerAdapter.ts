/**
 * Mobile implementation of IFilePickerAdapter using react-native-document-picker
 * Provides document selection capabilities for iOS and Android platforms
 */

import DocumentPicker from 'react-native-document-picker';
import { IFilePickerAdapter, FilePickerResult } from './IFilePickerAdapter';

export class MobileFilePickerAdapter implements IFilePickerAdapter {
  async pickDocument(): Promise<FilePickerResult> {
    try {
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.pdf],
        copyTo: 'cachesDirectory', // Copy to app cache to ensure access
      });

      // DocumentPicker returns an array, take first result
      const file = Array.isArray(result) ? result[0] : result;

      if (!file) {
        return { cancelled: true };
      }

      return {
        cancelled: false,
        uri: file.fileCopyUri || file.uri, // Prefer copied URI for reliable access
        name: file.name || undefined,
        size: file.size || undefined,
        type: file.type || undefined,
      };
    } catch (err: any) {
      // User cancelled the picker
      if (DocumentPicker.isCancel(err)) {
        return { cancelled: true };
      }

      // Re-throw other errors
      throw err;
    }
  }
}
