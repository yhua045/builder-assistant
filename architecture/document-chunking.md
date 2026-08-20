# Feature: Document Chunking

## 1. Architectural Context

### Relevant Existing Components

| Component | Responsibility | Relevance to Feature |
| ----------- | ---------------- | -------------------- |
| [src/features/knowledge-embedding/application/ReceiveDocumentUseCase.ts](../src/features/knowledge-embedding/application/ReceiveDocumentUseCase.ts) | Creates a new document workflow record when a document is accepted for processing. | Establishes the versioned workflow checkpoint that the chunking feature must attach to. |
| [src/features/knowledge-embedding/application/ValidateDocumentUseCase.ts](../src/features/knowledge-embedding/application/ValidateDocumentUseCase.ts) | Validates the document type and size and persists the result for the current version. | This is the prior gate that must pass before chunking starts; it defines the validated-only trigger and the failure state. |
| [src/shared/domain/entities/DocumentVersion.ts](../src/shared/domain/entities/DocumentVersion.ts) | Represents a document version and workflow state. | The feature should treat chunking as a version-level state transition, not a document-wide operation. |
| [src/shared/domain/services/DocumentChunkingWorkflow.ts](../src/shared/domain/services/DocumentChunkingWorkflow.ts) | Defines the xstate workflow for document processing. | Provides the established state model for `received`, `validation_passed`, `chunking_in_progress`, `completed`, `failed`, and retry/supersede transitions. |
| [src/shared/domain/services/DocumentChunkingService.ts](../src/shared/domain/services/DocumentChunkingService.ts) | Defines the chunking contract and configuration. | This is the natural extension point for deterministic splitting logic without introducing a new abstraction. |
| [src/shared/application/services/DocumentChunkingService.ts](../src/shared/application/services/DocumentChunkingService.ts) | Default implementation of deterministic chunk splitting using text boundaries. | This is the existing chunking engine that should be reused for the validated source text. |
| [src/shared/domain/entities/KnowledgeChunk.ts](../src/shared/domain/entities/KnowledgeChunk.ts) | Domain model for chunk records and version metadata. | Provides the required ownership fields for document versioning and supersession. |
| [src/shared/domain/repositories/DocumentChunkingWorkflowRepository.ts](../src/shared/domain/repositories/DocumentChunkingWorkflowRepository.ts) | Repository contract for workflow checkpoint persistence. | Defines the durable checkpoint responsibility the feature should continue to satisfy. |
| [src/shared/infrastructure/repositories/DrizzleDocumentChunkingWorkflowRepository.ts](../src/shared/infrastructure/repositories/DrizzleDocumentChunkingWorkflowRepository.ts) | Drizzle-backed implementation of the workflow repository. | Reusable persistence layer for the current document version state and retry audit. |
| [src/shared/infrastructure/repositories/DrizzleChunkRepository.ts](../src/shared/infrastructure/repositories/DrizzleChunkRepository.ts) | Chunk persistence repository for persisted knowledge chunks. | Closest existing implementation for saving and retrieving chunks, but it requires version-aware and supersession semantics that are not yet fully aligned with the current schema. |
| [src/shared/infrastructure/database/schema.ts](../src/shared/infrastructure/database/schema.ts) | Shared SQLite schema for workflow and chunk records. | This is the exact persistence boundary that must accommodate chunk records and workflow history for document versions. |

### Architectural Constraints

* The project already uses a repository abstraction for workflow checkpoints instead of direct database access inside use cases.
* Validation is already modeled as a distinct state transition before downstream processing; chunking should not bypass that gate.
* The existing system treats document processing as version-aware state, so the feature must be keyed by `documentId + documentVersion` rather than a document-wide aggregate.
* The current chunking logic already exists in the shared application layer and should be reused rather than replaced with a new chunking engine.
* The project uses Drizzle SQLite persistence and xstate workflow state; the feature should follow those patterns instead of introducing a new framework or new infrastructure layer.

---

## 2. Proposed Architecture

### Data Flow

```text
Document validation succeeds
    ↓
Read source artifact / extract raw text
    ↓
rawText
    ↓
DefaultDocumentChunkingService.chunkDocument({ rawText, ... })
    ↓
Chunk record set for document version
    ↓
DrizzleChunkRepository / SQLite persistence
    ↓
Workflow checkpoint updated to chunked / failed / superseded
```

The feature should sit directly after validation and before any downstream embedding or retrieval work. The key transition is: validated document version -> read/extract raw text -> chunking run -> persisted chunk records. The validation use case already persists a workflow checkpoint and marks the version as valid; the chunking feature should reuse that checkpoint as the authoritative start condition and update it to `chunking_in_progress`, `chunking_complete`, `failed`, or `superseded` as the run progresses.

The content-read step should be responsible for reading the stored source artifact and handing a raw text payload to the chunking stage. The chunking engine should not read from storage or know about the file system; it should operate on already-resolved text only, with the file layer injected at the orchestration/use-case level. Its output should be a deterministic sequence of chunk records, each carrying enough metadata to identify the owning document version and the ordering within that version. The chunk repository should persist the active set for the current version and update prior versions to a superseded state when a retry or re-run occurs.

### State Flow

```text
received
 ↓
validation_pending
 ↓
validation_passed
 ↓
chunking_in_progress
 ↓
chunking_complete
 ↓
completed

chunking_in_progress
 ↓
failed

chunking_complete
 ↓
superseded
```

