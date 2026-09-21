import type { KnowledgeEmbeddingRun, KnowledgeEmbeddingRunStatus } from '../entities/KnowledgeEmbeddingRun';

export interface KnowledgeEmbeddingRunRepository {
  create(run: KnowledgeEmbeddingRun): Promise<KnowledgeEmbeddingRun>;
  findByDocumentId(documentId: string): Promise<KnowledgeEmbeddingRun | null>;
  findById(id: string): Promise<KnowledgeEmbeddingRun | null>;
  findByStatus(status: KnowledgeEmbeddingRunStatus): Promise<KnowledgeEmbeddingRun[]>;
  update(id: string, patch: Partial<KnowledgeEmbeddingRun>): Promise<KnowledgeEmbeddingRun>;
}