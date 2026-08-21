# Feature: PDF Text Parsing for Chunking (Persistence-Oriented Orchestration)

## Phase 1: Test Blueprint

### 1. Test Scenarios & Purposes

#### A. Domain Entity & Validation Tests

These tests validate the invariants for the persisted workflow model and extracted result contract described in the architecture amendment.

- Purpose: ensure invalid document version or payload inputs are rejected before parsing starts.
- Purpose: verify the canonical workflow state is persisted on `DocumentVersion` and not inferred only in memory.
- Purpose: ensure extracted result persistence is unique per `(documentId, documentVersion)` and never silently duplicates partial data.

| Test ID | Scenario | Purpose |
| --- | --- | --- |
| DVT-01 | `DocumentVersion` record with missing `documentId` | Validate request-level integrity and reject invalid workflow state initialization. |
| DVT-02 | `DocumentVersion` with `version < 1` or invalid `status` value | Validate version and state boundary rules before parse execution. |
| DVT-03 | `DocumentParserService.execute` called with empty or unsupported document payload | Validate validation fails before parser selection. |
| DVT-04 | `ExtractedDocumentText` row keyed by existing `(documentId, documentVersion)` | Validate uniqueness and overwrite semantics for the same version. |
| DVT-05 | Successful extraction returns empty `text` payload | Validate empty extracted text is classified as a failure rather than a false success. |
| DVT-06 | Extraction result includes missing `pageMetadata` or `elements` | Validate optional metadata is tolerated while the result remains structurally valid. |
| DVT-07 | `DocumentVersion.workflowState` transitions to `failed` without a matching `lastError` | Validate the failure state is always traceable and diagnosable. |

#### B. Workflow & State Transition Tests

These tests focus on the orchestration-owned lifecycle between `DocumentVersion` and `ExtractedDocumentText`.

- Purpose: verify valid state transitions for success and retry-safe recovery.
- Purpose: prove failure states are captured in the canonical workflow record, not only in transient service memory.
- Purpose: ensure idempotent replay for a successful version returns the stored parse result without re-running extraction.

| Test ID | Scenario | Purpose |
| --- | --- | --- |
| WST-01 | New document version received | Validate initial lifecycle begins at `received` before any validation or parse work. |
| WST-02 | Validation passes | Validate `received -> validation_pending -> validation_passed` before extraction begins. |
| WST-03 | Validation fails | Validate `received -> validation_failed -> failed` and capture `validationReason`. |
| WST-04 | Extraction succeeds | Validate `validation_passed -> text_extracted` and then `persisted` with updated timestamps. |
| WST-05 | Parse fails during extraction | Validate `failed` state with `lastError`, `retryCount`, and no duplicated extracted row. |
| WST-06 | Retry after failure for same version | Validate `failed -> validation_pending -> text_extracted` without creating duplicate persistence artifacts. |
| WST-07 | Repeat successful call for same `(documentId, documentVersion)` | Validate idempotent replay returns stored result without re-extraction or mutation. |
| WST-08 | Duplicate webhook or repeated job delivery | Validate deterministic behavior with same document version, without creating duplicate history or rows. |
| WST-09 | `DocumentParserService` updates workflow state before and after persistence | Validate the service owns the lifecycle boundary, not the parser itself. |

#### C. Contract & API Surface Tests

These tests define the external contract for the parser registry, orchestration service, and persisted output structure.

- Purpose: confirm parser selection and capability checks between the registry and parser implementations.
- Purpose: validate the service contract for idempotent execution, retry metadata, and persisted result semantics.
- Purpose: ensure failure classification remains explicit and contractually clear to downstream chunking processes.

