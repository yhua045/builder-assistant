import type { EmbeddingService } from '../../../embedding/application/services/EmbeddingRuntimeService';
import type { EmbeddingSearchQuery, QueryEmbeddingUseCase as QueryEmbeddingUseCaseContract } from '../contracts/QueryEmbeddingContracts';

export class QueryEmbeddingUseCaseImpl implements QueryEmbeddingUseCaseContract {
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