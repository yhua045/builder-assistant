export interface KnowledgeChunk {
  id: string;
  documentId: string;
  documentVersion?: number;
  projectId?: string;
  content: string;
  chunkIndex: number;
  documentType?: string;
  tokenCount?: number;
  wordCount?: number;
  charCount?: number;
  startOffset?: number;
  endOffset?: number;
  isOutdated?: boolean;
  isSuperseded?: boolean;
  supersededByChunkId?: string;
  supersededAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
  metadata?: Record<string, unknown>;
}

export class KnowledgeChunkEntity {
  private constructor(private readonly chunk: KnowledgeChunk) {}

  static create(payload: KnowledgeChunk): KnowledgeChunkEntity {
    const normalized: KnowledgeChunk = {
      ...payload,
      documentVersion: payload.documentVersion ?? 1,
      isOutdated: payload.isOutdated ?? false,
      isSuperseded: payload.isSuperseded ?? false,
      createdAt: payload.createdAt ?? new Date(),
      updatedAt: payload.updatedAt ?? payload.createdAt ?? new Date(),
    };

    KnowledgeChunkEntity.validate(normalized);
    return new KnowledgeChunkEntity(normalized);
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
    if (chunk.documentVersion !== undefined && chunk.documentVersion < 1) {
      throw new Error('KnowledgeChunk documentVersion must be >= 1');
    }
    if (!chunk.content || chunk.content.trim().length === 0) {
      throw new Error('KnowledgeChunk content is required');
    }
  }
}
