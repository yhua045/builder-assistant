import type { DocumentSourceType } from '../../domain/context/DocumentProcessingContext';

export type FileTypeValidationResult = {
  isSupported: boolean;
  rejectionCode?: 'unsupported_file_type';
  reason?: string;
  warnings: string[];
};

export class FileTypeValidator {
  validate(sourceType: DocumentSourceType, mimeType?: string, storageKey?: string): FileTypeValidationResult {
    const normalizedMime = (mimeType ?? '').toLowerCase();
    const extension = (storageKey ?? '').split('.').pop()?.toLowerCase() ?? '';

    const isPdf = sourceType === 'pdf' && (normalizedMime.includes('pdf') || extension === 'pdf');
    const isImage = sourceType === 'image' && (
      normalizedMime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(extension)
    );
    const isDocx = sourceType === 'docx' && (
      normalizedMime.includes('word') || normalizedMime.includes('docx') || extension === 'docx'
    );
    const isText = sourceType === 'text' && (
      normalizedMime.startsWith('text/') || ['txt', 'md'].includes(extension)
    );

    const isCsv = extension === 'csv' || normalizedMime === 'text/csv';
    const isSupported = (isPdf || isImage || isDocx || isText) && !isCsv;

    if (isCsv) {
      return {
        isSupported: false,
        rejectionCode: 'unsupported_file_type',
        reason: 'Unsupported document type for local analysis',
        warnings: [],
      };
    }

    if (!isSupported) {
      return {
        isSupported: false,
        rejectionCode: 'unsupported_file_type',
        reason: 'Unsupported document type for local analysis',
        warnings: [],
      };
    }

    return {
      isSupported: true,
      warnings: [],
    };
  }
}
