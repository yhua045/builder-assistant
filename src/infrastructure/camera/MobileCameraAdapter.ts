/**
 * Mobile camera adapter implementation using react-native-image-picker
 * Provides native camera access for iOS and Android
 */

import { launchCamera, CameraOptions as RNCameraOptions, ImagePickerResponse, Asset } from 'react-native-image-picker';
import { ICameraAdapter, CameraOptions, CameraResult } from './ICameraAdapter';

export class MobileCameraAdapter implements ICameraAdapter {
  async capturePhoto(options?: CameraOptions): Promise<CameraResult> {
    const cameraOptions: RNCameraOptions = {
      mediaType: 'photo',
      maxWidth: options?.maxWidth || 1920,
      maxHeight: options?.maxHeight || 1080,
      quality: (options?.quality as any) || 0.8, // Cast to any to avoid PhotoQuality type mismatch
      saveToPhotos: false, // Don't save to camera roll
      includeBase64: false, // Don't include base64 (large payload)
    };

    const response: ImagePickerResponse = await launchCamera(cameraOptions);

    // Handle user cancellation
    if (response.didCancel) {
      return {
        uri: '',
        width: 0,
        height: 0,
        fileSize: 0,
        cancelled: true,
      };
    }

    // Handle errors
    if (response.errorCode || response.errorMessage) {
      const errorMessage = response.errorMessage || 'Camera error occurred';
      throw new Error(errorMessage);
    }

    // Handle missing assets
    if (!response.assets || response.assets.length === 0) {
      throw new Error('No image captured');
    }

    const asset: Asset = response.assets[0];

    // Validate required fields
    if (!asset.uri) {
      throw new Error('No image URI returned from camera');
    }

    return {
      uri: asset.uri,
      width: asset.width || 0,
      height: asset.height || 0,
      fileSize: asset.fileSize || 0,
      cancelled: false,
    };
  }

  async hasPermissions(): Promise<boolean> {
    // react-native-image-picker handles permissions internally
    // When launchCamera is called, it will automatically request permissions
    // This method is kept for interface compliance
    return true;
  }

  async requestPermissions(): Promise<boolean> {
    // react-native-image-picker handles permissions internally
    // Permissions are requested automatically when launchCamera is called
    // This method is kept for interface compliance
    return true;
  }
}
