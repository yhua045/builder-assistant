# Test Blueprint: RAG Duplicate Analysis and Failed-Upload Retry Policy

## 1. Test Scenarios & Purposes

### 1.1 Domain Entity & Validation Tests

Purpose: verify that workflow status semantics distinguish successful analysis from retryable or in-progress work.

- Confirm `completed` is the only `KnowledgeEmbeddingRunStatus` that represents reusable successful analysis.
- Confirm `completed` qualifies a checksum-matched document as already analyzed, while `pending` and `running` qualify it as an already queued duplicate rather than reusable analysis.
- Confirm `failed`, `partial`, and `cancelled` do not qualify a checksum-matched document as already analyzed or queued.
- Confirm a completed run remains terminal for explicit retry and cannot be restarted through the existing retry guard.
- Confirm a partial or failed run retains its current stage, error, retry count, and checkpoint information when a new upload is accepted.
- Confirm a new retry upload receives an independent document/workflow identity and does not mutate the prior failed or partial run.
- Confirm `ragSourceDocumentId` can only point to a completed source workflow.

### 1.2 Workflow & State Transition Tests

Purpose: verify content-level duplicate decisions, queue side effects, and existing same-run idempotency.

| Test ID | Target Component/Interface | Scenario / Trigger | Expected Behavioral Outcome | Test Type |
| --- | --- | --- | --- | --- |
| W1 | `KnowledgeEmbeddingDocumentService.addDocument` | No existing document has the submitted checksum | A new document and pending workflow are persisted; one queue item is published | Unit |
| W2 | `KnowledgeEmbeddingDocumentService.addDocument` | Matching checksum has a `completed` workflow | New document is persisted as a duplicate linked to the completed source; result is `alreadyHandled: true`; no new queue item is published | Unit/Integration |
| W3 | `KnowledgeEmbeddingDocumentService.addDocument` | Matching checksum has a `failed` workflow | New independent document/workflow is persisted; `ragSourceDocumentId` is absent; new run is queued | Unit |
| W4 | `KnowledgeEmbeddingDocumentService.addDocument` | Matching checksum has a `partial` workflow | New independent document/workflow is persisted; original partial run remains unchanged; new run is queued | Unit |
| W5 | `KnowledgeEmbeddingDocumentService.addDocument` | Matching checksum has a `cancelled` workflow | New independent document/workflow is persisted and queued | Unit |
| W6 | `KnowledgeEmbeddingDocumentService.addDocument` | Matching checksum has `pending` or `running` workflow | Upload is reported as a queued duplicate; no new document/workflow or queue item is created, and the source is not linked as reusable RAG until it completes | Unit/Integration |
| W7 | `KnowledgeEmbeddingDocumentService.addDocument` | Same `(documentId, documentVersion)` request is submitted twice | Existing intake is returned idempotently; no second document/workflow or queue item is created | Unit |
| W8 | `KnowledgeEmbeddingDocumentService.addDocument` | Same checksum exists in one project but completed content belongs to another duplicate scope | Upload is allowed when the existing scope rules say the completed source is not reusable | Integration |
| W9 | `KnowledgeEmbeddingDocumentService.addDocument` | Multiple documents share a checksum and one matching workflow is completed | Completed source is selected deterministically; failed/partial candidates do not cause a false block | Unit/Integration |
| W10 | `RagPipelineOrchestrator` / `KnowledgeEmbeddingQueueConsumer` | Same run ID is published repeatedly | Runtime queue/consumer processes the run at most once concurrently | Unit |
| W11 | `RagPipelineOrchestrator` | Existing document run is `partial` and explicit resume is requested | Existing run resumes from its durable current stage; no new document is created | Unit/Integration |
| W12 | `RagPipelineOrchestrator` | Existing document run is `completed` and execution is requested again | Completed run is returned without requeue or restart | Unit/Integration |
| W13 | `RagPipelineOrchestrator` | Existing document run is `failed` and automatic execution is requested | Existing terminal state is not silently converted into a successful or duplicate run; caller must use the supported retry/re-upload path | Unit |
| W14 | `KnowledgeEmbeddingDocumentService` | New upload persistence fails after file copy | Staged file is compensated; no visible document, workflow, or queue item remains | Integration |

