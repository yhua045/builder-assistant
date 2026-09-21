# Feature: Step-Level RAG Pipeline Resume and Retry

## Goal

Make the RAG pipeline a durable sequence of independently tracked processing steps. The pipeline must retain pipeline-level state while each step records its own status, progress, checkpoint, retry metadata, and output reference.

When processing fails or is interrupted, the system must resume from the earliest failed or incomplete step instead of rerunning successful steps. Existing workflows must preserve the step order that was assigned when they were created, while new workflows may use an updated sequence.

## System Flow

1. A new RAG workflow is created with a stable workflow/pipeline identifier and an ordered step sequence.
2. The system persists the pipeline-level state and one durable step record for each configured step.
3. The orchestrator invokes steps sequentially, providing each step with the workflow identifier, document/version context, retry metadata, and access to its persisted step state.
4. Each step loads any required prior output, performs its work, persists its own status and checkpoint, and records a durable output reference when successful.
5. The orchestrator updates pipeline-level state as steps start, complete, partially complete, fail, or recover.
6. When a step succeeds, later executions reuse its valid output and do not execute that step again.
7. When a step fails or processing is interrupted, the system identifies the earliest failed or incomplete step and resumes from that step after retry policy permits it.
8. When all active steps complete successfully, the pipeline is marked completed.
9. If a step definition or output contract changes and invalidates a completed output, that step and all downstream steps are marked incomplete and rerun in the workflow's preserved order.

## Acceptance Criteria

### AC1

**Given** a new RAG workflow is created,
**when** the workflow is registered,
**then** the system assigns a stable workflow/pipeline identifier and persists the ordered step sequence associated with that workflow.

### AC2

**Given** a persisted workflow with configured steps,
**when** a step begins execution,
**then** the step receives the workflow identifier, document identity, document version, pipeline context, retry metadata, and its durable step state.

### AC3

**Given** a step is executed,
**when** it completes successfully,
**then** the system persists the step as completed together with its output reference, checkpoint, completion time, and output validity metadata.

### AC4

**Given** a step completes successfully and its output remains valid,
**when** the workflow is retried, resumed, or recovered after interruption,
**then** the system does not execute that step again and makes its persisted output available to downstream steps.

### AC5

**Given** a sequential workflow contains multiple steps,
**when** one step fails,
**then** the failed step records its failure, retryability, error details, checkpoint, and retry count, while the pipeline records the failure and identifies that step as the resume point.

### AC6

**Given** an earlier step has completed and a later step has failed,
**when** the workflow is retried,
**then** the system resumes at the failed step or the earliest incomplete step and does not rerun the earlier completed step.

### AC7

**Given** a step is partially complete when processing is interrupted,
**when** the workflow is recovered,
**then** the system restores the step's durable checkpoint and continues only the incomplete work within that step where the step supports checkpointed recovery.

### AC8

**Given** multiple steps have failed or are incomplete,
**when** the workflow determines its retry point,
**then** it selects the earliest failed or incomplete step in the workflow's persisted order.

### AC9

**Given** a workflow is retried,
**when** the failed step's retry policy allows another attempt,
**then** the system applies the configured retry limit and backoff before invoking the step again.

### AC10

**Given** a step reaches its configured retry limit or its circuit is open,
**when** another execution is requested,
**then** the system does not invoke that step, keeps the pipeline recoverable or failed according to the configured policy, and records the reason that execution was blocked.

### AC11

**Given** a step or its dependency is temporarily unavailable,
**when** the step reports a retryable failure,
**then** the system preserves the step checkpoint and output state, applies the configured retry/backoff behavior, and does not invalidate successful upstream steps.

### AC12

**Given** a step reports a non-retryable failure or receives invalid input,
**when** the failure is recorded,
**then** the system marks the step failed, prevents downstream steps from executing, and exposes the failure reason at pipeline level.

### AC13

**Given** the application is interrupted while a workflow is running,
**when** the application starts again,
**then** the system restores the durable pipeline and step records and resumes from the earliest failed, partial, running-without-completion, or pending step without creating a duplicate workflow.

### AC14

**Given** the same workflow is queued or resume is requested more than once,
**when** duplicate requests are received,
**then** the system coalesces them by workflow/pipeline identifier and does not execute the same workflow concurrently.

### AC15

**Given** a pipeline step succeeds,
**when** the orchestrator advances the workflow,
**then** the pipeline-level state reflects the current active step and the completed step remains independently queryable.

### AC16

**Given** all configured active steps are completed,
**when** the final step output is persisted successfully,
**then** the pipeline is marked completed and subsequent resume requests do not execute any step.

### AC17

**Given** a workflow already exists with a persisted step order,
**when** the global pipeline configuration changes,
**then** the existing workflow continues to use its original step order and new workflows use the new sequence.

### AC18

**Given** a workflow's step order is defined,
**when** the orchestrator executes the workflow,
**then** changing the order requires changing only the workflow configuration or step composition and does not require rewriting the orchestration logic for each step.

