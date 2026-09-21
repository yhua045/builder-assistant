import { LocalEmbeddingService } from '../../embedding/application/services/EmbeddingRuntimeService';
import { DefaultKeywordSearchService } from '../../retrieval/application/services/KeywordSearchService';
import { DefaultSemanticSearchService } from '../../retrieval/application/services/SemanticSearchService';
import type {
  KnowledgeSearchRequest,
  KnowledgeSearchResult,
} from '../../retrieval/application/contracts/KnowledgeSearchContracts';
import type { SemanticSearchQueryRepository } from '../../retrieval/application/contracts/SemanticSearchContracts';
import { SearchKnowledgeUseCaseImpl } from '../../retrieval/application/usecases/SearchKnowledgeUseCase';

describe('SearchKnowledgeUseCase (red)', () => {
  const repository: SemanticSearchQueryRepository = {
    async findNearestMatches() {
      return [
        {
          chunkId: 'chunk-1',
          documentId: 'doc-1',
          documentVersion: 1,
          content: 'Budget approval timeline for the renovation project.',
          score: 0.94,
          metadata: { sectionHint: 'budget' },
        },
      ];
    },
  };

  const embedder = new LocalEmbeddingService({
    provider: 'local-search-test',
    modelVersion: 'semantic-search-test-v1',
    dimension: 4,
  });

  const keywordSearchService = new DefaultKeywordSearchService();

  it('merges semantic and keyword candidates into a single ranked result list', async () => {
    const semanticService = new DefaultSemanticSearchService(repository, embedder);
    const keywordService = {
      async search() {
        return [
          {
            chunkId: 'chunk-2',
            documentId: 'doc-1',
            documentVersion: 1,
            content: 'Budget variance notes for the renovation estimate.',
            score: 0.82,
            metadata: { sectionHint: 'variance' },
          },
        ];
      },
    };

    const useCase = new SearchKnowledgeUseCaseImpl(semanticService, keywordService as any);
    const result: KnowledgeSearchResult = await useCase.execute({
      id: 'search-hybrid-1',
      query: 'budget approval timeline for renovation',
      documentId: 'doc-1',
      limit: 5,
      threshold: 0.5,
    });

    expect(result.isEmpty).toBe(false);
    expect(result.matches).toHaveLength(2);
    expect(result.matches.map((match) => match.content)).toEqual(
      expect.arrayContaining([
        'Budget approval timeline for the renovation project.',
        'Budget variance notes for the renovation estimate.',
      ]),
    );
  });

  it('returns keyword-only hits when the semantic branch has no matches', async () => {
    const emptyRepository: SemanticSearchQueryRepository = {
      async findNearestMatches() {
        return [];
      },
    };

    const semanticService = new DefaultSemanticSearchService(emptyRepository, embedder);
    const keywordService = {
      async search() {
        return [
          {
            chunkId: 'chunk-2',
            documentId: 'doc-1',
            documentVersion: 1,
            content: 'Budget variance notes for the renovation estimate.',
            score: 0.83,
            metadata: { sectionHint: 'variance' },
          },
        ];
      },
    };

    const useCase = new SearchKnowledgeUseCaseImpl(semanticService, keywordService as any);
    const result = await useCase.execute({
      id: 'search-keyword-fallback',
      query: 'variance renovation estimate',
      limit: 5,
    });

    expect(result.isEmpty).toBe(false);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]?.content).toContain('Budget variance');
  });

  it('rejects empty queries before any retrieval branch starts', async () => {
    const semanticService = new DefaultSemanticSearchService(repository, embedder);
    const useCase = new SearchKnowledgeUseCaseImpl(semanticService, keywordSearchService);

    await expect(
      useCase.execute({
        id: 'search-invalid',
        query: '   ',
      }),
    ).rejects.toMatchObject({
      code: 'INVALID_QUERY',
      recoverable: true,
    });
  });

  it('fails with a recoverable error when both retrieval branches are unavailable', async () => {
    const failingSemantic = {
      async search() {
        throw Object.assign(new Error('semantic unavailable'), { code: 'SEARCH_FAILED', recoverable: true });
      },
    } as any;

    const failingKeyword = {
      async search() {
        throw Object.assign(new Error('keyword unavailable'), { code: 'SEARCH_FAILED', recoverable: true });
      },
    } as any;

    const useCase = new SearchKnowledgeUseCaseImpl(failingSemantic, failingKeyword);

    await expect(
      useCase.execute({
        id: 'search-fail-both',
        query: 'budget approval timeline',
      }),
    ).rejects.toMatchObject({
      code: 'SEARCH_FAILED',
      recoverable: true,
    });
  });
});
