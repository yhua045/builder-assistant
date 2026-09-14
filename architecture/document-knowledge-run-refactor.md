# Feature: Document Knowledge Run Refactor

## 1. Architectural Context

### Relevant Existing Components

| Component | Responsibility | Relevance to Feature |
| --- | --- | --- |
| `src/shared/domain/entities/DocumentVersion.ts` | Represents the lifecycle of a document version and its workflow state. | This is the parent workflow record and should be renamed directly to `KnowledgeEmbeddingRun` because it is specific to the knowledge-embedding lifecycle. |
| `src/shared/domain/entities/DocumentChunkingRun.ts` | Represents a single chunking execution record for a document version. | This is the stage-level retry record and should be renamed directly to `KnowledgeDetailRun` without compatibility wrappers. |
| `src/shared/domain/repositories/DocumentChunkingWorkflowRepository.ts` | Persists workflow state and lookup by document/version. | Keep this contract as the parent/child tracking boundary, but move the entity names to the feature-specific layer and keep the repository contract narrow. |
| `src/features/knowledge-embedding/application/usecases/ChunkDocumentUseCase.ts` | Owns the current chunking stage and persists progress, retries, and checkpoint data. | This remains the relevant stage owner and should continue to manage step-level retry state beneath the parent run. |
| `src/features/knowledge-embedding/domain/repositories/ChunkDocumentProgressRepository.ts` | Stores stage-local retry and checkpoint state. | This is the minimal extension point for per-step progress and should remain in the feature-specific layer. |
| `src/shared/infrastructure/database/schema.ts` | Database schema for persisted document and knowledge artifacts. | The refactor should keep the same schema shape and only rename the logical workflow entity names; no broad persistence redesign is required. |
| `src/shared/domain/entities/KnowledgeEmbedding.ts` | Persisted embedding representation for knowledge chunks. | This remains a result entity and must stay separate from workflow state. |
| `src/features/knowledge-embedding/application/usecases/ReceiveDocumentUseCase.ts` and `ValidateDocumentUseCase.ts` | Create and advance document version state. | They are the natural callers for the parent workflow lifecycle and should remain the minimal trigger/update surface. |

### Architectural Constraints

* Preserve the existing Clean Architecture dependency direction: domain contracts remain stable, and infrastructure adapters implement storage.
* Keep the parent run responsible for the overall document knowledge lifecycle; keep stage-specific retry/progress in the child detail record.
* Prefer a direct rename over compatibility shims; do not retain both the old and new entity names unless a migration requires a temporary alias during a staged rollout.
* Keep the shared schema and persistence layer in `src/shared`, but move the renamed workflow entities into the knowledge-embedding feature boundary so the model stays specific to this workflow instead of living in the shared layer.
* Do not move persisted knowledge artifact ownership into workflow state; `KnowledgeChunk` and `KnowledgeEmbedding` remain result entities, not orchestration records.
* Continue to use the current Drizzle-backed SQLite persistence layer; avoid introducing a second persistence mechanism or workflow engine.
* Ensure the refactor remains idempotent at the chunk/embedding boundaries and does not duplicate previously completed results.

---

## 2. Proposed Architecture

### Abstract Interfaces/Contracts/DTOs Source Code Structure

The minimal-change architecture keeps the current model and renames the concepts directly so the parent/child lifecycle becomes explicit without adding compatibility indirection. The workflow entities are feature-specific, not shared-domain abstractions.

```text
src/
├── shared/
│   └── infrastructure/
│       └── database/
│           └── schema.ts                     // shared database schema remains here; this is not a feature-local concern
├── features/
│   └── knowledge-embedding/
│       ├── domain/
│       │   ├── entities/
│       │   │   ├── KnowledgeEmbeddingRun.ts    // renamed parent workflow entity
│       │   │   └── KnowledgeDetailRun.ts       // renamed child stage record
│       │   ├── repositories/
│       │   │   ├── KnowledgeEmbeddingRunRepository.ts
│       │   │   └── KnowledgeDetailRunRepository.ts
│       │   └── value-objects/
│       │       └── KnowledgeEmbeddingStep.ts
│       ├── application/
│       │   ├── usecases/
│       │   │   ├── ReceiveDocumentUseCase.ts
│       │   │   ├── ValidateDocumentUseCase.ts
│       │   │   └── ChunkDocumentUseCase.ts
│       │   └── services/
│       │       └── ...
│       └── infrastructure/
│           └── repositories/
│               ├── DrizzleKnowledgeEmbeddingRunRepository.ts
│               ├── DrizzleKnowledgeDetailRunRepository.ts
│               └── DrizzleChunkDocumentProgressRepository.ts
```

