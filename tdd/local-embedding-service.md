# Feature: Local Embedding Service

## Phase 1: Test Blueprint

### 1. Test Scenarios & Purposes

#### A. Domain Entity & Validation Tests

These tests verify the invariants for the feature-local embedding contract and the persistence boundary between source chunks and derived vectors.

- Purpose: validate that chunk content is the canonical text source and is not silently converted into an embedding without a model contract.
- Purpose: ensure the vector payload cannot be persisted unless it matches the configured model/dimension contract.
- Purpose: verify that local embedding operations fail fast for invalid input and model mismatch while preserving a clear failure reason.

| Test ID | Scenario | Purpose |
| --- | --- | --- |
| DVT-01 | `KnowledgeChunk` with empty or whitespace-only content | Ensure the content contract is invalid before embedding begins. |
| DVT-02 | `KnowledgeEmbedding` vector length does not match configured dimension | Ensure model/dimension consistency is enforced before persistence. |
| DVT-03 | `KnowledgeEmbedding` vector contains non-finite values | Ensure numeric validation rejects invalid embedding payloads. |
| DVT-04 | `KnowledgeEmbedding` record with missing `chunkId` | Ensure the association to the source chunk is required. |
| DVT-05 | Local embedding provider initialized with unsupported model metadata | Ensure the provider contract rejects unsupported configuration before generation. |
| DVT-06 | Batch request with a mix of empty and valid texts | Ensure partial valid inputs are not silently accepted when the overall batch is invalid. |
| DVT-07 | Model version changes between chunk embeddings and query embeddings | Ensure a mismatch is surfaced as an explicit compatibility failure rather than a silent cross-model search bug. |
| DVT-08 | Duplicate embedding generation for same chunk content with same model | Ensure deterministic behavior remains consistent and does not create conflicting vector artifacts unnecessarily. |

#### B. Workflow & State Transition Tests

These tests validate the embedding lifecycle as an internal operation with a coarse public outcome.

- Purpose: verify the embedding step tracks internal progress for retry/resume without exposing low-level state to the broader business workflow.
- Purpose: ensure public workflow outcomes remain simple: success or failure with a reason.
- Purpose: confirm the embedding step is idempotent and safe to re-run for the same chunk under the same model contract.

| Test ID | Scenario | Purpose |
| --- | --- | --- |
| WST-01 | Embedding requested for valid chunk text | Validate the operation moves from `Ready` to `EmbeddingRequested` and then `Validated`. |
| WST-02 | Empty chunk content submitted | Validate the request fails at validation and enters `InvalidInput` before any persistence occurs. |
| WST-03 | Local model generates vector successfully | Validate internal lifecycle reaches `Embedded` and then `Persisted`. |
| WST-04 | Model generation fails transiently | Validate retry behavior is captured internally via `RetryScheduled` and not exposed as a broad business failure without reason. |
| WST-05 | Persist step fails after embedding succeeds | Ensure the public outcome is still a failure and the detailed internal state remains attributable to persistence. |
| WST-06 | Provider or model version changes | Validate `ModelChanged` recovery path is triggered and the new contract is recorded. |
| WST-07 | Repeat embedding request for same chunk under same model | Validate idempotent replay without duplicate persisted vectors unless explicitly required by the workflow. |
| WST-08 | Batch operation partially fails | Validate the embedding service surfaces a clear aggregated failure reason and does not claim partial success without a defined contract. |
| WST-09 | Query embedding for search use case | Validate the same provider + dimension + model version contract is reused and not silently mismatched. |

#### C. Contract & API Surface Tests

These tests define the service contracts and persistence boundaries expected by the architecture.

- Purpose: validate the provider abstraction is stable and local-first.
- Purpose: validate public service methods return clear outcomes for success, failure, retryable errors, and invalid input.
- Purpose: confirm the repository contract persists derived vectors separately from source chunk content and stores metadata needed for retrieval compatibility.

| Test ID | Scenario | Purpose |
| --- | --- | --- |
| CAT-01 | `EmbeddingService.embed(text)` with valid input | Validate a vector is returned without leaking internal lifecycle details. |
| CAT-02 | `EmbeddingService.embedBatch(texts)` with valid input | Validate each text gets a correctly shaped embedding and the batch result preserves ordering. |
| CAT-03 | `EmbeddingService.embedWithRetry(text)` on transient failure | Validate retry logic is attempted and the result surfaces either a valid vector or a clear failure reason. |
| CAT-04 | `EmbeddingService` with uninitialized provider configuration | Validate the contract fails before execution instead of returning malformed vectors. |
| CAT-05 | `KnowledgeEmbeddingRecord` saved with provider/model metadata | Validate the repository contract retains enough metadata to interpret the vector later. |
| CAT-06 | Repository save with dimension mismatch | Validate vector persistence is rejected when metadata and payload disagree. |
| CAT-07 | Query embedding request with different provider or model than stored chunk embeddings | Validate compatibility is enforced before search is attempted. |
| CAT-08 | Embed operation on whitespace-only input | Validate the contract returns an error object or rejected promise, not a successful empty vector. |
| CAT-09 | Repository returns stored vector for same chunk ID | Validate the retrieval contract is deterministic and keyed by the source chunk relationship. |
| CAT-10 | Service contract is provider-agnostic | Validate domain code depends on interface contracts, not on one concrete local model implementation. |

