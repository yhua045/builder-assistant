export interface KnowledgeChunk {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  tokenCount?: number;
  startOffset?: number;
  endOffset?: number;
  metadata?: Record<string, unknown>;
}

export class KnowledgeChunkEntity {
  private constructor(private readonly chunk: KnowledgeChunk) {}

  static create(payload: KnowledgeChunk): KnowledgeChunkEntity {
    KnowledgeChunkEntity.validate(payload);
    return new KnowledgeChunkEntity({ ...payload });
  }

  static fromData(chunk: KnowledgeChunk): KnowledgeChunkEntity {
    KnowledgeChunkEntity.validate(chunk);
    return new KnowledgeChunkEntity({ ...chunk });
  }

  data(): KnowledgeChunk {
    return { ...this.chunk };
  }

  private static validate(chunk: KnowledgeChunk): void {
    if (!chunk.id || chunk.id.trim().length === 0) {
      throw new Error('KnowledgeChunk id is required');
    }
    if (!chunk.documentId || chunk.documentId.trim().length === 0) {
      throw new Error('KnowledgeChunk documentId is required');
    }
    if (!chunk.content || chunk.content.trim().length === 0) {
      throw new Error('KnowledgeChunk content is required');
    }
  }
}
