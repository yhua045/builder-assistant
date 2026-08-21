import type { DocumentVersion } from '../../../../shared/domain/entities/DocumentVersion';
import type { DocumentProcessingContext } from '../context/DocumentProcessingContext';

export type DocumentValidationStatus = 'pending' | 'passed' | 'failed';

export interface DocumentValidationResult {
  documentId: string;
  documentVersionId: string;
  version: number;
  isSupported: boolean;
  status: 'passed' | 'failed';
  validationStatus: 'passed' | 'failed';
  rejectionCode?: string;
  reason?: string;
  warnings: string[];
  updatedVersion: DocumentVersion;
}

export interface DocumentValidationService {
  validate(context: DocumentProcessingContext): Promise<DocumentValidationResult>;
}
