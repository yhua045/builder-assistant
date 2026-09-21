# Test Blueprint: Lifecycle-Independent Knowledge Embedding Queue

## 1. Test Scenarios & Purposes

### Domain Entity & Validation Tests

No new domain entities or value objects are introduced by the architecture. The existing `KnowledgeEmbeddingQueueItem` DTO should be covered at the queue boundary:

- Verify items retain `runId`, `documentId`, and `documentVersion` unchanged from publish through executor notification.
- Verify identical item identity is deduplicated and does not create duplicate execution work.
- Verify different document versions remain independently queueable.
- Verify queue hydration preserves FIFO order for pending, partial, and interrupted running workflow items.

### Workflow & State Transition Tests

- Verify application startup restores the durable queue before starting the consumer.
- Verify the consumer transitions from stopped to running exactly once when `start()` is called.
- Verify repeated `start()` calls are idempotent and do not attempt a second queue subscription.
- Verify `stop()` releases the queue subscription and a later explicit `start()` can subscribe again.
- Verify queue publication while running schedules processing.
- Verify a hydrated queue is drained after startup.
- Verify a failed item does not prevent later items from being processed.
- Verify completion notifications are emitted after an item finishes and do not control or duplicate queue draining.
- Verify a screen or hook listener can be removed without stopping queue processing.
- Verify foreground/background recovery invokes durable recovery only and does not start, stop, or resubscribe the consumer.
- Verify the processing screen can observe completion without calling `InMemoryWorkflowQueue.subscribe()`.

### Contract & API Surface Tests

- Verify `KnowledgeEmbeddingQueueConsumer` delegates each claimed item to `KnowledgeEmbeddingPipelineExecutor.executeQueuedItem`.
- Verify concurrent `drain()` calls share the same in-flight drain operation and do not execute queued work twice.
- Verify queue publication callbacks and explicit `drain()` calls cannot create concurrent drain loops.
- Verify duplicate events for an active `runId` do not execute that run concurrently.
- Verify the active run guard is released after both successful and failed execution.
- Verify consumer listeners receive the completed queue item and are not called after unsubscribe.
- Verify listener failures, if listener notification is allowed to throw, do not corrupt consumer state or prevent guard cleanup; otherwise define and test that listener errors are isolated.
- Verify root-container resolution returns the same `InMemoryWorkflowQueue` instance and the same `KnowledgeEmbeddingQueueConsumer` instance.
- Verify the resolved consumer uses the resolved singleton queue.
- Verify manually creating two consumers against one queue still exposes the queue’s single-subscriber configuration error.

## 2. Test Execution Plan

