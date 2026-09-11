# Test Blueprint: RAG Pipeline Orchestrator

## 1. Test Scenarios & Purposes

### 1.1 Domain Entity & Validation Tests

Purpose: verify the durable workflow invariants, retry eligibility, and stage-binding rules for the parent/child workflow model.

| Test ID | Target Component/Interface | Scenario / Trigger | Expected Behavioral Outcome | Test Type |
| --- | --- | --- | --- | --- |
| D1 | `KnowledgeEmbeddingRunEntity` | Create a run with valid `documentId`, `status`, and timestamps | Run is created successfully and tracks expected fields | Unit |
| D2 | `KnowledgeEmbeddingRunEntity` | Create a run with empty or missing `documentId` | Validation fails and throws a domain error | Unit |
| D3 | `KnowledgeEmbeddingRunEntity` | Start a run from `pending` state | Status transitions to `running` and the current stage updates | Unit |
| D4 | `KnowledgeEmbeddingRunEntity` | Call `retryActiveStage()` on a completed run | Validation rejects the transition and throws the retry guard error | Unit |
| D5 | `KnowledgeEmbeddingRunEntity` | Resume a run in `partial` state | The run re-enters `running` without resetting the same active stage | Unit |
| D6 | `KnowledgeEmbeddingRunEntity` | Resume a stale `running` run after app restart | The run is treated as recoverable and returned to a resumable state only when stale lease rules permit it | Unit |
| D7 | `KnowledgeDetailRunEntity` | Create a child stage record with valid parent `runId` and stage metadata | Child record is created successfully and bound to parent run | Unit |
| D8 | `KnowledgeDetailRunEntity` | Create a child run with empty `runId` | Validation fails and throws a parent-binding error | Unit |
| D9 | `KnowledgeDetailRunEntity` | Retry a failed child stage | Retry count increments and stage re-enters `running` only from eligible states | Unit |
| D10 | `KnowledgeDetailRunEntity` | Retry a stage that has not failed or is already completed | Validation rejects the retry and preserves the existing status | Unit |
| D11 | `KnowledgeEmbeddingRunEntity` + `KnowledgeDetailRunEntity` | Parent and child mismatch during creation | Validation rejects inconsistent parent-child linkage | Unit |
| D12 | `KnowledgeEmbeddingRunEntity` | Mark a run as `failed` without error text | Validation fails because a failure reason is required | Unit |

### 1.2 Workflow & State Transition Tests

Purpose: validate the valid lifecycle transitions, forbidden transitions, and queue hydration behavior for the orchestrator and the in-memory runtime queue.

| Test ID | Target Component/Interface | Scenario / Trigger | Expected Behavioral Outcome | Test Type |
| --- | --- | --- | --- | --- |
| W1 | `RagPipelineOrchestrator` / layout | New valid document enters the pipeline | A run is created or resumed, state is moved to the active stage, and the next action is correct | Integration |
| W2 | `RagPipelineOrchestrator` | Validation fails before parsing | Pipeline stops at validation; no parsing or chunking work is executed | Integration |
| W3 | `RagPipelineOrchestrator` | Validation passes and parse stage completes | Workflow advances to `text_extracted` and persists extracted text before chunking | Integration |
| W4 | `RagPipelineOrchestrator` | Parse is interrupted after partial persistence | Run remains recoverable and resumes from the correct post-parse checkpoint | Integration |
| W5 | `RagPipelineOrchestrator` | Chunking fails for a subset of units | Completed chunks are preserved; only failed/incomplete chunk work is retried | Integration |
| W6 | `RagPipelineOrchestrator` | Embedding provider fails | Workflow remains in recoverable state; earlier chunk results remain durable | Integration |
| W7 | `RagPipelineOrchestrator` | Re-entry for same document version while already active | System reuses the existing workflow and avoids duplicate work | Integration |
| W8 | `RagPipelineOrchestrator` | Re-entry for same document version after completion | System does not restart the workflow and instead treats it as completed unless a new version is created | Integration |
| W9 | `RagPipelineOrchestrator` | Retry requested after partial failure | The orchestrator resumes from the last safe checkpoint instead of resetting the whole workflow | Integration |
| W10 | `RagPipelineOrchestrator` | Retry requested for a terminal `failed` row | The system does not auto-retry; a new explicit reprocessing path is required | Integration |
| W11 | `InMemoryWorkflowQueue` | App startup hydration from persisted rows | Queue restores only eligible `pending` / `partial` rows and excludes active `running` rows | Integration |
| W12 | `InMemoryWorkflowQueue` | Duplicate publish or repeated event storm | The queue emits a single active job per run and prevents duplicate in-memory dispatch | Unit |
| W13 | `DocumentChunkingWorkflow` | Transition from one stage to a forbidden stage | Workflow rejects the invalid transition and keeps prior durable state intact | Unit |
| W14 | `DocumentChunkingWorkflow` | Guard check for `resume` when run is completed | Transition is forbidden and no reprocessing occurs | Unit |

