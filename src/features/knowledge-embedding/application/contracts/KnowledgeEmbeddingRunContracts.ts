import type { KnowledgeEmbeddingRun, KnowledgeEmbeddingRunStage, KnowledgeEmbeddingRunStatus } from '../../domain/entities/KnowledgeEmbeddingRun';

export interface KnowledgeEmbeddingRunDocumentMetadata {
  name: string;
  type: string;
  size: string;
  uri?: string;
  storageKey?: string;
  localPath?: string;
  contentHash?: string;
}

export interface AddKnowledgeEmbeddingDocumentCommand {
  documentId: string;
  documentVersion: number;
  metadata: KnowledgeEmbeddingRunDocumentMetadata;
}

export interface KnowledgeEmbeddingRunView extends KnowledgeEmbeddingRun {
  documentVersion: number;
  metadata: KnowledgeEmbeddingRunDocumentMetadata;
  retryCount: number;
  checkpointId?: string;
  resumeFromCheckpoint: boolean;
}

export interface KnowledgeEmbeddingDocumentMutationResult {
  run: KnowledgeEmbeddingRunView;
  alreadyHandled: boolean;
}

export interface KnowledgeEmbeddingDocumentError {
  code: string;
  message: string;
  retryable: boolean;
}

export interface KnowledgeEmbeddingDocumentService {
  listDocuments(): Promise<KnowledgeEmbeddingRunView[]>;
  addDocument(command: AddKnowledgeEmbeddingDocumentCommand): Promise<KnowledgeEmbeddingDocumentMutationResult>;
  removeDocument(documentId: string, documentVersion: number): Promise<void>;
  updateStatus(
    runId: string,
    status: KnowledgeEmbeddingRunStatus,
    stage?: KnowledgeEmbeddingRunStage,
    error?: KnowledgeEmbeddingDocumentError,
  ): Promise<KnowledgeEmbeddingRunView>;
  retryDocument(documentId: string, documentVersion: number): Promise<KnowledgeEmbeddingRunView>;
  restoreAndResume(): Promise<KnowledgeEmbeddingRunView[]>;
}

export class KnowledgeEmbeddingDocumentPersistenceError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(error: KnowledgeEmbeddingDocumentError) {
    super(error.message);
    this.name = 'KnowledgeEmbeddingDocumentPersistenceError';
    this.code = error.code;
    this.retryable = error.retryable;
  }
}
