import type {
  KnowledgeSearchError,
  KnowledgeSearchMatch,
  KnowledgeSearchRequest,
  KnowledgeSearchResult,
  SearchKnowledgeUseCase,
} from '../contracts/KnowledgeSearchContracts';
import type { KeywordSearchService } from '../services/KeywordSearchService';
import type { SemanticSearchService } from '../services/SemanticSearchService';

function toRecoverableError(code: KnowledgeSearchError['code'], message: string): KnowledgeSearchError {
  const error = new Error(message) as KnowledgeSearchError;
  error.code = code;
  error.recoverable = true;
  return error;
}

function dedupeMatches(matches: KnowledgeSearchMatch[]): KnowledgeSearchMatch[] {
  const seen = new Set<string>();

  return matches.filter((match) => {
    const key = `${match.chunkId}:${match.documentId}:${match.content}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

export class SearchKnowledgeUseCaseImpl implements SearchKnowledgeUseCase {
  constructor(
    private readonly semanticSearchService: SemanticSearchService,
    private readonly keywordSearchService: KeywordSearchService = {
      async search() { return []; },
    },
  ) {}

  async execute(request: KnowledgeSearchRequest): Promise<KnowledgeSearchResult> {
    if (!request || typeof request.query !== 'string' || request.query.trim().length === 0) {
      throw toRecoverableError('INVALID_QUERY', 'Query text is required');
    }

    const normalizedRequest: KnowledgeSearchRequest = {
      ...request,
      query: request.query.trim(),
      limit: request.limit ?? 10,
    };

    const [semanticResult, keywordMatches] = await Promise.allSettled([
      this.semanticSearchService.search(normalizedRequest),
      this.keywordSearchService.search(normalizedRequest),
    ]);

    const semanticMatches = semanticResult.status === 'fulfilled' ? semanticResult.value.matches : [];
    const combinedMatches = dedupeMatches([
      ...semanticMatches,
      ...((keywordMatches.status === 'fulfilled' ? keywordMatches.value : []) as KnowledgeSearchMatch[]),
    ]);

    const sortedMatches = combinedMatches
      .slice()
      .sort((left, right) => (right.score ?? 0) - (left.score ?? 0))
      .slice(0, Math.max(0, normalizedRequest.limit ?? 10));

    if (sortedMatches.length > 0) {
      return {
        requestId: normalizedRequest.id,
        matches: sortedMatches,
        totalMatches: sortedMatches.length,
        isEmpty: false,
        modelVersion: semanticResult.status === 'fulfilled' ? semanticResult.value.modelVersion : undefined,
        provider: semanticResult.status === 'fulfilled' ? semanticResult.value.provider : undefined,
        completedAt: new Date(),
      };
    }

    if (semanticResult.status === 'rejected' && keywordMatches.status === 'rejected') {
      const semanticError = semanticResult.reason as KnowledgeSearchError | undefined;
      const keywordError = keywordMatches.reason as KnowledgeSearchError | undefined;
      throw (semanticError && semanticError.recoverable ? semanticError : keywordError && keywordError.recoverable ? keywordError : toRecoverableError('SEARCH_FAILED', 'Knowledge search failed'));
    }

    if (semanticResult.status === 'rejected' && keywordMatches.status === 'fulfilled') {
      throw semanticResult.reason as KnowledgeSearchError;
    }

    if (keywordMatches.status === 'rejected' && semanticResult.status === 'fulfilled') {
      throw keywordMatches.reason as KnowledgeSearchError;
    }

    return {
      requestId: normalizedRequest.id,
      matches: [],
      totalMatches: 0,
      isEmpty: true,
      modelVersion: semanticResult.status === 'fulfilled' ? semanticResult.value.modelVersion : undefined,
      provider: semanticResult.status === 'fulfilled' ? semanticResult.value.provider : undefined,
      completedAt: new Date(),
    };
  }
}
