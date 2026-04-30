import RNFS from 'react-native-fs';
import { IImageReader } from '../../application/services/IImageReader';

export class ReactNativeImageReader implements IImageReader {
  async readAsBase64(imageUri: string): Promise<string> {
    const cleanUri = imageUri.replace(/^file:\/\//, '');
    return RNFS.readFile(cleanUri, 'base64');
  }

  getMimeType(imageUri: string): string {
    const lower = imageUri.toLowerCase();
    if (lower.endsWith('.png')) return 'image/png';
    if (lower.endsWith('.webp')) return 'image/webp';
    if (lower.match(/\.(heic|heif)$/)) return 'image/jpeg'; // iOS HEIC re-encoded
    return 'image/jpeg';
  }
}
