import type { EmbeddingService } from '../services/EmbeddingRuntimeService';

export type EmbeddingWorkflowState =
  | 'chunk-received'
  | 'validation-failed'
  | 'embedding-succeeded'
  | 'embedding-failed';

export interface EmbeddingSearchQuery {
  text: string;
  dimension: number;
  provider?: string;
  modelVersion?: string;
}

export interface EmbedChunkCommand {
  documentId: string;
  documentVersion: number;
  chunkId: string;
  text: string;
}

export interface EmbedChunkResult {
  chunkId: string;
  status: 'embedded' | 'duplicate' | 'failed';
  vector?: number[];
  provider?: string;
  modelVersion?: string;
  error?: string;
}

export interface EmbedChunkUseCase {
  execute(input: EmbedChunkCommand): Promise<EmbedChunkResult>;
}

export interface QueryEmbeddingUseCase {
  execute(input: EmbeddingSearchQuery): Promise<Float32Array>;
}

export class EmbedChunkUseCaseImpl implements EmbedChunkUseCase {
  private readonly processedChunkIds = new Set<string>();

  constructor(private readonly embeddingService: EmbeddingService) {}

  async execute(input: EmbedChunkCommand): Promise<EmbedChunkResult> {
    const normalizedText = input.text?.trim() ?? '';

    if (!normalizedText) {
      throw new Error('Chunk text is required');
    }

    if (!input.chunkId || !input.chunkId.trim()) {
      throw new Error('Chunk id is required');
    }

    if (this.processedChunkIds.has(input.chunkId)) {
      return {
        chunkId: input.chunkId,
        status: 'duplicate',
        provider: this.embeddingService.provider,
        modelVersion: this.embeddingService.modelVersion,
      };
    }

    try {
      const vector = await this.embeddingService.embed(normalizedText);
      this.processedChunkIds.add(input.chunkId);

      return {
        chunkId: input.chunkId,
        status: 'embedded',
        vector: Array.from(vector),
        provider: this.embeddingService.provider,
        modelVersion: this.embeddingService.modelVersion,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Embedding failed: ${message}`);
    }
  }
}

export class QueryEmbeddingUseCaseImpl implements QueryEmbeddingUseCase {
  constructor(private readonly embeddingService: EmbeddingService) {}

  async execute(input: EmbeddingSearchQuery): Promise<Float32Array> {
    const normalizedText = input.text?.trim() ?? '';

    if (!normalizedText) {
      throw new Error('Query text is required');
    }

    if (input.dimension <= 0 || !Number.isInteger(input.dimension)) {
      throw new Error('Dimension must be a positive integer');
    }

    const vector = await this.embeddingService.embed(normalizedText);

    if (vector.length !== input.dimension) {
      throw new Error('The query dimension does not match the configured embedding dimension');
    }

    if (input.provider && input.provider !== this.embeddingService.provider) {
      throw new Error('The query provider does not match the configured embedding provider');
    }

    if (input.modelVersion && input.modelVersion !== this.embeddingService.modelVersion) {
      throw new Error('The query model version does not match the configured embedding model');
    }

    return vector;
  }
}
