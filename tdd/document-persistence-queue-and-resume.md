# Test Blueprint: Persisted Document Processing Queue and Resume

## 1. Test Scenarios & Purposes

### Domain Entity & Validation Tests

- Verify a `KnowledgeEmbeddingRun` can be created for a document with the required identity, version, initial status, and processing metadata.
- Verify invalid runs are rejected when the document identity, run identity, or required failure reason is missing.
- Verify valid lifecycle transitions: pending to running, running to completed, running to failed, and partial/failed to retryable running.
- Verify retry is rejected for completed and cancelled runs.
- Verify retry/resume requires a current processing stage where the domain invariant requires one.
- Verify failure transitions retain a non-empty error message and preserve the last durable checkpoint metadata.
- Verify document/version identity is sufficient to identify one processing run and prevent duplicate active work.

### Workflow & State Transition Tests

- Verify adding a new document creates one durable document record and one initial `KnowledgeEmbeddingRun`.
- Verify a duplicate add returns or reuses the existing run and does not publish a second queue item.
- Verify status updates affect only the targeted document/run and retain error details for failed processing.
- Verify completed processing is not automatically requeued.
- Verify pending, partial, and recoverable interrupted runs are restored to the runtime queue from durable records.
- Verify repeated foreground/startup recovery is idempotent and does not enqueue duplicate runs.
- Verify an interrupted running operation is reconciled from durable state and either resumes from its checkpoint or becomes retryable without being marked completed.
- Verify manual retry updates the run according to domain guards and publishes only the targeted run.
- Verify removing a document removes its run, document metadata, and local file reference as one logical operation.
- Verify removing an already-absent document succeeds without creating an error state.
- Verify a failed add/remove does not update the visible in-memory list, queue, database, or file state.
- Verify screen unmount/navigation does not erase durable work or cause stale asynchronous results to overwrite a later reload.

### Contract & API Surface Tests

- Validate add command input and result shape, including stable document identity, metadata, local URI, and duplicate-handling result.
- Validate document-list query results include persisted document metadata joined with current run status, current stage, checkpoint, retry count, and error details.
- Validate status-update commands require a known run/document identity and preserve the correct error contract on failure.
- Validate remove and retry commands are idempotent where specified and return actionable operation failures.
- Verify persistence failures are represented as operation failures that do not expose partial state.
- Verify recovery service results distinguish automatically resumed work from work requiring manual retry.
- Verify repository implementations do not allow screens or hooks to bypass the repository/application-service boundary with raw SQL.

## 2. Test Execution Plan

