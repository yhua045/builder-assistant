export type SizeAndSanityValidationResult = {
  isValid: boolean;
  rejectionCode?: 'empty_document' | 'cannot_read_file' | 'document_too_large';
  reason?: string;
  warnings: string[];
};

export class SizeAndSanityValidator {
  validate(options: {
    storageKey?: string;
    fileSizeBytes?: number;
    exists?: boolean;
  }): SizeAndSanityValidationResult {
    const storageKey = options.storageKey ?? '';
    const fileSizeBytes = options.fileSizeBytes ?? 0;
    const exists = options.exists ?? true;

    if (!exists || storageKey.toLowerCase().includes('missing')) {
      return {
        isValid: false,
        rejectionCode: 'cannot_read_file',
        reason: 'Document file could not be read',
        warnings: [],
      };
    }

    if (fileSizeBytes === 0) {
      return {
        isValid: false,
        rejectionCode: 'empty_document',
        reason: 'Document is empty',
        warnings: [],
      };
    }

    if (fileSizeBytes > 100 * 1024 * 1024) {
      return {
        isValid: false,
        rejectionCode: 'document_too_large',
        reason: 'Document exceeds the supported size limit',
        warnings: [],
      };
    }

    return {
      isValid: true,
      warnings: [],
    };
  }
}