### AC19

**Given** a step is replaced, its version changes, or its output contract becomes incompatible,
**when** the workflow validates existing step outputs,
**then** the system invalidates that step's output and all downstream outputs, marks the affected steps incomplete, and resumes from the earliest invalidated step.

### AC20

**Given** a pipeline-level state and step-level states are persisted,
**when** the states are queried,
**then** the pipeline state describes overall progress and recoverability while each step state describes its own execution status, checkpoint, retry state, output, and failure details.

### AC21

**Given** a step receives the standardized step input,
**when** it completes or fails,
**then** it returns the standardized step result containing status, output reference or checkpoint, retryability, error details where applicable, and execution metadata.

### AC22

**Given** a step is reordered within the configuration for a new workflow,
**when** the new workflow executes,
**then** the orchestrator invokes the steps in the new persisted order while preserving the same step input and result contract.

### AC23

**Given** a pipeline is cancelled,
**when** cancellation is requested,
**then** the pipeline stops scheduling new work, records the cancellation at pipeline and active-step level, and does not automatically resume unless an explicit recovery policy permits it.

## Error & Failure Handling

* Missing workflow, document identity, document version, or step definition prevents execution and records a non-retryable configuration failure.
* Retryable step failures preserve prior successful outputs and the failed step's checkpoint for later retry.
* Non-retryable failures prevent downstream steps from running until the failure is explicitly resolved according to the workflow policy.
* Retry limits, backoff, and circuit-breaking behavior are applied per step and are observable at pipeline level.
* An interrupted running step is recovered from its durable checkpoint when possible; otherwise it is treated as the earliest incomplete step.
* A persistence failure must not cause the system to report a completed step whose output state was not durably recorded.
* A stale or duplicate workflow request must not create another pipeline or execute the same workflow concurrently.
* Invalidated outputs cause the affected step and all downstream steps to be rerun; valid upstream outputs remain reusable.

## Edge Cases

* A workflow has no configured steps or contains duplicate step identifiers.
* A step completes its external work but the process stops before its completion record is persisted.
* A step is reordered for a new workflow while an older workflow is still running.
* A completed step's output is missing, corrupted, expired, or incompatible with the next step's input contract.
* A workflow is resumed after its retry limit or circuit breaker has been reached.
* Two resume requests arrive at the same time for the same workflow.
* A document version changes while an earlier workflow version is being retried.
* A downstream step fails after some of its own sub-items have completed.
* A cancellation request arrives while a step is performing non-interruptible work.

## Observability

* Log workflow creation, step start, step completion, step failure, retry scheduling, checkpoint persistence, output invalidation, recovery, cancellation, and pipeline completion with workflow ID, document ID/version, step ID, attempt number, and pipeline state.
* Record the failed step, failure classification, retryability, retry count, next retry time, circuit state, and checkpoint reference.
* Expose pipeline-level progress and the current step together with per-step status and error details.
* Measure step duration, retry count, failure count, recovery count, time spent waiting for backoff, and total pipeline duration.
* Preserve enough correlation data to trace a pipeline execution across storage, queue, parser, chunking, and embedding operations.

## Out of Scope

* Defining the domain-specific parsing, chunking, embedding, or retrieval algorithms inside individual steps.
* Changing the document checksum and duplicate-document rules.
* Replacing SQLite, the existing repositories, or the runtime queue with a different persistence or orchestration platform.
* Running independent steps concurrently when the workflow defines a sequential dependency.
* Automatically migrating existing workflows to a newly configured step order.
* Guaranteeing rollback of external side effects that cannot be reversed.

## Rules

1. Acceptance criteria describe observable system behavior rather than implementation details.
2. Every step has a stable identifier within a workflow.
3. Existing workflows preserve their persisted step order; configuration changes apply only to new workflows unless an explicit migration is requested.
4. Pipeline-level state and step-level state are distinct but correlated by the workflow identifier.
5. A successful step is reused only while its output remains valid and compatible.
6. Retry resumes at the earliest failed or incomplete step in persisted workflow order.
7. Step retry limits, backoff, and circuit-breaking policies are configurable and applied consistently.
8. Duplicate workflow requests are idempotent and must not cause concurrent duplicate execution.
9. Step inputs and outputs use a common contract so step order can change without step-specific orchestrator logic.
10. Downstream steps cannot run while an upstream step is incomplete or failed.

## Quality Check

Before implementation, verify that:

* Pipeline and step state have separate observable contracts.
* A stable workflow identifier is available to every step.
* Successful step outputs can be reused safely.
* Retry resumes at the earliest failed or incomplete step.
* Existing workflow order is preserved when configuration changes.
* New workflows can use a different step order without custom orchestration changes.
* Retry limits, backoff, circuit breaking, interruption recovery, and duplicate requests are covered.
* Output incompatibility invalidates the affected step and downstream work.
* Each acceptance criterion can be converted into an independent automated test.
