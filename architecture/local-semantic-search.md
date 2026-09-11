# Feature: Local Semantic Search

## 1. Architectural Context

### Relevant Existing Components

| Component | Responsibility | Relevance to Feature |
| ----------- | ---------------- | -------------------- |
| `KnowledgeChunk` / chunking pipeline | Produces normalized document chunks and metadata ready for retrieval | This is the source content the search feature must rank and return |
| `EmbeddingRuntimeService` / `LocalEmbeddingService` | Builds embeddings from text using the configured local model and provider metadata | This is the existing local embedding abstraction that query generation should reuse |
| `DrizzleEmbeddingRepository` | Reads/writes persisted embedding vectors and metadata in SQLite | This is the storage boundary behind which the search retrieval logic should sit |
| `knowledge_chunks` / `knowledge_embeddings` schema | Stores chunk text and vector metadata with provider/model metadata | These existing tables are the natural source for semantic retrieval |
| `KnowledgeEmbeddingRun` / run-state workflow | Tracks document-level processing lifecycle and checkpoint state | Provides the project’s existing pattern for async, retryable, recoverable work |
| `registerServices` | Wires app dependencies to feature services | This is the injection point for the search use case and repository adapter |
| `ChunkDocumentUseCase` / `StartKnowledgeEmbeddingFlowUseCase` | Existing orchestration flow for knowledge processing | The search feature should align with the same use-case and repository boundaries rather than branching into ad hoc service calls |

### Architectural Constraints

* Keep the feature inside the existing knowledge-embedding slice and maintain the current clean-architecture split between use cases, domain contracts, and infrastructure repositories.
* Reuse the existing async, retry-friendly workflow patterns already used by the embedding pipeline instead of introducing a synchronous blocking search path.
* Reuse SQLite persistence and the existing embedding metadata contract rather than creating a second indexing store or application-specific database.
* Preserve a single model contract: query embeddings and stored chunk embeddings must be produced with the same provider and model version configuration.
* Treat an empty query as validation failure before any embedding work starts, and treat a zero-result search as an explicit result state rather than an exceptional failure.
* Keep the search concern limited to retrieval and ranking; chunk generation and embedding persistence remain separate, upstream responsibilities.
* Do not maintain persistent workflow status or retry/circuit state for this feature; it is a per-request read operation and the caller owns the failure/retry decision.

---

## 2. Proposed Architecture

### Abstract Interfaces/Contracts/DTOs Source Code Structure

```text
src/
  features/
    knowledge-embedding/
      application/
        usecases/
          SearchKnowledgeUseCase.ts
        services/
          SemanticSearchService.ts
      domain/
        entities/
          SemanticSearchRequest.ts
          SemanticSearchResult.ts
        repositories/
          SemanticSearchQueryRepository.ts
      infrastructure/
        repositories/
          DrizzleSemanticSearchRepository.ts
        services/
          LocalSemanticSearchAdapter.ts
  shared/
    infrastructure/
      database/
        schema.ts
      di/
        registerServices.ts
```

The contracts should stay intentionally small and model the retrieval behavior instead of the database implementation details. The read-side abstraction is deliberately named `SemanticSearchQueryRepository` to signal a query/projection responsibility, while the concrete implementation remains `DrizzleSemanticSearchRepository` to match the repository naming pattern already used across the codebase.

```ts
interface SemanticSearchRequest {
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

interface SemanticSearchMatch {
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

interface SemanticSearchResult {
  requestId: string;
  matches: SemanticSearchMatch[];
  totalMatches: number;
  isEmpty: boolean;
  modelVersion?: string;
  provider?: string;
  completedAt: Date;
}

interface SemanticSearchError extends Error {
  code: 'INVALID_QUERY' | 'VECTOR_STORE_UNAVAILABLE' | 'EMBEDDING_UNAVAILABLE' | 'SEARCH_FAILED';
  recoverable: boolean;
}

interface SearchKnowledgeUseCase {
  execute(request: SemanticSearchRequest): Promise<SemanticSearchResult | SemanticSearchError>;
}

interface SemanticSearchQueryRepository {
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
```

Key invariant: the query embedding and every stored chunk embedding must be produced by the same provider/model configuration. Without that invariant, semantic distance is meaningless. This keeps the read-side contract explicit without introducing a broader CQRS-only naming scheme across the rest of the feature.

### Data Flow

```text
Search screen / feature caller
    ↓
SearchKnowledgeUseCase
    ↓
Query validation + request normalization
    ↓
EmbeddingRuntimeService / LocalEmbeddingService
    ↓
Query embedding vector
    ↓
SemanticSearchRepository
    ↓
SQLite-backed chunk vector retrieval + filter evaluation
    ↓
Ranked `SemanticSearchResult`
```

Important transitions:

