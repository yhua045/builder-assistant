import type {
  SemanticSearchError,
  SemanticSearchRequest,
  SemanticSearchResult,
  SemanticSearchQueryRepository,
} from '../contracts/SemanticSearchContracts';
import type { EmbeddingService } from './EmbeddingRuntimeService';

export interface SemanticSearchService {
  search(request: SemanticSearchRequest): Promise<SemanticSearchResult>;
}

export class DefaultSemanticSearchService implements SemanticSearchService {
  constructor(
    private readonly repository: SemanticSearchQueryRepository,
    private readonly embeddingService: EmbeddingService,
  ) {}

  private toRecoverableError(code: SemanticSearchError['code'], message: string): SemanticSearchError {
    const error = new Error(message) as SemanticSearchError;
    error.code = code;
    error.recoverable = true;
    return error;
  }

  async search(request: SemanticSearchRequest): Promise<SemanticSearchResult> {
    if (!request || typeof request.query !== 'string' || request.query.trim().length === 0) {
      throw this.toRecoverableError('INVALID_QUERY', 'Query text is required');
    }

    try {
      const queryVector = await this.embeddingService.embed(request.query.trim());
      const matches = await this.repository.findNearestMatches(Array.from(queryVector), {
        documentId: request.documentId,
        projectId: request.projectId,
        metadataFilters: request.metadataFilters,
        limit: request.limit,
        threshold: request.threshold,
      });

      return {
        requestId: request.id,
        matches,
        totalMatches: matches.length,
        isEmpty: matches.length === 0,
        modelVersion: this.embeddingService.modelVersion,
        provider: this.embeddingService.provider,
        completedAt: new Date(),
      };
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && 'recoverable' in error) {
        throw error;
      }

      const message = error instanceof Error ? error.message : String(error);
      throw this.toRecoverableError('SEARCH_FAILED', message || 'Semantic search failed');
    }
  }
}
