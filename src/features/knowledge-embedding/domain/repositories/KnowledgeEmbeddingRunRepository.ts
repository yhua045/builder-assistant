import type { KnowledgeEmbeddingRun } from '../entities/KnowledgeEmbeddingRun';

export interface KnowledgeEmbeddingRunRepository {
  create(run: KnowledgeEmbeddingRun): Promise<KnowledgeEmbeddingRun>;
  findByDocumentId(documentId: string): Promise<KnowledgeEmbeddingRun | null>;
  findById(id: string): Promise<KnowledgeEmbeddingRun | null>;
  update(id: string, patch: Partial<KnowledgeEmbeddingRun>): Promise<KnowledgeEmbeddingRun>;
}