The state machine should remain aligned with the current workflow model in [src/shared/domain/services/DocumentChunkingWorkflow.ts](../src/shared/domain/services/DocumentChunkingWorkflow.ts). The critical rule is that only a version in `validation_passed` can enter `chunking_in_progress`. A failed attempt should not change the version into a successful chunked state, and a retry should reuse the same versioned identity while replacing or superseding the prior active output rather than creating overlapping active chunks.

---

## 5. Data / Persistence Changes

The feature does not require a new persistence technology, but it does require the existing chunk and workflow persistence contracts to support version-aware chunk generation and retry semantics.

* Introduce a clear content-read/extraction step before chunking so the chunker receives `rawText` rather than a file/storage dependency.
* Extend the existing chunk persistence model so each chunk record is explicitly associated with the owning `documentId` and `documentVersion`.
* Ensure the workflow checkpoint persists the current run state, retry count, last event, and failure reason for the validated version.
* Preserve the “active chunk set” semantics: a successful run for a version should leave that set as the only active chunk set for that version.
* On re-run or retry, previous chunks for the same `documentId + documentVersion` should be either replaced or marked as superseded rather than left active concurrently.
* Record sufficient metadata to support auditability: chunk ordering, content boundaries, run outcome, and the last failure reason when processing stops early.
* Keep the document version state separate from the raw chunk rows so a later version does not accidentally reuse earlier chunk records.
* Keep the file/storage boundary outside the chunking domain contract so chunking remains independently unit-testable and not coupled to the filesystem.

Required persistence adjustments should be limited to the shared chunk/workflow boundary already represented in [src/shared/infrastructure/database/schema.ts](../src/shared/infrastructure/database/schema.ts), [src/shared/domain/entities/KnowledgeChunk.ts](../src/shared/domain/entities/KnowledgeChunk.ts), and [src/shared/domain/repositories/DocumentChunkingWorkflowRepository.ts](../src/shared/domain/repositories/DocumentChunkingWorkflowRepository.ts). The current code already hints at a version-aware chunk model, but the concrete schema and repository mapping still need to be aligned with the approved requirements so that retries and version lineage are durable and observable.

> No new database technology is required. The feature should reuse the Drizzle SQLite persistence layer and strengthen the existing document/chunk workflow contracts.

---

## 6. Error Handling & Resilience

The feature should handle the failure modes already implied by the existing workflow model and the requirement document.

* Invalid input: if the document does not pass validation, no chunk records are created and the version is not marked as chunked.
* Missing or unreadable artifact: the run records the dependency failure and leaves the version in a non-chunked state until the artifact is recoverable.
* Partial failure: when chunk generation fails mid-run, the system preserves the execution record and last known state so the version can be retried without losing lineage.
* Duplicate requests: repeated chunking requests for the same `documentId + documentVersion` must resolve to one active chunk set; no overlapping active chunk records should remain.
* Retry behaviour: retries should reuse the same logical version identity and replace the previous active chunk set or mark it as superseded in a deterministic order.
* Timeout or dependency outage: the system should surface a run-level failure, avoid marking the version as successfully chunked, and leave the last persisted state intact for recovery.
* Cancellation or interruption: if processing stops before completion, the version remains in a recoverable state rather than a false-success state.

This should be handled at the repository and workflow boundary rather than in the calling UI or downstream embedding layers. The system must be observably safe to retry without duplicating or corrupting the historical chunk lineage for the version.

---

## 11. Implementation Sequence

1. Confirm the current versioned workflow state and identify the exact validation-to-chunking transition in the existing document processing flow.
2. Add the preceding content-read / extraction step so the workflow resolves the stored source artifact into `rawText` before chunking begins.
3. Update the chunk domain contract and repository contract so a chunk is explicitly version-aware and can be marked as superseded or replaced.
4. Align the SQLite schema and Drizzle repository mapping with the version-aware chunk and workflow requirements, without creating a new persistence abstraction.
5. Reuse the existing chunking service for deterministic text splitting and ensure it is invoked only when validation has succeeded for the specific document version and a valid `rawText` payload is available.
6. Update the workflow state transitions to cover `chunking_in_progress`, `chunking_complete`, `failed`, and `superseded` transitions while preserving the existing state machine structure.
7. Add the retry-safe persistence rule so duplicate requests replace or supersede the prior active set for the same version.
8. Validate the behavior with focused workflow and repository tests covering success, validation failure, retry, and partial failure scenarios.

---

## 15. Implementation Guardrails

* Reuse the existing workflow and chunking contracts in [src/shared/domain/services/DocumentChunkingWorkflow.ts](../src/shared/domain/services/DocumentChunkingWorkflow.ts), [src/shared/domain/services/DocumentChunkingService.ts](../src/shared/domain/services/DocumentChunkingService.ts), and [src/shared/domain/entities/KnowledgeChunk.ts](../src/shared/domain/entities/KnowledgeChunk.ts).
* Keep the chunking service as a pure text-based component; it should accept `rawText` and not read files or storage directly.
* Put file reading / source artifact access in the orchestration layer or a dedicated document content adapter, not inside the chunker.
* Do not introduce a new state management library or a new chunking framework.
* Keep chunking scoped to the validated document version and do not process any later or earlier version as part of the same run.
* Do not mark a version as chunked unless the chunk set has been successfully persisted.
* Do not create duplicate active chunk records for the same version when retries occur.
* Do not modify unrelated project modules or broaden the scope into embedding, ranking, retrieval, or UI behavior.
* Do not implement anything that is explicitly out of scope for the approved feature requirements.
* Keep the implementation aligned with the existing repository + Drizzle persistence pattern already used across the application.
