# Test Blueprint: Pre-Upload Duplicate Validation

## 1. Test Scenarios & Purposes

### 1.1 Domain Entity & Validation Tests

This behavior does not introduce a new durable domain entity. Tests should verify the existing checksum and workflow invariants:

- A content hash is required for content-level duplicate validation unless the caller has explicitly supplied a trusted hash or the filesystem adapter can hash the source URI.
- File name, file size, and picker URI identity must not be treated as proof of equal content.
- `completed` is the only matching workflow status that represents reusable analysis.
- `pending` and `running` represent an in-flight duplicate and must not create another workflow or queue item.
- `failed`, `partial`, and `cancelled` matches allow a new independent attempt and do not set `ragSourceDocumentId`.
- A duplicate lookup is project-scoped through `DocumentRepository.findAll({ checksum, projectId })`.
- Exact `(documentId, documentVersion)` replay remains idempotent before hashing or copying.
- A blocked duplicate must not leave a permanent document or workflow record.

### 1.2 Workflow & State Transition Tests

| Test ID | Target Component/Interface | Scenario / Trigger | Expected Behavioral Outcome | Test Type |
| --- | --- | --- | --- | --- |
| W1 | `KnowledgeEmbeddingDocumentService.addDocument` | Trusted `metadata.contentHash` is supplied and no matching document exists | New document/workflow is persisted and one queue item is published; source URI hashing is not required | Unit |
| W2 | `IFileSystemAdapter.computeSha256FromUri` | No content hash is supplied and the adapter supports direct URI hashing | URI is hashed before permanent app-storage copy; duplicate lookup occurs using the resulting checksum | Unit |
| W3 | `KnowledgeEmbeddingDocumentService.addDocument` | Direct URI hash finds a completed same-project match | Returns `alreadyHandled: true`; no permanent copy, document, workflow, or queue item is created | Unit/Integration |
| W4 | `KnowledgeEmbeddingDocumentService.addDocument` | Direct URI hash finds a pending/running same-project match | Returns the existing in-flight result; no new document/workflow or queue item is created | Unit/Integration |
| W5 | `KnowledgeEmbeddingDocumentService.addDocument` | Direct URI hash finds failed/partial/cancelled content | Falls through to a new independent attempt; the new file is copied permanently and queued | Unit |
| W6 | `KnowledgeEmbeddingDocumentService.addDocument` | Adapter cannot hash the source URI directly | Service stages the file to a unique path, hashes the staged file, then applies the same duplicate decision | Unit/Integration |
| W7 | `KnowledgeEmbeddingDocumentService.addDocument` | Staged fallback copy identifies a completed duplicate | Staged file is deleted; no document/workflow/queue item remains for the new request | Unit |
| W8 | `KnowledgeEmbeddingDocumentService.addDocument` | Staged fallback copy identifies new or retryable content | Staged path is retained as the document's local path; document/workflow are persisted and one queue item is published | Unit |
| W9 | `KnowledgeEmbeddingDocumentService.addDocument` | Same checksum exists in another project | Upload is accepted and queued; the unrelated project does not block it | Integration |
| W10 | `KnowledgeEmbeddingDocumentService.addDocument` | Exact same document ID/version is submitted twice | Existing workflow is returned before any copy or hash operation; no duplicate queue item is published | Unit |
| W11 | `KnowledgeEmbeddingDocumentService.addDocument` | Direct hashing or staged hashing fails | Intake fails without assuming the file is new or already analyzed; staged files are compensated | Unit |
| W12 | `KnowledgeEmbeddingDocumentService.addDocument` | Document/workflow persistence fails after staging | Staged file is deleted; no orphaned document/workflow/queue item remains | Unit/Integration |

### 1.3 Contract & API Surface Tests

| Test ID | Target Component/Interface | Scenario / Trigger | Expected Behavioral Outcome | Test Type |
| --- | --- | --- | --- | --- |
| C1 | `IFileSystemAdapter` | Adapter implements `computeSha256FromUri` | Contract accepts a source URI and returns a content hash without requiring a destination path | Unit |
| C2 | `IFileSystemAdapter` | Adapter omits `computeSha256FromUri` | Existing copy-then-`computeSha256` fallback remains available | Unit |
| C3 | `DocumentRepository` | Service queries a checksum within a project | Repository receives `{ checksum, projectId }`; no raw database access occurs in the service | Unit |
| C4 | `DrizzleDocumentRepository` | Integration query finds same checksum in the target project | Concrete repository returns matching documents from SQLite | Integration |
| C5 | `KnowledgeEmbeddingDocumentMutationResult` | Completed or in-flight duplicate is detected | Returns `alreadyHandled: true` and the existing source run view | Unit |
| C6 | Queue side-effect contract | Duplicate is blocked before permanent upload | Queue has no item for the rejected document | Unit/Integration |
| C7 | Queue side-effect contract | New or retryable content is accepted | Queue contains exactly one item for the new run ID | Unit |
| C8 | Storage contract | Re-upload uses an existing filename | Permanent storage receives a collision-safe destination name; original filename remains document metadata | Unit/Integration |

## 2. Test Execution Plan