The parent entity remains the overall run owner. The child entity remains the fine-grained stage record used for retry/resume. This preserves the established runtime pattern while keeping the model local to the knowledge-embedding feature and removing legacy shared names.

### Aggregate Ownership and Validation Rules

The refactor should make `KnowledgeEmbeddingRunEntity` the aggregate root for the whole document knowledge workflow. In other words, this entity owns the lifecycle for the parent run and is the only object permitted to create or validate linked `KnowledgeDetailRun` records.

This aggregate boundary is important because it prevents invalid state transitions such as:

* a child run without a valid parent `runId`
* a child stage that references a different document or workflow than the parent
* a retry or completion operation that does not align with the parent’s active lifecycle
* a parent/child mismatch where the child stage is for `embedding` but the parent is already completed or cancelled

The aggregate should provide validation methods such as:

* `createDetailRun(stage, ...)` or equivalent aggregate-owned factory to ensure `runId` is always linked to the current parent
* `validateChildRelationship(childRun)` to confirm the child belongs to the same parent run and same document workflow
* `ensureStageProgression(currentStage, nextStage)` to guard against invalid lifecycle transitions
* `validateRetryEligibility()` to ensure a failed child detail run is retryable only when the parent is still active and the retry state is consistent

The child `KnowledgeDetailRunEntity` should remain a value object / child record with minimal validation, but it must never be created directly outside the aggregate root. The aggregate owns the consistency rules across the parent/child pair.

### Data Flow

```text
Document received
    ↓
ReceiveDocumentUseCase / ValidateDocumentUseCase
    ↓
KnowledgeEmbeddingRun (parent workflow record)
    ↓
KnowledgeDetailRun (child stage record for chunking/parsing/embedding work)
    ↓
ChunkDocumentUseCase progress repository / chunk repository
    ↓
KnowledgeChunk / KnowledgeEmbedding persisted results
```

Important transitions:

* The parent run is created when a document version enters the pipeline and is updated as the overall workflow advances.
* The aggregate root creates child detail runs only when the parent exists and the stage belongs to the same workflow; each child records stage-local state, retry count, checkpoint, and failure detail.
* Successful work remains persisted as `KnowledgeChunk` and `KnowledgeEmbedding`, while the run records only orchestrational status.
* A retry reuses the existing stage record and resumes from the last checkpoint rather than rebuilding successful items.
* Parent-child validation runs before persisting the child record to prevent orphaned or inconsistent stage state.

### State Flow

```text
Idle
 ↓
Created
 ↓
Running
 ├─ success → Completed
 ├─ partial progress → Partial
 └─ unrecoverable error → Failed

Running
 ↓
Retrying
 ↓
Running
```

The parent run should use the current lifecycle semantics already present in `DocumentVersion` and `DocumentChunkingWorkflowRecord`, but the naming should make the document-knowledge meaning explicit. The child detail run should be the small retryable step record used for stage-level progress and failure. This keeps the model simple and consistent with the current design.

---

## 4. Data / Persistence Changes

The refactor does not require a large schema redesign. The minimal design is to keep the existing persisted workflow records and rename the conceptual ownership without altering the persistence pattern.

* Parent entity: `KnowledgeEmbeddingRun` should represent the document version lifecycle and the full document chunk/embedding workflow.
* Child entity: `KnowledgeDetailRun` should represent the individual stage attempt within that workflow.
* Aggregate root: `KnowledgeEmbeddingRunEntity` owns the creation, mutation, and validation of both the parent run and all linked child detail runs.
* The old `DocumentVersion` and `DocumentChunkingRun` names should be removed as part of the rename rather than retained as compatibility aliases.
* Parent/child relationship: `KnowledgeDetailRun.runId` or equivalent parent foreign key points to the parent `KnowledgeEmbeddingRun`, and the aggregate root ensures the link is valid before persistence.
* Persistence behavior: successful child work remains durable; stage status is stored separately from `KnowledgeChunk` and `KnowledgeEmbedding` entity lifecycle.
* Validation requirements: no child run can be created without a valid parent; no parent can complete or fail in a state inconsistent with child stage outcomes; retries must be validated against the current parent lifecycle.
* Migration requirement: the persisted records should be updated in-place to the new names and responsibilities without a parallel compatibility layer.