### 1.3 Contract & API Surface Tests

Purpose: validate the public orchestration contracts, repository boundaries, queue hydration logic, and failure signaling for primary interfaces.

| Test ID | Target Component/Interface | Scenario / Trigger | Expected Behavioral Outcome | Test Type |
| --- | --- | --- | --- | --- |
| C1 | `RagPipelineOrchestrator.execute` | Invoke with valid document identity and version | Returns the active run state for the correct document version | Unit |
| C2 | `RagPipelineOrchestrator.execute` | Invoke with missing or invalid document input | Returns/throws a clear validation error and does not start processing | Unit |
| C3 | `RagPipelineOrchestrator.resume` | Resume a recoverable partial or stale `running` run | Returns the recovered run state and next stage | Unit |
| C4 | `RagPipelineOrchestrator.resume` | Resume a completed run without a new version | Stops with a guard error or explicit non-resumable result | Unit |
| C5 | `InMemoryWorkflowQueue.hydrateFromRuns` | Supply persisted runs from repository | Only eligible rows are queued in memory; `running` rows are omitted | Unit |
| C6 | `InMemoryWorkflowQueue.subscribe` | Register a listener and publish a run | Listener receives the queued item once and is removed only when unsubscribed | Unit |
| C7 | Repository contract | `findByDocumentVersion` on an existing run | Returns the latest durable record for that version | Unit |
| C8 | Repository contract | `findLatestByDocumentId` when multiple versions exist | Returns the latest eligible version without mixing histories | Unit |
| C9 | Repository contract | Upsert duplicate workflow state for same version | Latest state wins without duplicate lifecycle rows | Unit |
| C10 | Error contract | Parsing, chunking, or embedding dependency failure | Failure reason is persisted and surfaced to caller with consistent schema | Unit |
| C11 | API contract | Empty extracted text after parse | Pipeline marks parse as failed; no chunking or embedding continues | Integration |
| C12 | API contract | Repeated same-version request | The system deduplicates and returns the current workflow state without creating duplicate artifacts | Integration |
| C13 | API contract | `failed` workflow re-entry without explicit trigger | No automatic retry occurs; caller must initiate a new reprocess path | Integration |

---

## 2. Test Execution Plan

