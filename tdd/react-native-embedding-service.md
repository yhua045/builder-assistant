# Feature: React Native Embedding Service

## Phase 1: Test Blueprint

This blueprint validates the React Native local embedding flow described in the architecture and acceptance criteria. It focuses on observable behavior, retry semantics, provider selection, idempotency, and persistence correctness without prescribing implementation details beyond the agreed contracts.

### 1. Test Scenarios & Purposes

#### A. Domain Entity & Validation Tests

These tests verify the invariant rules for chunk validation, embedding generation, and provider/dimension compatibility.

- Purpose: ensure invalid chunk text is rejected before a vector can be generated.
- Purpose: ensure the vector payload cannot be persisted unless it matches the selected provider and configured dimension.
- Purpose: ensure duplicate content cannot create conflicting persistent records.
- Purpose: ensure model/provider misalignment is surfaced as an explicit compatibility failure.

| Test ID | Scenario | Purpose |
| --- | --- | --- |
| DVT-01 | Chunk text is empty or whitespace only | Validate input rejection before any embedding generation begins. |
| DVT-02 | Chunk text is structurally invalid for the current document flow | Ensure validation fails fast and records the cause without generating a vector. |
| DVT-03 | Embedding vector length does not match configured dimension | Ensure dimension mismatch is rejected before persistence. |
| DVT-04 | Embedding vector contains NaN or Infinity values | Ensure invalid numeric payloads are rejected. |
| DVT-05 | Provider config is missing or unsupported | Ensure the selected provider contract is validated before inference starts. |
| DVT-06 | Model version differs between stored chunk embeddings and query embedding request | Ensure search compatibility is enforced and not silently allowed. |
| DVT-07 | Duplicate chunk content is re-processed with same model contract | Ensure deterministic and idempotent behavior does not create conflicting rows. |
| DVT-08 | Duplicate request arrives during retry or replay | Ensure canonical chunk identity resolves to one durable embedding decision. |
| DVT-09 | Batch input contains a mix of valid and invalid texts | Ensure invalid content fails the operation rather than silently accepting partial success. |
| DVT-10 | Local provider selected and available, but generation returns malformed output | Ensure service rejects malformed output before it is stored. |

#### B. Workflow & State Transition Tests

These tests validate the simplified embedding lifecycle: a chunk starts in `ChunkReceived`, validation may fail, and the embedding step ends in either `EmbeddingSucceeded` or `EmbeddingFailed`. If the step fails, the workflow simply retries by re-entering `ChunkReceived`; no separate retry-state granularity is tracked.

- Purpose: verify the workflow outcome stays intentionally simple: success or failure at the embedding step.
- Purpose: verify invalid input and transient provider failures route back to `ChunkReceived` for retry.
- Purpose: confirm the embedding step is idempotent and safe to re-run for the same chunk without keeping a detailed retry model.

| Test ID | Scenario | Purpose |
| --- | --- | --- |
| WST-01 | Valid chunk enters embedding flow | Ensure the flow advances from `ChunkReceived` to `EmbeddingSucceeded` when generation and persistence pass. |
| WST-02 | Empty/invalid chunk enters flow | Ensure validation failure is recorded as `ValidationFailed` and no embedding is persisted. |
| WST-03 | Local provider succeeds | Ensure the final result is `EmbeddingSucceeded` and no additional retry state is required. |
| WST-04 | Local provider fails transiently | Ensure the result is `EmbeddingFailed` and the workflow re-enters `ChunkReceived` for retry. |
| WST-05 | Persistence fails after inference succeeds | Ensure the operation is treated as `EmbeddingFailed` and retried from `ChunkReceived`. |
| WST-06 | Repeated request for same chunk arrives after a failure | Ensure idempotency prevents duplicate durable rows while the workflow retries from `ChunkReceived`. |
| WST-07 | Search query embedding uses same contract as stored vectors | Ensure the workflow remains compatible for retrieval and does not drift to a mismatched model. |
| WST-08 | Validation failure occurs while the provider is selected | Ensure failure metadata is attached to the relevant document/workflow state rather than being silently ignored. |
| WST-09 | Provider is unavailable at initialization time | Ensure the failure is explicit as `EmbeddingFailed`, and the next attempt re-enters `ChunkReceived`. |

#### C. Contract & API Surface Tests

These tests define the public contracts for the embedding service, repository, and query path without relying on implementation specifics.

- Purpose: validate the service surface for success, failure, retry, and invalid-input conditions.
- Purpose: validate repository and query contracts preserve correct metadata and compatibility.
- Purpose: validate the feature remains local-first and does not silently fall back to remote service behavior.