| Test ID | Target Component/Interface | Scenario / Trigger | Expected Behavioral Outcome | Test Type (Unit/Integration) |
| --- | --- | --- | --- | --- |
| DPQ-001 | `KnowledgeEmbeddingRunEntity.create` | Create a valid pending run for a document | Run is accepted with required identity, version, timestamps, and initial state | Unit |
| DPQ-002 | `KnowledgeEmbeddingRunEntity` validation | Missing run ID, document ID, or required failed error | Entity rejects invalid input with a meaningful domain error | Unit |
| DPQ-003 | `KnowledgeEmbeddingRunEntity` transitions | Start, complete, fail, resume, and retry a run | Valid transitions produce the expected status, stage, checkpoint/error, and timestamps | Unit |
| DPQ-004 | `KnowledgeEmbeddingRunEntity.validateRetryEligibility` | Retry completed, cancelled, or stage-less failed run | Retry is rejected by the domain guard | Unit |
| DPQ-005 | `KnowledgeEmbeddingRunEntity.fail` | Fail with empty error details | Failure transition is rejected and no invalid failed run is produced | Unit |
| DPQ-006 | `InMemoryWorkflowQueue` | Hydrate pending, partial, running, completed, and failed runs | Only eligible recoverable runs are queued according to the approved recovery policy | Unit |
| DPQ-007 | `InMemoryWorkflowQueue` | Publish the same run repeatedly | Queue contains one item and listeners receive one publication | Unit |
| DPQ-008 | `KnowledgeEmbeddingRunRepository` contract | Add a valid new document/run | Repository returns the persisted run and commits document metadata and processing state | Unit/Integration |
| DPQ-009 | `KnowledgeEmbeddingRunRepository` contract | Add the same document identity/version twice | Second operation is idempotent and creates no duplicate run or document | Integration |
| DPQ-010 | Atomic add coordinator | Local file save succeeds but database insert fails | Staged file is compensated; no document, run, queue, or visible in-memory change remains | Integration |
| DPQ-011 | Atomic add coordinator | Local file save fails before database commit | Database remains unchanged and operation returns a retryable failure | Integration |
| DPQ-012 | Atomic add coordinator | Database commit succeeds and queue publication fails | Durable records remain authoritative; publication can be recovered without duplicating the run | Integration |
| DPQ-013 | Status/error update contract | Processing fails for one run | Only the targeted run is updated with failed status, error details, retry count/checkpoint, and retry eligibility | Unit/Integration |
| DPQ-014 | Recovery service | App starts with pending and partial runs | Durable records are loaded and eligible runs are published once | Integration |
| DPQ-015 | Recovery service | App starts with a stale running run | Run is reconciled from its last durable checkpoint and resumed or marked retryable, never silently completed | Integration |
| DPQ-016 | Recovery service | Foreground event fires repeatedly | Recovery is serialized/deduplicated and does not create duplicate processing work | Integration |
| DPQ-017 | Manual retry contract | User retries a failed run with a valid current stage | Run transitions to retryable running state and is queued once | Unit/Integration |
| DPQ-018 | Manual retry contract | User retries completed/cancelled or invalid run | Retry is rejected with an actionable error and state remains unchanged | Unit |
| DPQ-019 | Atomic remove coordinator | Remove an existing document during pending/processing/failed state | Document, run, and local file reference are removed only after the operation commits | Integration |
| DPQ-020 | Atomic remove coordinator | File deletion or database deletion fails | Existing durable document/run state remains available for retry; no partial visible removal occurs | Integration |
| DPQ-021 | Atomic remove coordinator | Remove an already-absent document | Operation succeeds idempotently without an error state | Unit/Integration |
| DPQ-022 | SQLite migration/schema | Install migration on a fresh database | Required fields, indexes, and constraints exist and support document/run lookup | Integration |
| DPQ-023 | SQLite migration/schema | Apply migration to existing document and workflow rows | Existing rows remain readable and map to valid domain state | Integration |
| DPQ-024 | Document list query | Reload after add, status update, failure, retry, and restart | List is derived from persisted document/run data and includes current status/error details | Integration |
| DPQ-025 | Hook/application boundary | Screen mounts, unmounts, and remounts around an async mutation | Durable state survives; stale async results cannot replace the current persisted list | Unit/Integration |
| DPQ-026 | End-to-end recovery flow | Add document, interrupt processing, background/foreground app, then retry | Document reloads, resumes from the last checkpoint or presents manual retry, with no duplicate completed work | Integration |

## Test Doubles and Fixtures

- Use an in-memory `KnowledgeEmbeddingRunRepository` and `DocumentRepository` for domain and application unit tests.
- Use a file-storage test double that can independently succeed, fail, report an existing file, and record deletes/copies.
- Use the existing SQLite integration setup for migration and repository behavior; do not introduce a second database implementation.
- Create fixtures for pending, running with checkpoint, partial with error, failed with retry stage, completed, cancelled, missing-file, and duplicate document/version states.
- Make timestamps and generated run IDs injectable or deterministic in tests so idempotency and ordering assertions are stable.

## Coverage Boundaries

- The blueprint covers durable document/run persistence, queue hydration, atomic add/remove behavior, status/error visibility, retry, and foreground/restart recovery.
- It does not test cloud synchronization, visual styling, a new processing engine, or automatic retry of permanently invalid documents.
- Processing-stage internals should be tested through their existing focused suites; this feature verifies their durable lifecycle integration and recovery contract.

## Approval Gate

This is Phase 1 only. Review and approve this Test Blueprint before Phase 2 begins. After approval, generate additive contracts and executable red unit/integration tests that fail specifically because the persistence, atomicity, status/error, and recovery behavior has not yet been implemented.