> No persistence changes are required beyond the minimum refactor and migration of the workflow records to the new names and semantics.

---

## 5. Error Handling & Resilience

The architecture should handle the same failure modes already visible in the current pipeline, but with clearer ownership:

* Invalid input: the parent aggregate validates the workflow before the child run is created, and the child detail run captures the exact stage that could not proceed.
* Parent-child consistency: the aggregate root prevents orphaned child records, mismatched parent ids, and impossible stage transitions before mutation or persistence.
* External dependency failures: the child detail run records the stage failure while the parent remains partial or failed depending on whether the full workflow can continue.
* Duplicate requests: the workflow should detect the same document/version work already in progress or already completed and avoid creating duplicate chunk or embedding records.
* Retry behavior: the child detail run can be retried without rebuilding earlier successful work; the parent run remains the overall workflow state holder, and the aggregate validates that retry is legal for the current parent state.
* Partial failures: stages that succeeded remain durable and are not re-created; only the failed stage is retried.
* Recovery after interruption: the parent and child run records provide enough durable state to resume from the last known checkpoint rather than starting from scratch.

---

## 6. Implementation Sequence

1. Rename the existing workflow entities directly: `DocumentVersion` → `KnowledgeEmbeddingRun` and `DocumentChunkingRun` → `KnowledgeDetailRun`.
2. Make `KnowledgeEmbeddingRunEntity` the aggregate root and move the renamed entity definitions and repository contracts under the `src/features/knowledge-embedding` domain boundary, keeping the repository interfaces local to the feature.
3. Add aggregate-owned creation and validation methods so the parent aggregate is the only entry point for creating and validating child detail runs, especially for `runId` linkage and stage consistency.
4. Keep `src/shared/infrastructure/database/schema.ts` in place as the shared persistence definition while adjusting the logical workflow names and table usage to match the renamed run model.
5. Update the `ChunkDocumentUseCase` and associated progress repository to treat the child record as stage-level retry state while keeping the parent run responsible for overall workflow status and aggregate validation.
6. Add or adjust tests for duplicate detection, retry behavior, orphan prevention, parent-child mismatch prevention, partial failure, and successful resume without duplicated chunk/embedding persistence.
7. Run the focused project typecheck and the existing knowledge-embedding tests to confirm that the refactor preserves behavior with minimal churn.

Do not introduce a new workflow engine, a separate orchestration framework, or a second storage mechanism. The refactor should stay within the current architecture and use the existing document-version and chunking workflow patterns as the contract surface.

---

## Appendix: Full Retry Handling Design (Version 2)

This appendix adds the full retry-handling logic required for the parent `KnowledgeEmbeddingRun` lifecycle when the app is interrupted unexpectedly, such as a forced shutdown or process kill while a document is being processed.

### A. Retry Goal

The retry design is intended to ensure that a workflow can resume safely after interruption without duplicating work that already succeeded. The system must resume from the last durable checkpoint rather than restarting the entire document knowledge workflow from the beginning.

### B. Retry Semantics at the Run Level

At the parent `KnowledgeEmbeddingRun` level, retry is not simply a re-run of the same command. It is a recovery operation that rehydrates the latest parent state and child run records, validates the parent/child relationship, and resumes only the incomplete or failed stage.

The parent run should support these states and transitions:

```text
running
  -> partial (some stage progress persisted but workflow incomplete)
  -> failed (terminal failure after retry budget or unrecoverable issue)
  -> completed (all stages succeeded)

partial
  -> retrying
  -> running
  -> failed
  -> completed

failed
  -> retrying
  -> running
  -> failed
```

### C. Required Recovery Behavior

When the app is shut down unexpectedly:

1. The last persisted parent run record must remain durable with a `status` such as `running` or `partial`.
2. The last persisted child `KnowledgeDetailRun` record must keep the stage id, retry count, checkpoint, and failure reason if any.
3. On app start, the app loads the latest `KnowledgeEmbeddingRun` for the document and checks whether it is still in progress.
4. The workflow engine resumes only from the stage represented by the latest child run and the durable checkpoint, not from scratch.
5. Already completed units or chunk records must not be duplicated; they are identified by unit id, chunk id, or persisted checkpoint state.
6. If the parent run has no durable checkpoint, it may legitimately restart from the beginning of the current stage.

