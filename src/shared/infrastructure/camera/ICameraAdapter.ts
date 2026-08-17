/**
 * Camera adapter interface for capturing photos
 * Used for receipt scanning and document capture
 */

export interface CameraOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0-1, where 1 is highest quality
}

export interface CameraResult {
  uri: string;        // File URI or path to captured image
  width: number;      // Image width in pixels
  height: number;     // Image height in pixels
  fileSize: number;   // File size in bytes
  cancelled: boolean; // True if user cancelled capture
}

export interface ICameraAdapter {
  /**
   * Launch device camera to capture photo
   * @param options - Optional camera settings (resolution, quality)
   * @returns CameraResult with file URI or cancelled flag
   * @throws Error if permissions denied or camera unavailable
   */
  capturePhoto(options?: CameraOptions): Promise<CameraResult>;
  
  /**
   * Check if camera permissions are granted
   * @returns true if permissions granted, false otherwise
   */
  hasPermissions(): Promise<boolean>;
  
  /**
   * Request camera permissions from user
   * @returns true if granted, false if denied
   */
  requestPermissions(): Promise<boolean>;
}