| Test ID | Scenario | Purpose |
| --- | --- | --- |
| CAT-01 | `EmbedChunkUseCase.execute` with valid chunk input | Ensure the contract returns a success result with provider/model metadata and vector payload. |
| CAT-02 | `EmbedChunkUseCase.execute` with empty or invalid text | Ensure the result is a failed outcome and the failure reason is captured. |
| CAT-03 | Duplicate chunk request to `EmbedChunkUseCase` | Ensure the result is `duplicate` and no second persisted vector is created. |
| CAT-04 | Provider failure during `embed` operation | Ensure the call fails without falling back to remote provider behavior. |
| CAT-05 | Query embedding request with valid input | Ensure it returns a valid vector under the same provider/dimension contract as stored chunks. |
| CAT-06 | Query embedding request when model/provider is mismatched | Ensure the contract fails clearly before search is attempted. |
| CAT-07 | `EmbeddingService.embedBatch` with valid input | Ensure the batch preserves ordering and returns one vector per valid item. |
| CAT-08 | `EmbeddingService.embedBatch` with invalid content in the request | Ensure the batch fails explicitly and does not silently return half-complete output. |
| CAT-09 | Repository persistence for valid vector output | Ensure the stored row includes vector, dimension, provider, and model metadata. |
| CAT-10 | Repository persistence with metadata mismatch | Ensure the storage boundary rejects invalid row data instead of accepting it silently. |
| CAT-11 | DocumentVersion/failure recording on invalid input | Ensure validation failure is persisted on the known lifecycle record. |
| CAT-12 | DocumentVersion/failure recording on provider failure | Ensure transient or terminal embedding failures are not lost to the workflow. |

---

### 2. Test Execution Plan

| Test ID | Target Component/Interface | Scenario / Trigger | Expected Behavioral Outcome | Test Type |
| --- | --- | --- | --- | --- |
| DVT-01 | Chunk validation contract | Empty or whitespace-only chunk text | Request is rejected before embedding generation starts | Unit |
| DVT-02 | Chunk validation contract | Structurally invalid chunk text | Validation failure is recorded and no vector is persisted | Unit |
| DVT-03 | Vector validation rule | Vector length mismatch vs. configured dimension | Validation fails before persistence | Unit |
| DVT-04 | Vector validation rule | Non-finite values in generated vector | Embedding is rejected as invalid | Unit |
| DVT-05 | Provider configuration guard | Unsupported or missing provider config | Provider setup fails explicitly | Unit |
| DVT-06 | Model compatibility guard | Stored chunk model differs from query model | Search call fails with clear incompatibility error | Unit |
| DVT-07 | Idempotency guard | Same chunk content reprocessed repeatedly | Duplicate attempts do not create conflicting persisted embeddings | Integration |
| DVT-08 | Retry replay guard | Duplicate request arrives during retry | The same canonical content resolves to one durable outcome | Integration |
| DVT-09 | Batch validation | Mixed valid and empty chunk texts | The overall batch fails; no partial success claim | Unit |
| DVT-10 | Output validation | Local provider returns malformed vector | The malformed output is rejected before storage | Unit |
| WST-01 | Embedding workflow | Valid chunk reaches processing | Operation transitions from `ChunkReceived` to `EmbeddingSucceeded` | Unit |
| WST-02 | Validation failure path | Invalid chunk arrives | Operation records `ValidationFailed` and stops before embedding | Unit |
| WST-03 | Success path | Local provider generates vector successfully | Final state is `EmbeddingSucceeded` with persisted vector metadata | Unit |
| WST-04 | Retry path | Local provider fails transiently | Final state is `EmbeddingFailed`, and the workflow re-enters `ChunkReceived` for the next attempt | Unit |
| WST-05 | Persistence failure path | Inference succeeds but storage fails | The request remains failed and is retried from `ChunkReceived` | Integration |
| WST-06 | Duplicate retry path | Same chunk is retried after a failure | Only one durable embedding record exists | Integration |
| WST-07 | Search compatibility path | Query embedding differs from chunk contract | Search is blocked until contract alignment is restored | Integration |
| WST-08 | Failure recording path | Validation or provider failure occurs | Failure details are recorded in DocumentVersion/workflow state | Integration |
| WST-09 | Dependency unavailability | Local provider cannot initialize | Request fails as `EmbeddingFailed` and re-enters `ChunkReceived` for retry | Integration |
| CAT-01 | `EmbedChunkUseCase` | Valid input | Returns embedded status with vector, provider, and model metadata | Unit |
| CAT-02 | `EmbedChunkUseCase` | Empty or invalid input | Returns failed status and clear error reason | Unit |
| CAT-03 | `EmbedChunkUseCase` | Duplicate request | Returns duplicate status and preserves idempotency | Integration |
| CAT-04 | `EmbeddingService` | Local provider failure | Fails without fallback to non-local service | Unit |
| CAT-05 | `EmbeddingService.embedBatch` | Valid list of texts | Returns ordered vectors matching input count | Unit |
| CAT-06 | `EmbeddingService.embedBatch` | Invalid member in batch | Operation fails without claiming partial success | Unit |
| CAT-07 | Query embedding contract | Valid query input | Returns a valid search vector using same provider/dimension contract | Unit |
| CAT-08 | Query embedding contract | Model mismatch | Fails before search execution | Unit |
| CAT-09 | Repository contract | Save valid embedding row | Row is persisted with provider and model metadata | Integration |
| CAT-10 | Repository contract | Save vector with mismatched dimension metadata | Persistence is rejected and row is not committed | Integration |
| CAT-11 | Workflow state recording | Invalid input or failure occurs | DocumentVersion is updated with relevant status and reason | Integration |
| CAT-12 | Local-first contract | Provider selection path | Local provider remains the only active path when available | Unit |

---

## Gate: Phase 2 Approval

Please review this blueprint and confirm whether it should proceed to Phase 2, where additive production contracts and red unit/integration tests will be generated from this plan.