### D. Aggregate-Level Retry Contract

The aggregate root `KnowledgeEmbeddingRunEntity` should expose a recovery-oriented API such as:

```ts
interface KnowledgeEmbeddingRunEntity {
  restartOrResume(): KnowledgeEmbeddingRun;
  retryActiveStage(): KnowledgeEmbeddingRun;
  validateRetryEligibility(): void;
  createDetailRun(...): KnowledgeDetailRun;
}
```

The aggregate root is responsible for the following guard conditions:

* A retry is allowed only when the parent run is still active or in a partial state.
* A child run cannot be resumed if its `runId` does not match the parent aggregate.
* A retry cannot start while the parent is already `completed` or `cancelled`.
* A retry must not reset previously durable child progress unless the failed stage is specifically being re-run from the last checkpoint.
* A retry must increment a retry counter only when the stage is being re-attempted, not merely when the app starts up and rehydrates state.

### E. Required Parent/Child Consistency Rules

The parent aggregate must enforce these invariants before resuming or retrying:

* a `KnowledgeDetailRun` must always include a valid `runId`
* that `runId` must match the parent `KnowledgeEmbeddingRun.id`
* the retry stage must match the currently active or last failed stage in the parent record
* if the parent was marked `failed`, a retry is allowed only if the workflow is explicitly restarted and the failed stage is eligible for retry
* completion may only be set once the parent has consumed all final-stage success signals and the child-stage records agree with it

### F. Restart and Resume Algorithm

On app startup after an interruption, the recovery logic should be:

```text
Load latest KnowledgeEmbeddingRun by documentId
    ↓
If run is missing or terminal and no durable checkpoint -> start fresh
    ↓
If run.status is running or partial -> rehydrate last active stage
    ↓
Load all child KnowledgeDetailRun records for this run
    ↓
Find most recent failed or active stage
    ↓
Validate parent-child linkage
    ↓
Load checkpoint or completed-unit state from the chunk progress repository
    ↓
Resume only unfinished units/stage work
    ↓
When stage succeeds, mark child run completed and update parent aggregate
    ↓
When all required stages are complete, mark parent run completed
```

This guarantees that a force-close event does not revert already successful work and does not create duplicate knowledge chunks or embeddings.

### G. Persistence Requirements for Recovery

The app must persist enough state to resume safely:

* parent run id and document id
* parent status and current stage
* last updated timestamp
* child detail run id, stage, status, retry count, and error detail
* checkpoint identifier or last durable checkpoint marker
* completed unit ids or chunk ids for the stage being reattempted

This is the minimum durable state needed to decide whether the workflow is resumable or needs a clean retry.

### H. Failure and Retry Budget Rules

The retry model should remain conservative and minimal:

* child detail runs may retry only within a bounded number of attempts for the same stage
* when retry budget is exhausted, the parent must become `failed` and the child detail run must remain `failed`
* partial progress should not be discarded until the retry is confirmed to have started from the last valid checkpoint
* every retry operation must update the `retryCount` and `updatedAt` fields

### I. Design Decision

The full retry model is therefore designed at the aggregate level, not as a separate workflow engine. The `KnowledgeEmbeddingRunEntity` is the durable state owner and the `KnowledgeDetailRunEntity` is the stage-specific retry record. This preserves the current architecture while providing the needed crash-recovery semantics for force shutdowns.

### J. Implementation Guidance

When the implementation phase begins, the coders should treat the following as the required behavior:

1. Resume the active parent run after an app restart.
2. Restore the latest checkpoint before re-running a failed stage.
3. Prevent orphaned child runs.
4. Ensure retry operations are parent-valid and stage-valid.
5. Never duplicate previously persisted knowledge chunks or embeddings.
6. Keep the retry logic local to the knowledge-embedding feature and reuse the existing workflow checkpoint repository rather than introducing a new orchestration store.

This appendix should be read as the concrete recovery specification for the parent and child run refactor described in the main body of the document.

---

## Appendix: Concurrency, Queue Ordering, and Queue Persistence (Version 3)

