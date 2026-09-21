export type KnowledgeSearchErrorCode =
  | 'INVALID_QUERY'
  | 'VECTOR_STORE_UNAVAILABLE'
  | 'EMBEDDING_UNAVAILABLE'
  | 'SEARCH_FAILED';

export interface KnowledgeSearchRequest {
  id: string;
  query: string;
  documentId?: string;
  projectId?: string;
  metadataFilters?: Record<string, string | number | boolean | null>;
  limit?: number;
  threshold?: number;
  requestContext?: {
    startedAt: Date;
    traceId?: string;
  };
}

export interface KnowledgeSearchMatch {
  chunkId: string;
  documentId: string;
  documentVersion: number;
  content: string;
  score: number;
  metadata?: Record<string, unknown>;
  source?: {
    page?: number;
    sectionHint?: string;
    startOffset?: number;
    endOffset?: number;
  };
}

export interface KnowledgeSearchResult {
  requestId: string;
  matches: KnowledgeSearchMatch[];
  totalMatches: number;
  isEmpty: boolean;
  modelVersion?: string;
  provider?: string;
  completedAt: Date;
}

export interface KnowledgeSearchError extends Error {
  code: KnowledgeSearchErrorCode;
  recoverable: boolean;
}

export interface SearchKnowledgeUseCase {
  execute(request: KnowledgeSearchRequest): Promise<KnowledgeSearchResult>;
}