| Test ID | Target Component/Interface | Scenario / Trigger | Expected Behavioral Outcome | Test Type (Unit/Integration) |
| --- | --- | --- | --- | --- |
| QUEUE-001 | `InMemoryWorkflowQueue` | Publish the same queue item twice | One queued item and one subscriber notification remain | Unit |
| QUEUE-002 | `InMemoryWorkflowQueue` | Publish two items for different document versions | Both items are independently dequeuable in publish order | Unit |
| QUEUE-003 | `InMemoryWorkflowQueue` | Hydrate pending, partial, and interrupted running items | Items are restored once and retain FIFO order | Unit |
| QUEUE-004 | `InMemoryWorkflowQueue.subscribe` | Register two queue subscribers | The second registration fails with the active-subscriber error | Unit |
| CONSUMER-001 | `KnowledgeEmbeddingQueueConsumer.start` | Start one consumer and publish work | The executor receives the item exactly once | Unit |
| CONSUMER-002 | `KnowledgeEmbeddingQueueConsumer.start` | Call `start()` repeatedly on the same consumer | Only one queue subscription exists and no error is thrown | Unit |
| CONSUMER-003 | `KnowledgeEmbeddingQueueConsumer.stop` | Stop, publish work, then drain | No newly published item is processed while stopped | Unit |
| CONSUMER-004 | `KnowledgeEmbeddingQueueConsumer.stop/start` | Stop and explicitly restart the same consumer | The subscription is released and restored exactly once | Unit |
| CONSUMER-005 | `KnowledgeEmbeddingQueueConsumer.drain` | Call `drain()` concurrently while one executor call is blocked | Calls share one in-flight drain and execution remains serialized | Unit |
| CONSUMER-006 | `KnowledgeEmbeddingQueueConsumer` | Publish duplicate events for an active run | The same `runId` is never executed concurrently | Unit |
| CONSUMER-007 | `KnowledgeEmbeddingQueueConsumer` | Executor fails for the first item and succeeds for the second | Failure is isolated, the run guard is released, and the second item executes | Unit |
| CONSUMER-008 | Consumer completion listener contract | Complete an item successfully and unsuccessfully | Registered listeners receive the completed item after execution and are removable | Unit |
| CONSUMER-009 | Consumer completion listener contract | Unsubscribe a listener before item completion | Removed listener is not called; queue execution continues | Unit |
| CONSUMER-010 | Queue/consumer ownership | Construct two consumers against one queue and start both | The second start is rejected; duplicate ownership is diagnosable | Unit |
| DI-001 | Root TSyringe registrations | Resolve queue twice | Both resolutions return the same application-wide queue | Integration |
| DI-002 | Root TSyringe registrations | Resolve consumer twice | Both resolutions return the same application-wide consumer | Integration |
| DI-003 | Root TSyringe registrations | Resolve consumer and queue | Consumer is wired to the shared queue rather than a newly created queue | Integration |
| BOOT-001 | `AppContent` initialization | Initialize database, restore queue, then start consumer | Restore completes before consumer startup and startup occurs once | Integration |
| BOOT-002 | `AppContent` lifecycle | Re-render/unmount app content or change app state | Consumer is not resubscribed or stopped as a result of UI/foreground lifecycle changes | Integration |
| HOOK-001 | `useKnowledgeEmbeddingFlow` | Enter processing with committed runs while consumer is active | Hook observes processing completion without invoking the queue’s exclusive `subscribe()` API | Integration |
| HOOK-002 | `useKnowledgeEmbeddingFlow` | Consumer completes a committed document run | Hook refreshes committed workflow views for the relevant document | Integration |
| HOOK-003 | `useKnowledgeEmbeddingFlow` | Processing view unmounts while work is active | Only the UI notification listener is removed; consumer continues processing | Integration |
| RECOVERY-001 | AppState recovery path | Return from background with pending or interrupted durable runs | Existing recovery republishes/resumes durable work without creating another consumer subscription | Integration |
| RECOVERY-002 | Queue/orchestrator recovery path | Restore the same durable run more than once | Queue/workflow deduplication prevents duplicate execution | Integration |

### Test Placement

- Extend `src/features/knowledge-embedding/tests/unit/KnowledgeEmbeddingQueueConsumer.test.ts` for consumer lifecycle, drain locking, run-level concurrency, and notification behavior.
- Extend the existing queue coverage in `src/features/knowledge-embedding/tests/unit/RagPipelineOrchestrator.test.ts` for queue ownership and queue invariants where appropriate.
- Extend `src/features/knowledge-embedding/tests/integration/KnowledgeEmbeddingQueueRegistration.integration.test.ts` for root-container singleton identity and dependency wiring.
- Add focused hook/bootstrap integration coverage under the existing knowledge-embedding integration test directory. Mock native modules and persistence at the existing test boundaries; do not replace the queue with a second test abstraction.

### Execution Order

1. Run queue and consumer unit tests in isolation to validate subscription ownership and concurrency behavior.
2. Run DI registration integration tests to validate application-wide identity and wiring.
3. Run hook/bootstrap/recovery integration tests to validate lifecycle independence and completion refresh behavior.
4. Run the full knowledge-embedding test suite, then typecheck the workspace.

Phase 2 should not begin until this blueprint is reviewed and approved.

**Approval gate:** Please review the test IDs, expected behavior, and proposed test placement. Confirm approval before generating production contract stubs or red test cases.