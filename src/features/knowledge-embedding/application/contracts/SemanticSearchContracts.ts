import type {
  KnowledgeSearchError,
  KnowledgeSearchErrorCode,
  KnowledgeSearchMatch,
  KnowledgeSearchRequest,
  KnowledgeSearchResult,
  SearchKnowledgeUseCase as BaseSearchKnowledgeUseCase,
} from './KnowledgeSearchContracts';

export type SemanticSearchErrorCode = KnowledgeSearchErrorCode;
export type SemanticSearchRequest = KnowledgeSearchRequest;
export type SemanticSearchMatch = KnowledgeSearchMatch;
export type SemanticSearchResult = KnowledgeSearchResult;
export type SemanticSearchError = KnowledgeSearchError;
export type SearchKnowledgeUseCase = BaseSearchKnowledgeUseCase;

export interface SemanticSearchQueryRepository {
  findNearestMatches(
    queryVector: number[],
    options: {
      documentId?: string;
      projectId?: string;
      metadataFilters?: Record<string, string | number | boolean | null>;
      limit?: number;
      threshold?: number;
    },
  ): Promise<SemanticSearchMatch[]>;
}
