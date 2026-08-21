# Feature: SQLite Persistence

## 1. Architectural Context

### Relevant Existing Components

| Component | Responsibility | Relevance to Feature |
| ----------- | ---------------- | -------------------- |
| src/features/knowledge-embedding/application/ReceiveDocumentUseCase.ts | Creates a document workflow record and persists checkpoint state. | Uses the repository interface as the persistence boundary for the feature. |
| src/features/knowledge-embedding/application/ValidateDocumentUseCase.ts | Validates document support and writes the resulting workflow checkpoint. | Validates the repository contract and expected read/write behavior after restart. |
| src/features/knowledge-embedding/infrastructure/repository/InMemoryDocumentChunkingWorkflowRepository.ts | In-memory implementation of the workflow repository. | This is the component that must be replaced with a SQLite-backed repository for real persistence. |
| src/shared/domain/repositories/DocumentChunkingWorkflowRepository.ts | Repository contract for workflow checkpoint storage. | Defines the contract the SQLite implementation must satisfy without changing use-case behaviour. |
| src/shared/infrastructure/repositories/DrizzleDocumentChunkingWorkflowRepository.ts | Existing Drizzle-backed implementation for the same repository contract. | This is the closest reusable implementation and should be aligned with the feature’s repository needs. |
| src/shared/infrastructure/database/schema.ts | Shared SQLite schema for persisted app state. | Declares the table and columns supporting workflow checkpoints. |
| src/features/knowledge-embedding/tests/integration/DocumentReceiveValidate.integration.test.ts | Existing feature-level contract tests. | Should be preserved and extended to validate SQLite-backed persistence semantics. |

### Architectural Constraints

* The current feature uses repository interfaces rather than direct SQLite calls inside use cases.
* The migration should preserve the existing pattern of using a shared repository contract plus a concrete infrastructure implementation.
* The repository layer is intentionally limited to the knowledge-embedding workflow checkpoint state; it should not expand into unrelated app persistence concerns.
* The implementation should minimize scope by reusing the existing Drizzle pattern already used elsewhere in the app instead of introducing a new persistence framework or custom storage layer.

---

## 2. Proposed Architecture

### Data Flow

```text
ReceiveDocumentUseCase / ValidateDocumentUseCase
    ↓
DocumentChunkingWorkflowRepository
    ↓
DrizzleDocumentChunkingWorkflowRepository
    ↓
SQLite: document_chunking_workflows
```

The important transition is from feature use cases to the repository abstraction. The use cases already depend on the repository interface and do not contain persistence logic themselves. The SQLite implementation should therefore sit behind that interface and map the in-memory record model to the existing `document_chunking_workflows` table without altering the use-case contract.

### State Flow

```text
Idle
 ↓
Received
 ↓
Validated / Failed
 ↓
Stored checkpoint
 ↓
Restarted / Rehydrated
```

The feature’s state is a workflow checkpoint keyed by `documentId` and `documentVersion`. Each write should update the latest known checkpoint state, and the repository should be able to read the most recent version for a document or a specific version to support validation and restart recovery.

---

## 5. Data / Persistence Changes

No new domain entity is required for this repository-only change. The repository should continue to use the existing `DocumentChunkingWorkflowRecord` shape and the shared persistence table already declared in the schema.

Required persistence handling:

* Persist progression from `received` through `validated` or `failed` checkpoint states.
* Preserve `documentId`, `documentVersion`, `projectId`, `status`, `workflowState`, and timestamps.
* Store optional fields such as `checkpointId`, `lastEvent`, `retryCount`, `validationReason`, `supportedForAnalysis`, and resume flags.
* Use `upsert` semantics keyed by `documentId + documentVersion` so repeated calls for the same version replace the stored checkpoint instead of creating duplicates.
* Support `findByDocumentVersion`, `findLatestByDocumentId`, and `findByStatus` using repository queries that match the current interface contract.

If the schema already contains the `document_chunking_workflows` table, no migration is required beyond verifying that all fields align with the record contract. If a field is missing or an enum differs, the migration should be limited to the repository’s table definition and not broader feature changes.

---

## 6. Error Handling & Resilience

* Invalid input: the repository should not accept malformed record payloads; validation should happen before persistence in the use case or upstream call.
* Partial writes: writes should be atomic at the repository boundary to avoid leaving a halfway-written checkpoint record.
* Duplicate requests: repeated writes for the same `documentId` and `documentVersion` should replace the earlier record instead of creating duplicates.
* Retry behaviour: a retry of the same logical record should map to the same persisted checkpoint and produce the latest valid state.
* Restart recovery: on app reopen, `findLatestByDocumentId` and `findByDocumentVersion` should reconstruct the last committed checkpoint without requiring any user re-entry.
* External dependency failure: the SQLite repository should surface a failure and preserve the last committed checkpoint rather than writing a partial state.

---

## 11. Implementation Sequence

1. Confirm repository contract alignment with the existing `DocumentChunkingWorkflowRepository` interface.
2. Replace the in-memory repository default in the knowledge-embedding flow with the SQLite-backed implementation, while preserving the interface contract.
3. Update the repository mapping so each `DocumentChunkingWorkflowRecord` field aligns with the existing SQLite table columns and boolean values.
4. Verify read operations (`findByDocumentVersion`, `findLatestByDocumentId`, `findByStatus`) return the expected checkpoint state after restart.
5. Run the focused feature integration tests covering document receive/validate persistence and reopen recovery.

---

## 15. Implementation Guardrails

* Reuse the existing repository contract in [src/shared/domain/repositories/DocumentChunkingWorkflowRepository.ts](src/shared/domain/repositories/DocumentChunkingWorkflowRepository.ts).
* Replace the in-memory implementation in [src/features/knowledge-embedding/infrastructure/repository/InMemoryDocumentChunkingWorkflowRepository.ts](src/features/knowledge-embedding/infrastructure/repository/InMemoryDocumentChunkingWorkflowRepository.ts) with a SQLite-backed implementation, not a new persistence abstraction.
* Reuse the existing Drizzle database connection and schema pattern already used across the app instead of introducing ad hoc database access.
* Keep the change scoped to the knowledge-embedding repository boundary; do not expand into document parsing, OCR, or unrelated feature logic.
* Do not change the use-case interfaces or external behaviour unless the contract itself is already documented and approved.
* Do not implement anything beyond the repository requirement for this feature; the full end-to-end flow is out of scope for this design.
