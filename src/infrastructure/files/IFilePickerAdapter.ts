/**
 * File picker adapter interface for document selection
 * Abstracts platform-specific file picking implementations
 */

export interface FilePickerResult {
  cancelled: boolean;
  uri?: string;         // File URI
  name?: string;        // Original filename
  size?: number;        // File size in bytes
  type?: string;        // MIME type
}

export interface IFilePickerAdapter {
  /**
   * Opens a file picker for documents (PDFs)
   * @returns FilePickerResult with file details or cancellation status
   */
  pickDocument(): Promise<FilePickerResult>;
}
