/**
 * File validation utilities for invoice document uploads (PDF or images)
 */

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB in bytes

const SUPPORTED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
];

/**
 * Validate invoice document file type (PDF or image) and size.
 * @param mimeType - MIME type of the file
 * @param size - File size in bytes
 * @returns Validation result with error message if invalid
 */
export function validatePdfFile(mimeType?: string, size?: number): FileValidationResult {
  // Check MIME type
  const normalised = (mimeType ?? '').toLowerCase();
  const isSupported =
    SUPPORTED_MIME_TYPES.some(t => normalised === t) ||
    normalised.startsWith('image/');

  if (!normalised || !isSupported) {
    return {
      isValid: false,
      error: 'Please select a PDF or image file',
    };
  }

  // Check file size
  if (!size || size > MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: 'File must be under 20MB',
    };
  }

  return { isValid: true };
}