| Test ID | Target Component/Interface | Scenario / Trigger | Expected Behavioral Outcome | Test Type (Unit/Integration) |
| --- | --- | --- | --- | --- |
| D1 | `KnowledgeEmbeddingRunStatus` | Evaluate each duplicate status | Only `completed` is reusable; pending/running are in-flight; failed/partial/cancelled are retryable | Unit |
| W1 | `KnowledgeEmbeddingDocumentService.addDocument` | New upload with supplied hash | New pending run is persisted and queued | Unit |
| W2 | `IFileSystemAdapter` + service | New upload without hash and direct source hashing support | Hash is computed from URI before permanent copy | Unit |
| W3 | Service + `DrizzleDocumentRepository` | Direct-hashed completed duplicate | No permanent duplicate record or queue item is created | Integration |
| W4 | Service + workflow repository | Direct-hashed pending/running duplicate | Existing in-flight run is returned; no duplicate work is created | Unit/Integration |
| W5 | Service | Direct-hashed failed/partial/cancelled match | New unique storage path, document, workflow, and queue item are created | Unit |
| W6 | Service + filesystem adapter | Direct source hash unsupported | Copy-then-hash fallback is used | Unit |
| W7 | Service + filesystem adapter | Fallback staged copy is a completed duplicate | Staged file is deleted and no durable duplicate remains | Unit |
| W8 | Service + filesystem adapter | Fallback staged copy is accepted | Staged file is retained as `localPath` and one queue item is published | Unit |
| W9 | Service + `DrizzleDocumentRepository` | Same checksum exists in another project | Target project receives an independent queued attempt | Integration |
| W10 | Service | Same document ID/version replay | No filesystem operation occurs after exact workflow lookup; result is idempotent | Unit |
| W11 | Service | URI hash and local hash failures | Error is surfaced; no unsafe duplicate decision is made; cleanup occurs | Unit |
| W12 | Service + SQLite repositories | Persistence failure after staging | Database and file compensation leave no orphaned new artifact | Integration |
| C1 | `DocumentRepository` | Checksum lookup | Service uses the repository interface; test verifies query filter, not SQL details | Unit |
| C2 | `DrizzleDocumentRepository` | Durable checksum/project lookup | SQLite-backed implementation returns the expected matching rows | Integration |
| C3 | `MobileFileSystemAdapter` | URI normalization and hashing | Adapter hashes supported local/provider URI forms or reports failure for unsupported access | Integration/platform |
| C4 | `MobileFileSystemAdapter` | Re-upload with same original filename | Destination names do not collide; original metadata name is preserved | Integration/platform |

## Test Fixtures and Repository Choice

### Unit tests: `TestDocumentRepository` is appropriate

`TestDocumentRepository` is a small in-memory implementation of the `DocumentRepository` interface. It is appropriate for unit tests because those tests need deterministic control over:

- multiple documents sharing one checksum;
- different project IDs;
- source documents with and without `ragSourceDocumentId`;
- repository save/delete observations;
- injected persistence failures;
- no SQLite migration or native database setup.

It is not being used because `DocumentRepository` is insufficient. `DocumentRepository` is an interface and cannot be instantiated directly; a unit test must provide some implementation. The test double also keeps the test focused on `KnowledgeEmbeddingDocumentService` rather than SQL, migrations, and database lifecycle.

### Integration tests: use the concrete repository

For integration tests, use the existing concrete `DrizzleDocumentRepository` through the `DocumentRepository`-typed dependency:

```ts
const documentRepository: DocumentRepository = new DrizzleDocumentRepository();
const service = new KnowledgeEmbeddingDocumentService({
  documentRepository,
  workflowRepository: new DrizzleDocumentChunkingWorkflowRepository(),
  queue,
});
```

The current integration suite already establishes this pattern with an in-memory SQLite database and migration setup. The test should insert source documents using `DrizzleDocumentRepository.save`, invoke the service, and verify durable rows through repository reads. This tests the real `documents` schema mapping and the `{ checksum, projectId }` filter.

Using a `TestDocumentRepository` in an integration test would be counterproductive: it would bypass the SQLite schema, Drizzle mapping, query filtering, and persistence behavior that make the test an integration test. Using the `DocumentRepository` interface is still correct because dependency injection depends on the abstraction while the test supplies the production implementation.

### What prevents direct use of `DocumentRepository`?

Nothing prevents using the abstraction in the service or as the declared test variable type. The only limitation is that an interface has no runtime implementation. Choose the implementation by test level:

- Unit: `TestDocumentRepository` or a purpose-built mock/fake implementing `DocumentRepository`.
- Integration: `DrizzleDocumentRepository`, typed as `DocumentRepository` where useful.
- Do not add a second repository abstraction or bypass repository methods with raw SQL from the service test.

## Coverage Boundaries

- This blueprint covers pre-upload hashing, copy-then-hash fallback, checksum/project duplicate decisions, storage collision safety, cleanup, and queue side effects.
- It does not test PDF parsing, chunking, embedding quality, or UI rendering.
- Existing RAG workflow and queue-consumer suites remain responsible for stage execution, durable resume, and run-ID concurrency.
- Platform-specific provider URI behavior may require a narrow adapter test or device test because Jest cannot fully reproduce iOS security-scoped file access.

## Review Gate

This is Phase 1 only. Please review and approve this Test Blueprint before Phase 2 begins.

After approval, Phase 2 may add the optional filesystem contract and executable red tests. It should not replace integration repository coverage with `TestDocumentRepository`; unit tests should use the test double, while integration tests should use `DrizzleDocumentRepository` behind the existing `DocumentRepository` dependency boundary.