### 1.3 Contract & API Surface Tests

Purpose: verify the public service results, repository lookup expectations, and error behavior needed to make the status-aware rule observable.

| Test ID | Target Component/Interface | Scenario / Trigger | Expected Behavioral Outcome | Test Type |
| --- | --- | --- | --- | --- |
| C1 | `KnowledgeEmbeddingDocumentMutationResult` | Successful new upload | Returns `alreadyHandled: false` and the new pending run/document identity | Unit |
| C2 | `KnowledgeEmbeddingDocumentMutationResult` | Completed duplicate upload | Returns `alreadyHandled: true`, the duplicate document view, and completed-source linkage | Unit |
| C3 | `DocumentChunkingWorkflowRepository` | Lookup for a checksum-matched document | Service distinguishes reusable `completed`, queued `pending`/`running`, and retryable `partial`/`failed`/`cancelled` states | Unit/Integration |
| C4 | `DocumentRepository.findAll` | Lookup by checksum with multiple candidate documents | All relevant same-content documents are considered before choosing a reusable completed source | Unit |
| C5 | `KnowledgeEmbeddingDocumentService.retryDocument` | Retry `partial` or eligible `failed` run | Existing run transitions to a retryable running state and publishes exactly one queue item | Unit |
| C6 | `KnowledgeEmbeddingDocumentService.retryDocument` | Retry `completed` or `cancelled` run | Operation rejects with the existing non-retryable guard and leaves state unchanged | Unit |
| C7 | Persistence error contract | Workflow status lookup fails during duplicate decision | Intake fails safely; it does not assume successful analysis or silently block/allow based on incomplete data | Unit |
| C8 | Duplicate scope contract | Completed same checksum outside the applicable scope | Result follows the configured project/document scope rather than globally blocking all matching files | Integration |
| C9 | Queue side-effect contract | Completed duplicate is accepted as a metadata row | No queue publication occurs for the completed duplicate | Unit |
| C10 | Queue side-effect contract | Failed/partial duplicate is accepted as a new attempt | Exactly one new queue item references the new run ID | Unit |

### Existing Test Updates Required

- Update `src/features/knowledge-embedding/tests/unit/KnowledgeEmbeddingDocumentService.red.test.ts` so its current pending-duplicate expectation asserts queued-duplicate behavior: no new queue item, no new workflow, and no reusable-source link before completion. Add explicit completed, failed, partial, and cancelled fixtures.
- Retain the existing completed-source reuse assertion, but make the source workflow status explicit and assert no new queue publication.
- Add assertions that failed and partial same-checksum uploads have no `ragSourceDocumentId`, preserve the original workflow, and create independent queued runs.
- Extend `src/features/knowledge-embedding/tests/unit/RagPipelineOrchestrator.test.ts` only for same-run terminal/retry guards; do not use it to test checksum duplicate policy because that decision belongs to document intake.
- Extend `src/features/knowledge-embedding/tests/integration/RagPipelineOrchestrator.integration.test.ts` with durable status fixtures where the completed run is not requeued and retryable work remains resumable.
- Preserve `KnowledgeEmbeddingQueueConsumer.test.ts` coverage for concurrent duplicate events; this is runtime run-ID de-duplication and is distinct from content-level duplicate analysis.

## 2. Test Execution Plan

