# Feature: Document Knowledge Run Refactor

## Goal

Align the persisted workflow model with the full document-to-knowledge processing lifecycle while keeping the refactor as small and low-risk as possible. The system should clearly separate the parent workflow run from the per-stage execution details so that the overall document chunk/embedding process can be tracked, resumed, and retried without reconstructing work that has already succeeded.

This change is intentionally limited to naming and workflow structure: it renames the existing run entities to reflect the broader lifecycle, introduces a parent/child relationship for stage-level tracking, and preserves the minimum necessary behavior for re-triggering and retrying failed work.

## System Flow

1. A document is uploaded or created and becomes eligible for knowledge processing.
2. The system creates a parent run representing the overall document knowledge workflow.
3. The workflow begins with the relevant processing stages, each represented as a child detail run under the parent run.
4. Each stage records its own status, progress, and errors while preserving successful work from earlier stages.
5. If a stage fails or is interrupted, the system can retry that stage without re-running already completed work.
6. When all required stages complete successfully, the parent run is marked as completed; if a stage fails without recovery, the parent run is marked as partial or failed and the failed stage remains retryable.

## Acceptance Criteria

### AC1

**Given** a document that has not yet been processed for knowledge extraction,
**when** the document enters the processing workflow,
**then** the system creates a single parent run representing the full document knowledge lifecycle.

### AC2

**Given** a parent document knowledge run exists,
**when** the workflow starts a stage such as parsing, understanding, chunking, embedding, or indexing,
**then** the system creates or updates a child detail run associated with that parent and records the stage status.

### AC3

**Given** the document workflow is in progress,
**when** one stage succeeds,
**then** the system preserves that successful stage result and continues tracking the remaining stages without resetting completed work.

### AC4

**Given** a stage fails during processing,
**when** the failed stage is retried,
**then** the system retries only that stage and does not recreate work that already completed successfully in earlier stages.

### AC5

**Given** the processing workflow is interrupted before completion,
**when** the workflow is resumed or retriggered,
**then** the system continues from the last known state and does not unnecessarily duplicate already persisted knowledge artifacts.

### AC6

**Given** the same document processing request is submitted more than once,
**when** the system evaluates whether the work has already been processed,
**then** it prevents duplicate chunk or embedding records for the same completed work and marks the duplicate request as already handled or safely ignored.

### AC7

**Given** all required stages complete successfully,
**when** the final stage finishes,
**then** the parent run is marked as completed and the workflow is treated as fully successful.

### AC8

**Given** a stage fails irrecoverably or a required dependency is unavailable,
**when** the system cannot continue without intervention,
**then** the parent run is marked as partial or failed with the relevant stage-level error information retained for retry and diagnosis.

## Error & Failure Handling

* If a stage fails due to a transient issue, the system must retain the prior successful work and allow the failed stage to be retried without restarting the entire workflow.
* If a required dependency is unavailable, the system must record the failure at the stage level and keep the parent run in a partial or failed status instead of silently losing progress.
* If a retry is triggered after an interruption or failure, the system must preserve successful artifacts and only reprocess the failed or incomplete stage.
* If invalid or incomplete input prevents a stage from running, the system must record the failure clearly and avoid creating duplicate or malformed persisted knowledge outputs.

## Edge Cases

* Duplicate processing requests for the same document.
* Retry of a failed stage after a partial run.
* Resuming a workflow after an interruption.
* Invalid or incomplete document content before the workflow begins.
* Existing persisted records that still use the old naming and must be mapped to the new parent/child structure.

## Observability

* Log stage transitions and final status changes for both the parent run and each child detail run.
* Log the error message and failed stage when a processing attempt fails or is interrupted.
* Log retry attempts and whether the retry was stage-specific or workflow-level.
* Record enough provenance to identify which document and stage produced a given knowledge artifact.

## Out of Scope

* Reworking the underlying knowledge model beyond the run/workflow naming and parent-child tracking needed for this refactor.
* Expanding the processing pipeline beyond the documented document chunk/embedding workflow.
* Introducing broad architectural changes unrelated to run state, retry behavior, or persisted stage progress.

## Rules

1. Acceptance criteria must describe observable system behaviour, not implementation details.
2. Do not prescribe classes, functions, frameworks, libraries, database schemas, or specific implementation techniques unless explicitly provided as requirements.
3. Each acceptance criterion should describe one clear and independently testable behaviour.
4. Acceptance criteria must be specific enough that they can later be converted into automated tests.
5. Consider both normal processing and failure scenarios.
6. Consider duplicate messages, retries, timeouts, invalid input, and dependency failures where relevant.
7. Do not assume that an operation is idempotent unless this has been explicitly stated or confirmed.
8. Do not invent business rules, integration behaviour, or technical requirements that have not been provided or confirmed.
9. If a requirement is ambiguous, ask before producing the final document.
10. Keep the document concise and focused on behaviour and requirements.

## Quality Check

Before producing the final document, verify internally that:

* The Goal explains why the system feature exists.
* The System Flow describes the expected processing lifecycle.
* Every important processing step is covered by at least one acceptance criterion.
* Success behaviour is covered.
* Important failure scenarios are covered.
* Important edge cases are covered.
* Duplicate/retry behaviour has been considered where relevant.
* Acceptance criteria are independently testable.
* No unnecessary implementation details have been introduced.
* No unconfirmed assumptions have been presented as requirements.