This appendix addresses the additional concurrency requirement: when a failed embedding task is being retried, the user may upload new documents at the same time. In that situation, the system must manage multiple active and queued embedding jobs without creating duplicate processing, without losing work on interruption, and without relying on an in-memory queue as the single source of truth.

### A. Scheduling Model

The queue should not be a plain FIFO queue for all items. The system should instead use a priority-based queue with classes, where ordering is:

1. recovery / retry jobs with persisted checkpoint state
2. interrupted or partial runs that can resume safely
3. fresh user uploads
4. low-priority background items

Within each class, the queue should be processed in FIFO order. However, once a task has started, it should not be interrupted by a higher-priority task that arrives later. This is important because interrupting a running embedding job can create inconsistent partial state and duplicate persisted chunks.

### B. Why Not Simple FIFO

A raw FIFO queue is not safe for this workflow because it treats all tasks as equal even though retry work is higher value than a brand-new upload. A retry task usually represents partially completed work and a durable checkpoint, so it should not be starved behind a newer task.

At the same time, a “new upload always wins” policy is also not correct because it may allow newer work to bypass partially completed recovery jobs. The scheduler must give precedence to resume/retry work while still allowing new user uploads to flow through eventually.

### C. Queue Persistence and Recovery

The queue should be treated as a derived runtime structure, not as the authoritative state. The authoritative state is the persisted `KnowledgeEmbeddingRun` plus the related child `KnowledgeDetailRun` records.

That means:

* the queue is rebuilt from persisted run records after app startup
* the queue does not rely solely on in-memory tasks surviving a crash
* the database is the durable source of truth for queued, running, partial, failed, and retryable tasks

This is crucial because a forced shutdown or app kill can discard the in-memory queue even though the run state still exists in persistence.

### D. Reconstruction from Persisted Run State

When the process restarts, the app should reconstruct the queue by reading all persisted `KnowledgeEmbeddingRun` records and classifying them by state:

* `running` / `partial` → recovery queue
* `failed` with retryable state → retry queue
* `pending` or newly created → new upload queue
* `completed` / `cancelled` → not queued

For each record, the app should then look up its child `KnowledgeDetailRun` entries to determine:

* which stage was last active
* retry count
* checkpoint marker
* failure reason
* whether work should resume from a saved checkpoint or start from the beginning of the stage

This process lets the application rebuild the scheduling backlog after an interruption without losing queued work.

### E. Persistence Requirements for the Queue

The system must persist enough information to reconstruct queue order and retry eligibility:

* run id and document id
* parent status and current stage
* child run status and retry count
* checkpoint id / last durable checkpoint marker
* `updatedAt` and `createdAt`
* last error or failure summary
* whether the item is retryable or terminal

This should be stored in the same durable run records and not in a separate queue table unless a later implementation specifically requires one. The simplest minimal design is to treat the `KnowledgeEmbeddingRun` table as the durable scheduler state and reconstruct the queue from it.

### F. Concurrency and Duplicate Prevention

If multiple workers are allowed in the future, then the queue and run records must include concurrency guards:

* a run can have only one active processor at a time
* a worker must claim a run before starting work
* the claim must be persisted or verified against the current run state
* retry tasks and new uploads must not both run the same run concurrently

This prevents double-processing of a single document and avoids races between a retry job and a new upload for the same document or stage.

### G. Recommended Decision

The recommended design is:

* one global queue for embedding tasks
* class-based priority ordering instead of strict FIFO
* retry/recovery tasks always prioritized ahead of fresh uploads when they have checkpoint state
* the persisted run records as the authoritative queue source
* in-memory queue as a transient scheduler view only

This minimizes duplicate work, preserves resume correctness after crash recovery, and allows the system to handle overlapping new uploads while older retry tasks are still outstanding.

This appendix should be read as the concurrency and crash-recovery specification that complements the parent/child run refactor and the retry logic described in the earlier sections.

---

## Proposed Implementation Plan to Close the Remaining Gaps

This section is a practical execution plan to finish the refactor in a way that matches the approved design without introducing a second workflow engine or persistence layer.

### 1. Align the model to the intended aggregate boundary

- Keep `KnowledgeEmbeddingRunEntity` as the aggregate root for the document knowledge workflow.
- Keep `KnowledgeDetailRunEntity` as the child stage record used for retry and checkpoint tracking.
- Treat the existing `document_chunking_workflows` record as the persisted form of the parent aggregate, not as a separate concept.
- Remove the old shared naming from the feature-level vocabulary so the domain model is specific to knowledge embedding rather than generic chunking.

