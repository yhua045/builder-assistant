# Feature: Hybrid Retrieval

## 1. Architectural Context

### Relevant Existing Components

| Component | Responsibility | Relevance to Feature |
| --- | --- | --- |
| `SearchKnowledgeUseCaseImpl` | Current retrieval entry point for knowledge queries. | This should become the orchestrator for the hybrid retrieval flow: it invokes both the semantic and keyword retrieval paths, merges results, re-ranks them, and returns a single result to the caller. |
| `SemanticSearchService` / `DefaultSemanticSearchService` | Embeds the query and retrieves nearest semantic matches from stored vectors. | This remains one of the retrieval branches used by the orchestrator. |
| `SemanticSearchQueryRepository` | Reads persisted chunk vectors and metadata. | This repository continues to supply semantic hits for the search flow. |
| `knowledge_chunks` / `knowledge_embeddings` | Persisted chunk content and vectors used for semantic similarity and exact text lookup. | These tables remain the authoritative data source for both retrieval paths. |
| `DrizzleSemanticSearchRepository` | SQLite-backed implementation for vector lookup. | This is the current semantic retrieval implementation and should stay in place as one branch of the hybrid flow. |
| `KeywordSearchService` (new internal collaborator) | Performs exact text or literal reference lookup against chunk content. | This new service handles the non-semantic branch and is kept private to the knowledge search orchestration layer. |
| `SearchKnowledgeUseCase.red.test.ts` | Current unit tests for query validation and result structure. | This is the right place to expand coverage for merge and re-ranking behavior without changing the public API surface. |

### Architectural Constraints

* Keep a single public search entry point: `SearchKnowledgeUseCase` owns the orchestration and the caller never selects a search technique.
* Preserve the established clean-architecture boundary: use cases orchestrate, services perform retrieval work, repositories remain the persistence boundary.
* Reuse the existing SQLite-backed `knowledge_chunks` and `knowledge_embeddings` data rather than creating a separate retrieval store.
* Keep the result contract domain-oriented; do not leak implementation details such as “semantic” or “keyword” into the public API type names.
* The use case must merge and re-rank candidates before returning the final result, because this is the functional responsibility of the hybrid search behavior.
* A zero-result search remains a valid empty result, while dependency failures remain recoverable operational errors.

---

## 2. Proposed Architecture

### Abstract Interfaces/Contracts/DTOs Source Code Structure

```text
src/features/knowledge-embedding/
  application/
    contracts/
      KnowledgeSearchContracts.ts
    services/
      SemanticSearchService.ts
      KeywordSearchService.ts
    usecases/
      SearchKnowledgeUseCase.ts
  infrastructure/
    repositories/
      DrizzleSemanticSearchRepository.ts
      DrizzleKeywordSearchRepository.ts
  tests/
    unit/
      SearchKnowledgeUseCase.red.test.ts
```

The public contract should describe the search capability, not the retrieval technique.

```ts
interface KnowledgeSearchRequest {
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

interface KnowledgeSearchMatch {
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

interface KnowledgeSearchResult {
  requestId: string;
  matches: KnowledgeSearchMatch[];
  totalMatches: number;
  isEmpty: boolean;
  modelVersion?: string;
  provider?: string;
  completedAt: Date;
}

interface SearchKnowledgeUseCase {
  execute(request: KnowledgeSearchRequest): Promise<KnowledgeSearchResult>;
}
```

The implementation detail below the public contract is that the use case orchestrates two independent retrieval services:

```ts
interface SemanticSearchService {
  search(request: KnowledgeSearchRequest): Promise<KnowledgeSearchMatch[]>;
}

interface KeywordSearchService {
  search(request: KnowledgeSearchRequest): Promise<KnowledgeSearchMatch[]>;
}
```

These service interfaces are internal collaborators and do not become part of the public API that the caller depends on. The orchestrator is responsible for running both searches, combining the resulting candidate sets, re-ranking them, and trimming the final list to the configured top-k.

### Data Flow

```text
Caller
    ↓
SearchKnowledgeUseCase.execute
    ↓
Parallel retrieval orchestration
    ├─ SemanticSearchService.search
    │    ↓
    │   EmbeddingRuntimeService → DrizzleSemanticSearchRepository
    └─ KeywordSearchService.search
         ↓
       DrizzleKeywordSearchRepository / content lookup
    ↓
Merge candidate sets
    ↓
Re-rank by final score and top-k limit
    ↓
KnowledgeSearchResult
```

Important transitions:

