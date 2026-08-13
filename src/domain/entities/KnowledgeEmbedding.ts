export interface KnowledgeEmbedding {
  id: string;
  chunkId: string;
  vector: number[];
  dimension: number;
  provider?: string;
  modelVersion?: string;
  createdAt: Date;
  fingerprint?: string;
}

export class KnowledgeEmbeddingEntity {
  private constructor(private readonly embedding: KnowledgeEmbedding) {}

  static create(payload: KnowledgeEmbedding): KnowledgeEmbeddingEntity {
    KnowledgeEmbeddingEntity.validate(payload);
    return new KnowledgeEmbeddingEntity({ ...payload });
  }

  static fromData(embedding: KnowledgeEmbedding): KnowledgeEmbeddingEntity {
    KnowledgeEmbeddingEntity.validate(embedding);
    return new KnowledgeEmbeddingEntity({ ...embedding });
  }

  data(): KnowledgeEmbedding {
    return { ...this.embedding };
  }

  private static validate(embedding: KnowledgeEmbedding): void {
    if (!embedding.id || embedding.id.trim().length === 0) {
      throw new Error('KnowledgeEmbedding id is required');
    }
    if (!embedding.chunkId || embedding.chunkId.trim().length === 0) {
      throw new Error('KnowledgeEmbedding chunkId is required');
    }
    if (!Array.isArray(embedding.vector) || embedding.vector.length === 0) {
      throw new Error('KnowledgeEmbedding vector is required');
    }
    if (!embedding.vector.every(value => Number.isFinite(value))) {
      throw new Error('KnowledgeEmbedding vector values must be finite numbers');
    }
    if (embedding.dimension !== embedding.vector.length) {
      throw new Error('KnowledgeEmbedding.dimension must match vector length');
    }
    if (!embedding.createdAt || Number.isNaN(embedding.createdAt.getTime())) {
      throw new Error('KnowledgeEmbedding createdAt is required');
    }
  }
}
