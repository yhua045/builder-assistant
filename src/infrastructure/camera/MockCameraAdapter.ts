/**
 * Mock camera adapter for testing
 * Simulates camera capture behavior without requiring device camera
 */

import { ICameraAdapter, CameraOptions, CameraResult } from './ICameraAdapter';

export class MockCameraAdapter implements ICameraAdapter {
  private _hasPermissions: boolean = true;
  private _shouldCancel: boolean = false;
  private _shouldThrowError: boolean = false;
  private _errorMessage: string = 'Camera error';
  private _captureCount: number = 0;

  /**
   * Set whether the mock has permissions
   */
  setHasPermissions(value: boolean): void {
    this._hasPermissions = value;
  }

  /**
   * Set whether the next capture should be cancelled
   */
  setShouldCancel(value: boolean): void {
    this._shouldCancel = value;
  }

  /**
   * Set whether the next capture should throw an error
   */
  setShouldThrowError(value: boolean, message?: string): void {
    this._shouldThrowError = value;
    if (message) {
      this._errorMessage = message;
    }
  }

  /**
   * Get the number of times capturePhoto was called
   */
  getCaptureCount(): number {
    return this._captureCount;
  }

  /**
   * Reset the mock state
   */
  reset(): void {
    this._hasPermissions = true;
    this._shouldCancel = false;
    this._shouldThrowError = false;
    this._errorMessage = 'Camera error';
    this._captureCount = 0;
  }

  async capturePhoto(options?: CameraOptions): Promise<CameraResult> {
    this._captureCount++;

    if (this._shouldThrowError) {
      throw new Error(this._errorMessage);
    }

    if (!this._hasPermissions) {
      throw new Error('Camera permissions not granted');
    }

    if (this._shouldCancel) {
      return {
        uri: '',
        width: 0,
        height: 0,
        fileSize: 0,
        cancelled: true,
      };
    }

    // Return mock successful capture
    const width = options?.maxWidth || 1920;
    const height = options?.maxHeight || 1080;
    
    return {
      uri: 'file:///mock/path/to/receipt.jpg',
      width,
      height,
      fileSize: 524288, // 512KB
      cancelled: false,
    };
  }

  async hasPermissions(): Promise<boolean> {
    return this._hasPermissions;
  }

  async requestPermissions(): Promise<boolean> {
    return this._hasPermissions;
  }
}
