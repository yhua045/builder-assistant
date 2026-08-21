export type DocumentSourceType = 'pdf' | 'image' | 'text' | 'docx';
export type DocumentWorkflowState =
  | 'document_received'
  | 'validation_pending'
  | 'validation_passed'
  | 'validation_failed'
  | 'text_extracted'
  | 'chunking_in_progress'
  | 'completed'
  | 'failed'
  | 'superseded';

export interface DocumentProcessingContext {
  correlationId: string;
  sessionId: string;
  projectId?: string;
  documentId: string;
  documentVersionId: string;
  version: number;
  sourceType: DocumentSourceType;
  originalFileName?: string;
  storageKey?: string;
  mimeType?: string;
  checksum?: string;
  workflowState: DocumentWorkflowState;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}
