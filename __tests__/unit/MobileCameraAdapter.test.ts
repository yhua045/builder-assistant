/**
 * Unit tests for MobileCameraAdapter
 * Tests camera capture functionality with mocked react-native-image-picker
 */

import { MobileCameraAdapter } from '../../src/infrastructure/camera/MobileCameraAdapter';
import * as ImagePicker from 'react-native-image-picker';

// Mock react-native-image-picker
jest.mock('react-native-image-picker', () => ({
  launchCamera: jest.fn(),
  CameraOptions: {},
  ImagePickerResponse: {},
  Asset: {},
}));

describe('MobileCameraAdapter', () => {
  let adapter: MobileCameraAdapter;
  let mockLaunchCamera: jest.MockedFunction<typeof ImagePicker.launchCamera>;

  beforeEach(() => {
    adapter = new MobileCameraAdapter();
    mockLaunchCamera = ImagePicker.launchCamera as jest.MockedFunction<typeof ImagePicker.launchCamera>;
    mockLaunchCamera.mockClear();
  });

  describe('capturePhoto', () => {
    it('should return captured photo with URI on success', async () => {
      // Arrange
      const mockResponse: ImagePicker.ImagePickerResponse = {
        assets: [
          {
            uri: 'file:///path/to/photo.jpg',
            width: 1920,
            height: 1080,
            fileSize: 524288,
          },
        ],
      };
      mockLaunchCamera.mockResolvedValue(mockResponse);

      // Act
      const result = await adapter.capturePhoto();

      // Assert
      expect(result).toEqual({
        uri: 'file:///path/to/photo.jpg',
        width: 1920,
        height: 1080,
        fileSize: 524288,
        cancelled: false,
      });
      expect(mockLaunchCamera).toHaveBeenCalledTimes(1);
    });

    it('should pass camera options to launchCamera', async () => {
      // Arrange
      const mockResponse: ImagePicker.ImagePickerResponse = {
        assets: [
          {
            uri: 'file:///path/to/photo.jpg',
            width: 1024,
            height: 768,
            fileSize: 262144,
          },
        ],
      };
      mockLaunchCamera.mockResolvedValue(mockResponse);

      const options = {
        maxWidth: 1024,
        maxHeight: 768,
        quality: 0.8,
      };

      // Act
      await adapter.capturePhoto(options);

      // Assert
      expect(mockLaunchCamera).toHaveBeenCalledWith(
        expect.objectContaining({
          mediaType: 'photo',
          maxWidth: 1024,
          maxHeight: 768,
          quality: 0.8,
        })
      );
    });

    it('should return cancelled=true when user cancels', async () => {
      // Arrange
      const mockResponse: ImagePicker.ImagePickerResponse = {
        didCancel: true,
      };
      mockLaunchCamera.mockResolvedValue(mockResponse);

      // Act
      const result = await adapter.capturePhoto();

      // Assert
      expect(result).toEqual({
        uri: '',
        width: 0,
        height: 0,
        fileSize: 0,
        cancelled: true,
      });
    });

    it('should throw error when permissions denied', async () => {
      // Arrange
      const mockResponse: ImagePicker.ImagePickerResponse = {
        errorCode: 'camera_unavailable',
        errorMessage: 'Camera permission denied',
      };
      mockLaunchCamera.mockResolvedValue(mockResponse);

      // Act & Assert
      await expect(adapter.capturePhoto()).rejects.toThrow('Camera permission denied');
    });

    it('should throw error when no assets returned', async () => {
      // Arrange
      const mockResponse: ImagePicker.ImagePickerResponse = {
        assets: [],
      };
      mockLaunchCamera.mockResolvedValue(mockResponse);

      // Act & Assert
      await expect(adapter.capturePhoto()).rejects.toThrow('No image captured');
    });

    it('should throw error when camera unavailable', async () => {
      // Arrange
      const mockResponse: ImagePicker.ImagePickerResponse = {
        errorCode: 'camera_unavailable',
        errorMessage: 'Camera not available',
      };
      mockLaunchCamera.mockResolvedValue(mockResponse);

      // Act & Assert
      await expect(adapter.capturePhoto()).rejects.toThrow('Camera not available');
    });

    it('should use default options when none provided', async () => {
      // Arrange
      const mockResponse: ImagePicker.ImagePickerResponse = {
        assets: [
          {
            uri: 'file:///path/to/photo.jpg',
            width: 1920,
            height: 1080,
            fileSize: 524288,
          },
        ],
      };
      mockLaunchCamera.mockResolvedValue(mockResponse);

      // Act
      await adapter.capturePhoto();

      // Assert
      expect(mockLaunchCamera).toHaveBeenCalledWith(
        expect.objectContaining({
          mediaType: 'photo',
          maxWidth: 1920,
          maxHeight: 1080,
          quality: 0.8,
        })
      );
    });
  });

  describe('hasPermissions', () => {
    it('should check camera permissions', async () => {
      // Note: react-native-image-picker doesn't expose permission check API
      // This is handled implicitly by launchCamera
      // For now, we'll always return true and handle errors in capturePhoto
      const result = await adapter.hasPermissions();
      expect(result).toBe(true);
    });
  });

  describe('requestPermissions', () => {
    it('should request camera permissions', async () => {
      // Note: react-native-image-picker doesn't expose permission request API
      // Permissions are requested automatically when calling launchCamera
      const result = await adapter.requestPermissions();
      expect(result).toBe(true);
    });
  });
});
