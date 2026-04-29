import { ReactNativeImageReader } from '../../infrastructure/files/ReactNativeImageReader';

// Mock react-native-fs
jest.mock('react-native-fs', () => ({
  readFile: jest.fn(),
}));

import RNFS from 'react-native-fs';

const mockReadFile = RNFS.readFile as jest.Mock;

afterEach(() => {
  jest.clearAllMocks();
});

describe('ReactNativeImageReader', () => {
  describe('readAsBase64', () => {
    it('returns the base64 string from RNFS', async () => {
      mockReadFile.mockResolvedValueOnce('abc123base64');
      const reader = new ReactNativeImageReader();
      const result = await reader.readAsBase64('file:///path/to/image.jpg');
      expect(result).toBe('abc123base64');
    });

    it('strips file:// prefix before calling RNFS', async () => {
      mockReadFile.mockResolvedValueOnce('someBase64');
      const reader = new ReactNativeImageReader();
      await reader.readAsBase64('file:///path/to/image.jpg');
      expect(mockReadFile).toHaveBeenCalledWith('/path/to/image.jpg', 'base64');
    });

    it('passes URI without file:// prefix unchanged', async () => {
      mockReadFile.mockResolvedValueOnce('someBase64');
      const reader = new ReactNativeImageReader();
      await reader.readAsBase64('/path/to/image.jpg');
      expect(mockReadFile).toHaveBeenCalledWith('/path/to/image.jpg', 'base64');
    });
  });

  describe('getMimeType', () => {
    const reader = new ReactNativeImageReader();

    it('returns image/png for .png URI', () => {
      expect(reader.getMimeType('file:///path/to/image.PNG')).toBe('image/png');
    });

    it('returns image/webp for .webp URI', () => {
      expect(reader.getMimeType('/path/to/image.webp')).toBe('image/webp');
    });

    it('returns image/jpeg for .heic URI', () => {
      expect(reader.getMimeType('/path/to/image.heic')).toBe('image/jpeg');
    });

    it('returns image/jpeg for .heif URI', () => {
      expect(reader.getMimeType('/path/to/image.HEIF')).toBe('image/jpeg');
    });

    it('returns image/jpeg for .jpg URI', () => {
      expect(reader.getMimeType('/path/to/image.jpg')).toBe('image/jpeg');
    });

    it('returns image/jpeg for unknown extension', () => {
      expect(reader.getMimeType('/path/to/image.tiff')).toBe('image/jpeg');
    });
  });
});
