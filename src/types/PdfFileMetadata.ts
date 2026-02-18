/**
 * PDF file metadata for invoice document uploads
 * This metadata is cached in memory during the upload flow
 * and saved to the database only when the user submits the invoice form
 */
export interface PdfFileMetadata {
  uri: string;         // File URI in app private storage (after copying from picker)
  originalUri: string; // Original URI from picker (for reference)
  name: string;        // Original filename
  size: number;        // File size in bytes
  mimeType?: string;   // MIME type (application/pdf)
}