---

### 2. Test Execution Plan

| Test ID | Target Component/Interface | Scenario / Trigger | Expected Behavioral Outcome | Test Type |
| --- | --- | --- | --- | --- |
| DVT-01 | `KnowledgeChunk` validation | Empty or whitespace text | Validation rejects before embedding request is accepted | Unit |
| DVT-02 | `KnowledgeEmbedding` entity validation | Vector length mismatch | Validation fails with clear dimension error | Unit |
| DVT-03 | `KnowledgeEmbedding` numeric validation | Non-finite values in vector | Validation fails; no persistence occurs | Unit |
| DVT-04 | `KnowledgeEmbedding` domain contract | Missing `chunkId` | Validation fails; association is required | Unit |
| DVT-05 | `EmbeddingProviderConfig` / provider setup | Unsupported model config | Provider contract rejects configuration | Unit |
| DVT-06 | `EmbeddingService.embedBatch` | Mixed empty and valid inputs | Batch request fails early; no silent partial success | Unit |
| DVT-07 | Model compatibility guard | Different model version between chunk and query embeddings | Clear mismatch error is raised | Unit |
| DVT-08 | Deduplication guard | Same chunk + same model repeated | Deterministic behavior; no conflicting vectors | Integration |
| WST-01 | `EmbeddingService` workflow state | Valid input | Internal state moves `Ready -> EmbeddingRequested -> Validated` | Unit |
| WST-02 | `EmbeddingService` workflow state | Empty input | Internal state becomes `InvalidInput` and stops before generation | Unit |
| WST-03 | `EmbeddingService` workflow state | Successful vector generation | Internal state reaches `Embedded -> Persisted` | Unit |
| WST-04 | Retry path | Transient generation failure | Internal state enters `RetryScheduled` and retries deterministically | Unit |
| WST-05 | Persistence failure path | Save fails after generation | Public workflow returns failure with reason; internal state retains persistence issue | Integration |
| WST-06 | Model version drift | Provider/model changes | Internal state enters `ModelChanged`; reset/reconcile behavior is triggered | Integration |
| WST-07 | Idempotent replay | Same chunk re-embedded under same config | Same source content yields same vector contract without duplicate records | Integration |
| WST-08 | Batch recovery | Batch partially fails | Failure reason is clear and no false success is returned | Integration |
| WST-09 | Query compatibility path | Search query embedding request | Query uses same provider and dimension contract as chunk embeddings | Integration |
| CAT-01 | `EmbeddingService.embed` contract | Valid chunk text | Returns vector and preserves invisible internal lifecycle contract | Unit |
| CAT-02 | `EmbeddingService.embedBatch` api contract | Valid list of texts | Preserves ordering and returns one vector per input item | Unit |
| CAT-03 | `EmbeddingService.embedWithRetry` contract | Retryable generation failure | Retries as designed and resolves or returns clear failure metadata | Unit |
| CAT-04 | Service configuration contract | Provider not configured | Failure is surfaced before generation starts | Unit |
| CAT-05 | Repository contract | Save embedding with provider metadata | Retrieval remains interpretable and consistent | Integration |
| CAT-06 | Repository contract | Save vector with mismatched dimension metadata | Persistence fails; no invalid row is stored | Integration |
| CAT-07 | Query embedding compatibility contract | Query embedding model mismatch | Search is blocked until schema/provider/dimension compatibility is validated | Integration |
| CAT-08 | Invalid input contract | Whitespace only input | Service rejects request and surfaces reason | Unit |
| CAT-09 | Retrieval contract | Fetch by `chunkId` | Stored vector is returned deterministically and keyed by source chunk | Integration |
| CAT-10 | Architecture contract | Domain depends on interfaces only | Local provider implementation can change without changing domain call sites | Unit |

---

## Gate: Phase 2 Approval

Please review this blueprint and confirm whether it should proceed to Phase 2, where the additive production contracts and red unit/integration tests will be generated from this plan.
