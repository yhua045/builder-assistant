/**
 * Application-level port for camera capture.
 * Mirrors the infrastructure ICameraAdapter shape so infrastructure adapters
 * satisfy this interface structurally (TypeScript structural typing).
 */

export type CaptureResult = {
  uri: string;
  width: number;
  height: number;
  fileSize: number;
  cancelled: boolean;
};

export interface ICameraService {
  capturePhoto(options?: {
    quality?: number;
    maxWidth?: number;
    maxHeight?: number;
  }): Promise<CaptureResult>;
}