| Test ID | Target Component/Interface | Scenario / Trigger | Expected Behavioral Outcome | Test Type |
| --- | --- | --- | --- | --- |
| D1 | `KnowledgeEmbeddingRunEntity` | Valid parent workflow creation | Entity is created and invariant checks pass | Unit |
| D2 | `KnowledgeEmbeddingRunEntity` | Invalid document id | Validation failure thrown | Unit |
| D3 | `KnowledgeEmbeddingRunEntity` | Valid run start | Transition to `running` succeeds | Unit |
| D4 | `KnowledgeEmbeddingRunEntity` | Retry on completed run | Guard fails and blocks retry | Unit |
| D5 | `KnowledgeEmbeddingRunEntity` | Resume partial run | Resume is allowed and current stage remains intact | Unit |
| D6 | `KnowledgeEmbeddingRunEntity` | Resume stale `running` run | Recovery path is allowed only under stale-lease rules | Unit |
| D7 | `KnowledgeDetailRunEntity` | Valid child creation | Parent-child relationship is valid | Unit |
| D8 | `KnowledgeDetailRunEntity` | Empty `runId` | Validation failure thrown | Unit |
| D9 | `KnowledgeDetailRunEntity` | Failed child retry | Retry is allowed and succeeds with incremented count | Unit |
| D10 | `KnowledgeDetailRunEntity` | Retry from non-retryable state | Guard fails | Unit |
| D11 | Parent/child validation | Inconsistent parent-child linkage | Validation fails | Unit |
| D12 | Failure reason validation | Mark run as `failed` without error text | Validation fails | Unit |
| W1 | `RagPipelineOrchestrator` | New valid document starts | Workflow becomes active and enters the next correct stage | Integration |
| W2 | `RagPipelineOrchestrator` | Validation fails | Pipeline terminates before parse/chunk | Integration |
| W3 | `RagPipelineOrchestrator` | Parse succeeds | Extracted text is persisted and next stage is reached | Integration |
| W4 | `RagPipelineOrchestrator` | Parse interruption | Resume path is used without reprocessing completed work | Integration |
| W5 | `RagPipelineOrchestrator` | Chunking partial failure | Successful chunks persist; failed chunk subset is retried | Integration |
| W6 | `RagPipelineOrchestrator` | Embedding dependency failure | Workflow stays recoverable and preserves earlier state | Integration |
| W7 | `RagPipelineOrchestrator` | Duplicate same-version request | Existing workflow is reused; no duplicate artifacts created | Integration |
| W8 | `RagPipelineOrchestrator` | Completed run re-entry | Workflow rejects restart without a new version | Integration |
| W9 | `RagPipelineOrchestrator` | Retry after partial failure | Last durable checkpoint is used for resume | Integration |
| W10 | `RagPipelineOrchestrator` | Retry for terminal `failed` row | No automatic retry occurs | Integration |
| W11 | `InMemoryWorkflowQueue` | Startup hydration from persisted data | Eligible rows are hydrated, `running` rows excluded | Integration |
| W12 | `InMemoryWorkflowQueue` | Duplicate queue event | Queue deduplicates runtime dispatch | Unit |
| W13 | `DocumentChunkingWorkflow` | Invalid stage transition | Invalid transition is rejected | Unit |
| W14 | `DocumentChunkingWorkflow` | Completed state resume attempt | Resume guard blocks transition | Unit |
| C1 | `RagPipelineOrchestrator.execute` | Valid contract input | Returns active run state | Unit |
| C2 | `RagPipelineOrchestrator.execute` | Invalid contract input | Validation failure surfaced clearly | Unit |
| C3 | `RagPipelineOrchestrator.resume` | Recoverable failure | Resume succeeds and returns usable state | Unit |
| C4 | `RagPipelineOrchestrator.resume` | Non-resumable completion | Guarded error returned/raised | Unit |
| C5 | `InMemoryWorkflowQueue.hydrateFromRuns` | Persisted rows ready for hydration | Only wanted rows are queued in memory | Unit |
| C6 | `InMemoryWorkflowQueue.subscribe` | Listener + publish event | Listener receives queued item once | Unit |
| C7 | Repository contract | Read by document version | Correct workflow record is returned | Unit |
| C8 | Repository contract | Read latest by document id | Correct latest version is returned | Unit |
| C9 | Repository contract | Upsert duplicate state | Latest persisted values replace prior ones without duplication | Unit |
| C10 | Error handling contract | Dependency failure | Error reason is persisted and surfaced consistently | Unit |
| C11 | API / workflow contract | Empty extracted text | Disallows advancement to chunking | Integration |
| C12 | API / workflow contract | Repeated same-version event | Deduplicated behavior is observed | Integration |
| C13 | API / workflow contract | `failed` workflow re-entry | No automatic retry happens without an explicit trigger | Integration |

---

## Review Gate

Please review this blueprint and confirm approval before Phase 2 begins.

If approved, the next step will be to generate the additive production contracts and red unit/integration tests covering the scenarios above, without implementing the runtime logic itself.