1. The caller submits a non-empty natural-language query and optional document or metadata filters.
2. The use case validates the query, normalizes the request, and starts the work asynchronously.
3. A single shared embedding service generates the query vector using the active provider and model version.
4. The repository applies document scoping and metadata filters while fetching the nearest matching chunk vectors.
5. The result mapper assembles each hit with chunk content, source metadata, and relevance score.
6. The final result is either a ranked non-empty match set or an explicit empty result object so the caller can decide how to present “no result” behavior.

### State Flow

This feature does not maintain a durable workflow state machine because it is a request-scoped read operation rather than a long-running job. The only meaningful lifecycle is the in-memory request lifecycle and the result outcome.

```text
Request created
    ↓
Validate query + filters
    ↓
Generate query embedding
    ↓
Execute similarity lookup
    ↓
Return result or empty result or recoverable error
```

Request-scoped responsibilities:

* `Validate query + filters`: rejects empty or malformed requests before any embedding or lookup work begins.
* `Generate query embedding`: turns the natural-language request into the vector expected by the persisted chunk vectors.
* `Execute similarity lookup`: applies document and metadata filters and returns the nearest matches.
* `Return result`: either a ranked match set, a valid empty-result state, or a recoverable error for the caller to handle.

No persistent status record, retry counter, or circuit-breaker state is required for this feature. If the caller wants observability or retry semantics, they should be implemented at the consumer boundary rather than in the search feature itself.

---

## 4. Data / Persistence Changes

> No persistence changes are required.

The search feature should reuse the existing `knowledge_chunks` and `knowledge_embeddings` records already persisted in SQLite. The only required data contract is that the search layer reads the aligned chunk text and vector metadata without inventing new model tables or new persistence objects.

Required behaviour of the existing persistence contract:

* `knowledge_chunks` supplies the source text and document metadata needed to return passages to the caller.
* `knowledge_embeddings` supplies the vector payload, provider, model version, and dimension for matching.
* Search results must include source metadata sufficient to trace each passage back to the originating document content.
* Filter evaluation should be applied to the persisted chunk metadata, not by re-deriving a second record set outside the repository boundary.
* If a future optimization introduces a dedicated SQLite vector index or extension, it should remain an infrastructure implementation detail behind the repository contract and must not change the feature’s public contract.

---

## 5. Error Handling & Resilience

* Invalid input: a blank or whitespace-only query is rejected immediately with an `INVALID_QUERY` error before the system attempts embedding or vector lookup.
* Empty result state: if the retrieval completes but matches are below rank or threshold, the system returns an explicit empty result object, not an exception, so the caller can decide whether to show a “no matching content” experience or continue business logic.
* External dependency failure: if the local embedding provider or repository is unavailable, the system raises a recoverable `EMBEDDING_UNAVAILABLE` or `VECTOR_STORE_UNAVAILABLE` error and logs enough context for retries or monitoring.
* Provider/model mismatch: if the configured query model differs from the stored embedding model or dimension, the system fails the request with a clear mismatch error instead of silently mixing vector spaces.
* Duplicate requests: for repeated searches with the same request identity, the feature should be idempotent at the request boundary; the same logical query should not produce duplicate side effects or duplicate telemetry without an explicit retry reason.
* Partial failure: the system must never return partial matches without clearly representing the failure or empty-result state. A search result is either a valid result set or an explicit failure / empty state.
* Cancellation or app interruption: since the operation is asynchronous, cancellation should be handled as a request-level abort before embedding or retrieval completes, without leaving a partial successful result that appears valid.
* Retry behaviour: no retry or circuit-breaker state should be persisted inside this feature. Transient failures should be surfaced as recoverable errors to the consumer so that the caller can choose whether to retry, suppress the UI, or continue alternative logic. Empty-result searches remain non-error outcomes.

---

## 6. Implementation Sequence

1. Define the search request and result contracts in the knowledge-embedding domain layer and align them with the existing local embedding and repository conventions.
2. Add the async `SearchKnowledgeUseCase` that validates the request, starts the asynchronous flow, and distinguishes invalid-query, empty-result, and recoverable-failure states.
3. Reuse the existing `EmbeddingRuntimeService` / `LocalEmbeddingService` contract to generate the query embedding using the same provider and model version as the stored chunk embeddings.
4. Implement the repository query contract that accepts a query vector and filter options, then executes the nearest-neighbour retrieval against persisted chunk vectors with document and metadata filtering.
5. Add the result-binding layer that converts raw vector hits into `SemanticSearchMatch` objects with chunk content, doc metadata, and relevance score.
6. Add logging and telemetry around query validation, embedding latency, retrieval latency, total matches, and zero-result searches so the feature can distinguish infrastructure failures from intentional no-match outcomes.
7. Validate the end-to-end flow with targeted tests covering non-empty queries, empty queries, zero results, provider mismatch, and repository failure cases.

No additional workflow status model, retry counter, or circuit-breaker persistence is required in this implementation. If a caller later needs retry orchestration, it should be added at the consumer boundary, not in the search operation itself.

The implementation should remain intentionally narrow: this feature covers the search request, query embedding, vector retrieval, result mapping, and explicit empty-result handling. It does not broaden into content ingestion, model management, or answer generation.