| Test ID | Scenario | Purpose |
| --- | --- | --- |
| CAT-01 | `DocumentParserService.execute(input)` with valid PDF payload | Validate correct parser resolution and returned normalized result. |
| CAT-02 | Parser registry has no matching parser for a file type | Validate contract surfaces a clear unsupported-format error. |
| CAT-03 | `DocumentParserService.execute` called when extracted row already exists | Validate immediate idempotent replay and no parser re-execution. |
| CAT-04 | `DocumentParserService.execute` called after a failed parse | Validate retry-safe update flow uses same version key and preserves failure metadata. |
| CAT-05 | `ExtractedDocumentText` upsert semantics on re-run | Validate overwrite behavior for the same version without creating duplicate rows. |
| CAT-06 | `DocumentVersion` last error and retry metadata on failure | Validate failure artifact is persisted for monitoring and retry analysis. |
| CAT-07 | `ParseDocumentUseCase` delegates to `DocumentParserService` | Validate application-layer façade preserves orchestration ownership and lifecycle behavior. |
| CAT-08 | Parser contract remains stateless and side-effect free | Validate parser isolation: extraction and normalization only, persistence handled outside parser. |

---

### 2. Test Execution Plan

| Test ID | Target Component/Interface | Scenario / Trigger | Expected Behavioral Outcome | Test Type |
| --- | --- | --- | --- | --- |
| DVT-01 | `DocumentVersion` / validation layer | Missing `documentId` | Validation fails before parsing begins | Unit |
| DVT-02 | `DocumentVersion` / validation layer | `version` is 0 or negative | Validation fails with clear boundary error | Unit |
| DVT-03 | `DocumentParserService.execute` | Empty or malformed request payload | Request rejected before parser selection | Unit |
| DVT-04 | `ExtractedDocumentText` persistence contract | Existing row for same `(documentId, documentVersion)` | One logical row is retained; update semantics apply | Unit |
| DVT-05 | `ExtractedDocumentText` / parser result | Empty extracted text | Failure is classified; no successful persist occurs | Unit |
| DVT-06 | `ExtractedDocumentText` / parser result | Optional metadata absent | Successful parse remains valid and structurally complete | Unit |
| DVT-07 | `DocumentVersion` state model | Failure state without `lastError` | Invalid workflow state detected by contract tests | Unit |
| WST-01 | `DocumentParserService` / `DocumentVersion` | New processing request | Workflow starts at `received` | Unit |
| WST-02 | `DocumentParserService` / `DocumentVersion` | Validation passes | State moves to `validation_pending` then `validation_passed` | Unit |
| WST-03 | `DocumentParserService` / `DocumentVersion` | Validation fails | State moves to `validation_failed` then `failed` | Unit |
| WST-04 | `DocumentParserService` | Extraction succeeds | State moves to `text_extracted`, then `persisted` | Unit |
| WST-05 | `DocumentParserService` | Extraction throws/engine error | State becomes `failed`; `lastError` and `retryCount` recorded | Unit |
| WST-06 | `DocumentParserService` | Retry after failure | Same version key is updated without duplicate extracted row | Integration |
| WST-07 | `DocumentParserService` | Repeat call after success | Result is read from stored payload without re-extraction | Integration |
| WST-08 | `DocumentParserService` | Duplicate webhook or duplicate job | Same version results in consistent single-row, single-status lifecycle | Integration |
| WST-09 | `DocumentParserService` + repository boundary | Lifecycle updates before/after persistence | The service is the authoritative orchestrator for workflow state | Integration |
| CAT-01 | `DocumentParserService` | Valid PDF parse request | Correct parser is selected and normalized output returned | Unit |
| CAT-02 | Parser registry | Unsupported file type | Clear error for missing parser | Unit |
| CAT-03 | `DocumentParserService` | Existing extracted row for same version | Returns stored result instantly without re-run | Integration |
| CAT-04 | `DocumentParserService` | Retry after failed extraction | Failure metadata persists and rows remain unique | Integration |
| CAT-05 | `ExtractedDocumentText` repository contract | Upsert same version row repeatedly | Stable logical record with updated timestamp only | Integration |
| CAT-06 | `DocumentVersion` monitoring contract | Failure snapshot | `lastError`, `retryCount`, `updatedAt` are persisted | Unit |
| CAT-07 | `ParseDocumentUseCase` | Delegation path | Application lambda delegates correctly to orchestrator | Unit |
| CAT-08 | Parser implementation | Extraction logic remains stateless | Side effects occur only at orchestration boundary | Unit |

---

## Gate: Phase 2 Approval

Please review this blueprint and confirm whether it is approved to proceed to Phase 2, where the stub abstractions and red unit/integration tests will be generated from this plan.
