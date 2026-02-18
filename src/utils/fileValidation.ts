/**
 * File validation utilities for invoice PDF uploads
 */

export interface FileValidationResult {
  isValid: boolean;
  error?: string;
}

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB in bytes

/**
 * Validate PDF file type and size
 * @param mimeType - MIME type of the file
 * @param size - File size in bytes
 * @returns Validation result with error message if invalid
 */
export function validatePdfFile(mimeType?: string, size?: number): FileValidationResult {
  // Check MIME type
  if (!mimeType || !mimeType.includes('pdf')) {
    return {
      isValid: false,
      error: 'Please select a PDF file',
    };
  }

  // Check file size
  if (!size || size > MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: 'PDF must be under 20MB',
    };
  }

  return { isValid: true };
}
