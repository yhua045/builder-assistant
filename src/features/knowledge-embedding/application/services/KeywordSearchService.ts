import type {
  KnowledgeSearchMatch,
  KnowledgeSearchRequest,
} from '../contracts/KnowledgeSearchContracts';

export interface KeywordSearchService {
  search(request: KnowledgeSearchRequest): Promise<KnowledgeSearchMatch[]>;
}

export class DefaultKeywordSearchService implements KeywordSearchService {
  async search(_request: KnowledgeSearchRequest): Promise<KnowledgeSearchMatch[]> {
    return [];
  }
}
