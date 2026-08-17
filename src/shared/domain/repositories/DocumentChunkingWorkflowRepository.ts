export interface DocumentChunkingWorkflowRecord {
  id: string;
  documentId: string;
  documentVersion: number;
  projectId?: string;
  status: string;
  workflowState: string;
  checkpointId?: string;
  lastEvent?: string;
  retryCount: number;
  circuitOpen: boolean;
  supportedForAnalysis?: boolean;
  validationReason?: string;
  isAlreadyAnalyzed?: boolean;
  resumeFromCheckpoint?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface DocumentChunkingWorkflowRepository {
  upsert(record: DocumentChunkingWorkflowRecord): Promise<void>;
  findByDocumentVersion(documentId: string, version: number): Promise<DocumentChunkingWorkflowRecord | null>;
  findLatestByDocumentId(documentId: string): Promise<DocumentChunkingWorkflowRecord | null>;
  findByStatus(status: string): Promise<DocumentChunkingWorkflowRecord[]>;
}