### 2. Add the missing retry and resume API explicitly

The runtime should expose the operations described in the appendix, even if they are thin wrappers over the current persistence and state model:

- `restartOrResume()` for resuming an interrupted parent run
- `retryActiveStage()` for retrying the currently active or failed child stage
- `validateRetryEligibility()` for enforcing parent/child validity before retry
- `createDetailRun(...)` for parent-owned child creation only

These methods should enforce:

- the parent must still be active or partial
- the child `runId` must match the parent
- retry is only allowed for an eligible stage
- `completed` and `cancelled` runs cannot be retried

### 3. Reconcile persistence with the feature model

- Keep the database schema in `src/shared/infrastructure/database/schema.ts` as the durable source of truth.
- Keep the `document_chunking_workflows` table as the persisted parent workflow record, but interpret it as the `KnowledgeEmbeddingRun` storage model.
- Keep `chunk_document_progress` as the recovery checkpoint for stage-local progress and completed-unit tracking.
- Treat `knowledge_chunks` and `knowledge_embeddings` as result artifacts only; they remain outside the run lifecycle ownership boundary.
- Do not create a second queue store or a second orchestration database.

### 4. Implement recovery around durable checkpoint state

- On startup, load the latest workflow record by document id/version.
- If the parent is `running` or `partial`, rehydrate the most recent child stage and checkpoint.
- Resume only unfinished work from `chunk_document_progress` rather than reprocessing already persisted chunks.
- Only mark the run as `completed` when the parent and child stage records agree that the workflow is done.

### 5. Add or update focused tests before finalizing the refactor

The tests should cover:

- parent-child linkage validation
- retry eligibility for failed/partial stages
- duplicate processing prevention
- resume after interruption using `chunk_document_progress`
- no duplicate chunk or embedding persistence on retry
- invalid transitions that would create orphaned child records

### 6. Validation gate

Before the refactor is considered complete, the project should pass:

- TypeScript check: `npx tsc --noEmit`
- Knowledge embedding test slice: `npx jest src/features/knowledge-embedding/tests --runInBand`

### 7. Recommended implementation sequence

1. Add the missing aggregate-level retry APIs to `KnowledgeEmbeddingRunEntity`.
2. Add the parent/child eligibility checks and retry guard logic.
3. Update the chunk use case to reuse the existing checkpoint repository as the resumption source.
4. Add integration coverage for partial-run recovery and deduplication.
5. Run the focused verification commands and fix any mismatches before closing the feature.

This plan keeps the refactor within the approved architecture: one durable workflow model, one persistence layer, and one feature-owned aggregate boundary, with recovery logic local to the knowledge-embedding feature rather than in a separate orchestration subsystem.

---

## Final Design Decision: Step-Level Retry Only

This refactor should not keep a separate `chunk_document_progress` table.

The requirement is to retry or resume at the individual step level, not at the page/unit/chunk checkpoint level. For that reason, the durable resume state belongs on the parent `KnowledgeEmbeddingRun` and the child `KnowledgeDetailRun` records, not in a separate unit-granularity checkpoint ledger.

### Decision

- Remove `chunk_document_progress` from the persistence model.
- Treat `KnowledgeEmbeddingRun` as the durable workflow owner for the full document lifecycle.
- Treat `KnowledgeDetailRun` as the durable record for the currently active or failed step.
- Track only step-level retry state in the detail record: stage, status, retry count, checkpoint marker, failure detail, and `updatedAt`.
- Keep `knowledge_chunks` and `knowledge_embeddings` as persisted results only; they are artifacts, not orchestration state.

### Rationale

A page-level or unit-level checkpoint ledger introduces a second source of truth for resume state. That conflicts with the intended design, where the parent/child run records are the authoritative workflow state. Since the system only needs to recover a step, not to reconstruct every completed sub-unit, the extra table adds complexity without improving correctness.

### Resulting model

```text
KnowledgeEmbeddingRun (workflow owner)
  └── KnowledgeDetailRun (active/failed step owner)

KnowledgeChunk / KnowledgeEmbedding
  └── persisted outputs only
```

This keeps the model simpler, preserves idempotency, and aligns the persistence schema with the actual recovery requirement: resume from the last step, not from a granular per-unit checkpoint table.