| Test ID | Target Component/Interface | Scenario / Trigger | Expected Behavioral Outcome | Test Type (Unit/Integration) |
| --- | --- | --- | --- | --- |
| D1 | `KnowledgeEmbeddingRunEntity` | Create valid runs for each lifecycle status | Status values are accepted and preserve required identity/stage invariants | Unit |
| D2 | `KnowledgeEmbeddingRunEntity.retryActiveStage` | Retry completed or cancelled run | Domain guard rejects retry and preserves terminal state | Unit |
| D3 | `KnowledgeEmbeddingRunEntity` | Partial/failed run receives a separate re-upload | Original run's status, stage, error, checkpoint, and retry count remain unchanged | Unit |
| W1 | `KnowledgeEmbeddingDocumentService.addDocument` | First upload with unique checksum | New document/workflow is persisted and one pending run is queued | Unit |
| W2 | `KnowledgeEmbeddingDocumentService.addDocument` | Completed same-checksum source | Duplicate is linked to completed source, marked already handled, and not queued | Unit/Integration |
| W3 | `KnowledgeEmbeddingDocumentService.addDocument` | Failed same-checksum source | New independent attempt is persisted and queued | Unit |
| W4 | `KnowledgeEmbeddingDocumentService.addDocument` | Partial same-checksum source | New independent attempt is persisted and queued; old partial attempt remains resumable | Unit |
| W5 | `KnowledgeEmbeddingDocumentService.addDocument` | Cancelled same-checksum source | New attempt is accepted and queued | Unit |
| W6 | `KnowledgeEmbeddingDocumentService.addDocument` | Pending/running same-checksum source | Existing queued duplicate is returned; no new document/workflow or queue item is created, and no reusable-source link is set | Unit/Integration |
| W7 | `KnowledgeEmbeddingDocumentService.addDocument` | Exact same document ID/version replay | Operation is idempotent and does not create a second workflow | Unit |
| W8 | `KnowledgeEmbeddingDocumentService.addDocument` | Multiple same-checksum candidates | Only a completed candidate can deny analysis; selection is deterministic | Unit/Integration |
| W9 | Scope-aware duplicate lookup | Completed match outside scope | Upload is not globally blocked | Integration |
| W10 | `KnowledgeEmbeddingDocumentService.retryDocument` | Explicit retry of partial/failed run | Existing run resumes and is queued once | Unit |
| W11 | `KnowledgeEmbeddingDocumentService.retryDocument` | Explicit retry of completed/cancelled run | Guard error is raised; no state or queue mutation occurs | Unit |
| W12 | `RagPipelineOrchestrator.execute` | Re-enter completed run | Existing completed run is returned without restarting or publishing | Integration |
| W13 | `RagPipelineOrchestrator.resume` | Resume partial run | Existing checkpoint/stage is used and no replacement document is created | Unit/Integration |
| W14 | `KnowledgeEmbeddingQueueConsumer` | Duplicate queue events for one run | Same run is not processed concurrently | Unit |
| W15 | Persistence boundary | Status lookup or workflow persistence fails | Intake fails safely and does not create an unsafe duplicate decision or orphaned queue item | Unit/Integration |
| W16 | File/database compensation | New retry upload fails during persistence | New artifacts are compensated; prior failed/partial run remains intact | Integration |

## Test Fixtures and Doubles

- Build a reusable document/workflow fixture factory for `completed`, `failed`, `partial`, `pending`, `running`, and `cancelled` statuses, including queue-publication spies and source-link assertions.
- Use distinct document IDs with the same checksum to model re-uploaded files; use the same document ID/version only for exact intake replay tests.
- Use an in-memory `DocumentRepository`, workflow repository, and queue spy for service unit tests.
- Use the existing SQLite integration setup for durable repository/status lookup behavior; do not introduce a second persistence mechanism.
- Record queue publications by run ID so tests can distinguish no publication for completed or queued duplicates, one new publication for failed/partial/cancelled re-uploads, and duplicate publication attempts.
- Keep file-storage doubles able to simulate successful copy, checksum generation, database failure, and cleanup.

## Coverage Boundaries

- This blueprint covers content-level duplicate decisions, retryable re-uploads, completed-result reuse, workflow status guards, queue side effects, scope behavior, and persistence compensation.
- It does not introduce or test a new PDF parser, embedding provider, cloud synchronization flow, or visual UI behavior.
- Existing stage-specific parsing, chunking, embedding, and queue concurrency suites remain responsible for their internals; this feature tests their lifecycle integration only.

## Review Gate

This is Phase 1 only. Please review and approve this Test Blueprint before Phase 2 begins.

After approval, Phase 2 will update the existing de-duplication tests and add executable red unit/integration tests for the approved scenarios. No concrete application logic should be implemented during Phase 2 beyond additive contracts or signature-only changes required for the tests to compile.
