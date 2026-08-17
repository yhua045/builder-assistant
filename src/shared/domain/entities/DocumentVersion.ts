export type DocumentVersionStatus =
  | 'received'
  | 'validated'
  | 'extracted'
  | 'chunked'
  | 'persisted'
  | 'failed'
  | 'superseded';

export type DocumentVersionWorkflowState =
  | 'idle'
  | 'document_received'
  | 'validation_pending'
  | 'text_extracted'
  | 'chunking_in_progress'
  | 'chunking_complete'
  | 'persisting_chunks'
  | 'completed'
  | 'failed'
  | 'superseded';

export type DocumentVersionSourceType = 'pdf' | 'image' | 'text' | 'docx';
export type DocumentValidationStatus = 'pending' | 'passed' | 'failed';
export type DocumentRejectionCode =
  | 'unsupported_file_type'
  | 'empty_document'
  | 'cannot_read_file'
  | 'document_too_large';

export interface DocumentVersion {
  id: string;
  documentId: string;
  projectId?: string;
  version: number;
  status: DocumentVersionStatus;
  workflowState: DocumentVersionWorkflowState;
  sourceType?: DocumentVersionSourceType;
  supportedForAnalysis?: boolean;
  validationStatus?: DocumentValidationStatus;
  validationReason?: string;
  rejectionCode?: DocumentRejectionCode;
  validatedAt?: Date;
  lastEvent?: string;
  retryCount?: number;
  circuitOpen?: boolean;
  lastError?: string;
  createdAt: Date;
  updatedAt?: Date;
  completedAt?: Date;
}

export class DocumentVersionEntity {
  private constructor(private readonly version: DocumentVersion) {}

  static create(payload: Omit<DocumentVersion, 'createdAt' | 'updatedAt'> & { createdAt?: Date; updatedAt?: Date }): DocumentVersionEntity {
    const now = new Date();
    const normalized: DocumentVersion = {
      ...payload,
      version: payload.version ?? 1,
      status: payload.status ?? 'received',
      workflowState: payload.workflowState ?? 'document_received',
      retryCount: payload.retryCount ?? 0,
      circuitOpen: payload.circuitOpen ?? false,
      createdAt: payload.createdAt ?? now,
      updatedAt: payload.updatedAt ?? now,
    };

    DocumentVersionEntity.validate(normalized);
    return new DocumentVersionEntity(normalized);
  }

  static fromData(version: DocumentVersion): DocumentVersionEntity {
    DocumentVersionEntity.validate(version);
    return new DocumentVersionEntity({ ...version });
  }

  data(): DocumentVersion {
    return { ...this.version };
  }

  private static validate(version: DocumentVersion): void {
    if (!version.id || version.id.trim().length === 0) {
      throw new Error('DocumentVersion id is required');
    }
    if (!version.documentId || version.documentId.trim().length === 0) {
      throw new Error('DocumentVersion documentId is required');
    }
    if (version.version < 1) {
      throw new Error('DocumentVersion version must be >= 1');
    }
    if (!version.createdAt || Number.isNaN(version.createdAt.getTime())) {
      throw new Error('DocumentVersion createdAt is required');
    }
    if (version.retryCount !== undefined && version.retryCount < 0) {
      throw new Error('DocumentVersion retryCount cannot be negative');
    }
  }
}