1. The caller submits one search request and receives one result object; it does not control or select the retrieval technique.
2. `SearchKnowledgeUseCaseImpl` becomes the coordinator that triggers both retrieval branches for the same query.
3. The semantic service continues to use the embedding pipeline to find conceptually similar chunks.
4. The keyword service searches exact text, section references, material codes, or literal identifiers against the persisted chunk content and scope filters.
5. The orchestrator merges the two candidate sets, normalizes the score model, and re-ranks the combined list before applying the configured top-k.
6. The final output is always a single ranked list of `KnowledgeSearchMatch` results, regardless of which branch produced which hit.

### State Flow

```text
Idle
 ↓
Request validated
 ↓
Semantic search started
 ↓
Keyword search started
 ├─ both succeed → merge and re-rank
 ├─ one succeeds, one fails → continue with available results; treat as partial success or recoverable failure depending on completeness
 └─ both fail → return recoverable failure
 ↓
Top-k enforced
 ↓
Completed / Empty / Failed
```

The flow is request-scoped and should not create a durable workflow record. This is not a long-lived job. The only meaningful states are request validation, retrieval execution, merged ranking, and result outcome.

---

## 4. Data / Persistence Changes

> No persistence changes are required.

The search feature should continue to use the same persisted domain data already in SQLite:

* `knowledge_chunks` remains the source of the searchable content and chunk metadata.
* `knowledge_embeddings` remains the source of vector similarity data.
* The keyword service may use the persisted chunk content directly, optionally with a repository-backed exact-match or SQLite FTS path behind the infrastructure layer.
* No new table is required solely to support this feature; the merged result is a volatile request object and not a persisted entity.

If the implementation later introduces a full-text index, it should remain an internal repository optimization and not become a new domain contract or public API.

---

## 5. Error Handling & Resilience

* Invalid input: empty or whitespace-only query values are rejected before any retrieval work starts.
* Semantic path failure: if the embedding service or vector repository is unavailable, the orchestrator may continue with the keyword branch if it has valid results; otherwise it returns a recoverable failure.
* Keyword path failure: if the literal search path fails, the orchestrator may continue with semantic results, but must not report a complete successful answer if the result set is incomplete relative to the expected request.
* Both paths fail: the use case returns a recoverable operational failure with enough context to identify the failing dependency.
* No matches found: the system returns an empty result set with `isEmpty = true` rather than an exception.
* Partial results: if one path returns zero results and the other returns valid matches, the merged set is still considered a valid search result, provided both paths were executed successfully or one path was intentionally unavailable and the remaining path was complete enough to answer the request.
* Merge or re-ranking failure: if the candidate set cannot be normalized and ranked correctly, the use case must surface a recoverable failure instead of a partial or fabricated result.
* Duplicate requests: repeated requests for the same query should remain idempotent at the request boundary; they do not create durable state or duplicate persisted records.
* Timeout or cancellation: a request-level cancellation should abort the in-flight retrieval and avoid persisting a false success state.

---

## 6. Implementation Sequence

1. Rename the public contracts from semantic-specific names to generic knowledge-search names so the API reflects the user capability rather than the retrieval technique.
2. Keep `SearchKnowledgeUseCaseImpl` as the orchestrator and update it to coordinate both `SemanticSearchService` and `KeywordSearchService` for the same request.
3. Introduce the keyword retrieval branch behind the same application boundary without exposing it in the public contract.
4. Implement a merge-and-re-rank step inside the use case that combines both candidate sets into a single ranked list and enforces the configured `top-k` limit.
5. Preserve the existing semantic repository and embedding flow; do not replace it with a different retrieval model or a parallel persistence layer.
6. Update the dependency wiring in `registerServices.ts` so the use case receives both services and the orchestrator composes them.
7. Extend the unit tests in `SearchKnowledgeUseCase.red.test.ts` to cover mixed-query behavior, exact-match inclusion, merged ranking, empty-result handling, and single-path failure behavior.
8. Add a repository-level integration test for literal matches and for scope-limited mixed queries to validate the search remains constrained to the correct document/project scope.
9. Run focused type checks and relevant knowledge-embedding tests to verify that the public behavior remains a single search result contract while the hybrid logic remains internal.

---

## Implementation Guardrails

* Keep the public API generic: the caller should ask for knowledge search, not choose a retrieval technique.
* Let `SearchKnowledgeUseCase` own the orchestration logic and merge/re-rank behavior.
* Do not leak internal implementation details such as `semantic`, `keyword`, or `hybrid` into the types surfaced outside the feature boundary.
* Reuse the existing semantic search service and repository before introducing additional abstractions.
* Keep the keyword search as an internal collaborator or repository optimization rather than a new public application contract.
* Do not introduce a new persistence model, monitor, or UI concept for this feature.
