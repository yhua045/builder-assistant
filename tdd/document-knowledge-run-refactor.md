# Feature: Document Knowledge Run Refactor

## Phase 1: Test Blueprint

### 1. Test Scenarios & Purposes

#### Domain Entity & Validation Tests

- Validate that a parent run is created only with a valid document identifier and a valid version number.
- Validate that a child step record is created only when it belongs to a valid parent run and a valid stage is specified.
- Confirm that successful stage completion preserves earlier successful results and does not override previously completed work.
- Confirm that failed or partial stages retain the last known checkpoint and error detail for retry without losing durable results.
- Verify that duplicate processing requests do not create duplicate persisted work artifacts for the same document/version/stage combination.
- Verify boundary conditions for empty or invalid document metadata, invalid stage values, and missing parent references.
- Confirm that a parent run can remain in a failed or partial state while still preserving previously successful child work.

#### Workflow & State Transition Tests

- Confirm the valid progression from created → running → completed when all stages succeed.
- Confirm the valid progression from created → running → partial/failed when a stage fails without full recovery.
- Confirm retry logic resumes only the failed stage and does not restart already completed stages.
- Confirm interruption recovery resumes from the last known checkpoint instead of reprocessing completed work.
- Confirm duplicate trigger handling does not create a second parent run for the same work item when a run already exists.
- Confirm guard conditions prevent stage updates without a valid parent run reference.
- Confirm forbidden or invalid transitions such as completing a stage before it starts or marking a parent run complete while a child stage remains failed or in progress.

#### Contract & API Surface Tests

- Validate the parent run contract exposes only the workflow lifecycle contract and not the internal step implementation details.
- Validate the child step contract exposes retry, checkpoint, and failure metadata without exposing unrelated chunk or embedding persistence details.
- Confirm input/output contracts remain stable for the run creation and stage update operations during the rename.
- Validate the system rejects invalid parent-child assignments or missing stage metadata with a clear failure signal.
- Validate that the calling application can retry a failed child stage without reprocessing already successful work.

### 2. Test Execution Plan

| Test ID | Target Component/Interface | Scenario / Trigger | Expected Behavioral Outcome | Test Type |
| --- | --- | --- | --- | --- |
| KER-01 | `KnowledgeEmbeddingRun` entity | Create run with valid document ID and version | Parent run is created successfully with valid state | Unit |
| KER-02 | `KnowledgeEmbeddingRun` entity | Create run with missing document ID | Validation failure is raised | Unit |
| KER-03 | `KnowledgeEmbeddingRun` entity | Create run with invalid version value | Validation failure is raised | Unit |
| KER-04 | `KnowledgeDetailRun` entity | Create child detail run with valid parent and stage | Child run is created successfully | Unit |
| KER-05 | `KnowledgeDetailRun` entity | Create child detail run without parent run | Validation failure is raised | Unit |
| KER-06 | Parent/child workflow | Parent run starts while child stage still pending | Parent state reflects running, child stage state reflects pending/running | Unit |
| KER-07 | Parent/child workflow | All stages succeed | Parent ends in completed and child stages end in completed | Unit |
| KER-08 | Parent/child workflow | One child stage fails | Parent remains partial/failed while successful prior stages remain intact | Unit |
| KER-09 | Retry path | Retry failed child stage | Only failed child stage is retried; completed work is preserved | Unit |
| KER-10 | Resume path | Workflow is interrupted after partial success | Resume begins from last known checkpoint without reprocessing completed work | Integration |
| KER-11 | Duplicate processing | Same document/version is processed twice | Duplicate request is ignored or coalesced without duplicate chunk/embedding persistence | Integration |
| KER-12 | State guard | Stage marked complete before started | Invalid transition is rejected or flagged | Unit |
| KER-13 | Parent status guard | Parent marked complete while child stage remains failed | Invalid transition is rejected or flagged | Unit |
| KER-14 | Contract boundary | Parent run API called for stage-level retry details | API returns workflow lifecycle state only, not internal chunk implementation details | Unit |
| KER-15 | Contract boundary | Child step API called for retry/resume | API exposes stage checkpoint and error details needed for recovery | Unit |
| KER-16 | Persistence contract | Duplicate result data for same document/version/stage | Deduplication prevents duplicate persisted artifacts | Integration |
| KER-17 | Failure recording | Stage dependency unavailable | Error detail is recorded on child run and surfaced via parent status | Integration |
| KER-18 | Migration behavior | Existing workflow data is loaded under renamed model | Old workflow records map correctly to the renamed parent/child structure | Integration |

---

## Gate: Review Before Phase 2

This test blueprint is intentionally scoped to behavioral verification for the rename/refactor and the two-level lifecycle design. It does not prescribe the implementation or write production code.

Please review this plan before Phase 2. If it matches the intended behavior, I will proceed to generate the additive production contracts and red tests in the project’s TDD layout.
