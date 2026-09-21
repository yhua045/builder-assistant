import type { EmbeddingService } from '../services/EmbeddingRuntimeService';
import type { EmbedChunkCommand, EmbedChunkResult, EmbedChunkUseCase } from '../contracts/EmbeddingContracts';

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