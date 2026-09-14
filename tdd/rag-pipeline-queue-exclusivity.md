# Test Blueprint: Single RAG Pipeline Queue Consumer

## Scope

This plan covers the missing runtime ownership guarantees for the
knowledge-embedding queue:

* the application has exactly one queue instance;
* one queue instance allows exactly one subscriber/consumer;
* the single consumer processes one task at a time, including embedding work;
* duplicate publication remains idempotent.

The plan extends the existing queue-consumer and orchestrator test suites. DI
singleton behavior should be covered in an existing DI test surface if one is
available; otherwise Phase 2 may add one focused registration test file. No
second queue is introduced and SQLite access remains inside repositories.

## Test Scenarios & Purposes

### Domain Entity and Validation Tests

The queue item identity remains the tuple `runId`, `documentId`, and
`documentVersion`. Queue deduplication must treat that identity consistently,
while allowing distinct document versions to remain independent work items.

* Verify that publishing the same queue item repeatedly produces one claimable
  task and one notification.
* Verify that the same document with different versions is not incorrectly
  collapsed into one task.

### Workflow and State Transition Tests

The consumer owns runtime worker lifecycle; the orchestrator owns durable
workflow state and stage progression. The tests must prove the simple ownership
rule directly: one application queue and one subscriber.

* Resolving the queue through the application container repeatedly must return
  the same queue instance.
* Resolving the consumer through the application container repeatedly must
  return the same consumer instance for that queue.
* Attempting to subscribe a second consumer to one queue must fail
  deterministically, preferably with a clear ownership error.
* The first consumer must remain the only subscriber after a rejected second
  subscription.
* The single consumer must never execute two queue tasks concurrently; the
  maximum active executor count must remain one.
* Concurrent `drain()` calls on one consumer must share the same in-flight
  drain and must not start parallel work.
* A task released after completion must allow the next task to run, preserving
  FIFO order.
* Stopping the consumer must prevent new work from starting and must not allow a
  second subscriber to replace it on the same queue.

### Contract and API Surface Tests

The queue and consumer contracts should expose enough behavior to verify the
single-owner rule without inspecting private fields or depending on timing
alone.

* Queue subscription has an explicit single-owner contract and deterministic
  behavior for a second registration.
* DI registration has an explicit singleton contract for the queue.
* Queue dequeue returns each queued item once to the sole consumer.
* Consumer execution awaits the executor before claiming the next item.
* Executor failures release the worker slot, preserve the durable failure
  state, and allow the next independent item to proceed.
* Duplicate events are coalesced or ignored, without duplicate parser, chunker,
  or embedding calls.
* The consumer delegates the complete queue item identity to the orchestrator
  and never reconstructs work from stale queue status.

## Test Execution Plan

| Test ID | Target Component/Interface | Scenario / Trigger | Expected Behavioral Outcome | Test Type |
| --- | --- | --- | --- | --- |
| QE-001 | `InMemoryWorkflowQueue` | Publish the same item twice | One queued item and one listener notification exist | Unit |
| QE-002 | `InMemoryWorkflowQueue` | Publish the same document at two versions | Both versions remain independently claimable | Unit |
| QE-003 | `InMemoryWorkflowQueue.subscribe` | Subscribe two consumers to one queue | The second subscription is rejected and the first remains registered | Unit |
| QE-004 | `KnowledgeEmbeddingQueueConsumer` | Publish work after the second subscription is rejected | Only the first consumer receives and executes the task | Unit |
| QE-005 | `KnowledgeEmbeddingQueueConsumer` | Process two queued items with a blocking executor | Active executor count never exceeds one and FIFO order is preserved | Unit |
| QE-006 | `KnowledgeEmbeddingQueueConsumer` | Invoke `drain()` concurrently on one consumer | Calls share one drain and no work overlaps | Unit |
| QE-007 | `KnowledgeEmbeddingQueueConsumer` | Publish a duplicate event while a run is blocked | The active run has one executor invocation | Unit |
| QE-008 | `KnowledgeEmbeddingQueueConsumer` | First item fails while a second item is queued | Failure releases the slot and the second item runs once | Unit |
| QE-009 | `KnowledgeEmbeddingQueueConsumer` | Stop before queued work starts | No new item starts and the subscription is released | Unit |
| QE-010 | `RagPipelineOrchestrator` | Queue restoration occurs through the shared queue | Restored work is published once and processed by the sole consumer | Integration |
| QE-011 | DI/runtime wiring | Resolve `InMemoryWorkflowQueue` multiple times | Every resolution returns the same queue object | Integration |
| QE-012 | DI/runtime wiring | Resolve the consumer multiple times and initialize app processing | Every resolution returns the same consumer, which is the sole subscriber for the singleton queue | Integration |

## Existing Test Suite Placement

Add the scenarios to the current test files rather than creating parallel
feature-specific suites:

* [KnowledgeEmbeddingQueueConsumer.test.ts](../src/features/knowledge-embedding/tests/unit/KnowledgeEmbeddingQueueConsumer.test.ts): QE-003 through QE-009, covering one subscriber, serialized execution, duplicate events, failure release, and stop behavior.
* [RagPipelineOrchestrator.test.ts](../src/features/knowledge-embedding/tests/unit/RagPipelineOrchestrator.test.ts): QE-001, QE-002, and QE-010, covering queue identity deduplication, document-version boundaries, and restoration publication.
* DI registration tests: QE-011 and QE-012. Reuse an existing DI test file if appropriate; otherwise add one narrow integration test for the registrations in `registerServices.ts`.

The new scenarios should use the existing `item()` helper, repository fakes,
and Jest style already present in these suites. Do not duplicate the same
behavior in a new test file merely to isolate the feature.

## Test Doubles and Deterministic Verification

Use a blocking executor controlled by explicit promises and expose an
`activeExecutions` counter. Each test should assert the maximum counter value,
executor call count, processed run IDs, and queue contents after release. Avoid
sleep-based timing checks.

For orchestrator integration tests, use repository fakes or the existing test
repositories. Assert durable status transitions and repository call ordering;
do not issue raw SQL from tests to bypass repository contracts.

## Phase 2 Boundary

After approval, Phase 2 should extend the existing consumer and orchestrator
test files with QE-001 through QE-010, then add QE-011 through QE-012 to the
existing DI test surface or to one focused DI test file. The first red tests
should be QE-003, QE-004, QE-005, and QE-011 through QE-012 because they expose
the current ownership gaps: multiple queue subscribers are allowed, and
singleton behavior is only configured for the queue while the consumer
registration remains transient.
Production changes, if required by the approved contract, should remain
additive and preserve existing pipeline logic bodies.

**Approval gate:** Please review and approve this Phase 1 blueprint before
Phase 2 generates executable red tests or changes production contracts.