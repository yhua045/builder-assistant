# Test Blueprint: RAG Pipeline Orchestrator First Two Steps

## Phase 1: Test Scenarios & Purposes

The first two steps are split across two responsibilities:

- `RagPipelineOrchestrator` owns workflow creation, queue publication, queued-item validation, parsing, and extracted-text persistence.
- `KnowledgeEmbeddingQueueConsumer` is the worker/dispatcher. It drains `InMemoryWorkflowQueue`, prevents duplicate active run execution, and delegates each item to a pipeline executor.

The consumer is not required to test the orchestrator's parsing behavior directly. Orchestrator integration tests can invoke `executeQueuedItem` with a queued item. A separate consumer test verifies that queue work reaches that method through the worker path.

### Domain Entity & Validation Tests

- Verify a created `KnowledgeEmbeddingRun` has the requested document id, `pending` status, parsing as its initial stage, and a non-empty run id.
- Verify a published `KnowledgeEmbeddingQueueItem` contains the matching run id, document id, and document version `1`.
- Verify a queue item cannot execute when its run id does not match the durable workflow.
- Verify an empty document id is rejected before repository or queue access.

### Workflow & State Transition Tests

- `execute(documentId)` persists a pending parent workflow and publishes one queue item.
- Repeated `execute` for the same active document reuses the existing workflow and does not publish a duplicate item.
- `executeQueuedItem(item)` validates the durable workflow and document before parsing.
- A valid queued item persists running/parsing state, invokes the production parser path, and persists extracted text for the document/version.
- A completed or cancelled queued workflow is treated as a no-op.
- `KnowledgeEmbeddingQueueConsumer.start()` drains queued work and delegates each item to the executor.
- The consumer prevents concurrent duplicate processing for the same run id and continues draining independent items.
- The consumer catches executor failures, allowing the worker to continue without losing queue ownership.

### Contract & API Surface Tests

- `KnowledgeEmbeddingRunRepository` is the parent workflow persistence contract.
- `DocumentChunkingWorkflowRepository` is the chunking-stage persistence contract used by queued execution.
- `ParserRegistry` selects the production `PdfTextParser` for `sourceType: 'pdf'` and applies shared normalization.
- `ParseDocumentUseCase.execute` validates input and persists parser output through `ExtractedDocumentTextRepository`.
- `KnowledgeEmbeddingQueueConsumer` receives an executor with the queued-item execution contract. Align the contract around `executeQueuedItem(item)` because that name expresses the orchestrator's actual responsibility and avoids confusing queue draining with document-level execution. The consumer should depend on a narrow interface exposing `executeQueuedItem(item): Promise<unknown>`.

## Test Execution Plan

| Test ID | Target Component/Interface | Scenario / Trigger | Expected Behavioral Outcome | Test Type (Unit/Integration) |
| --- | --- | --- | --- | --- |
| RPO-001 | `RagPipelineOrchestrator.execute`, `DrizzleDocumentRepository`, `DrizzleKnowledgeEmbeddingRunRepository`, `InMemoryWorkflowQueue` | Seed one document in migrated in-memory SQLite and call `execute(documentId)` | One durable pending/parsing parent workflow exists; returned run matches it; exactly one matching queue item is published | Integration |
| RPO-002 | `RagPipelineOrchestrator.executeQueuedItem`, `ParserRegistry`, `PdfTextParser`, `ParseDocumentUseCase`, `DrizzleExtractedDocumentTextRepository` | Dequeue RPO-001 and execute it with PDF metadata and fixture content supplied through `rawText` | Production parser selection succeeds; extracted text is normalized and persisted for document/version; the workflow reaches the tested downstream boundary | Integration |
| RPO-003 | `RagPipelineOrchestrator.execute` | Call `execute` twice for the same active document | Existing workflow is returned, no second parent row is created, and no duplicate queue item remains | Integration |
| RPO-004 | `KnowledgeEmbeddingQueueConsumer` | Start the consumer with queued items and an executor spy | Each item is delegated once; the consumer drains until empty | Unit |
| RPO-005 | `KnowledgeEmbeddingQueueConsumer` | Publish the same run while that run is being processed | Duplicate work is ignored or deduplicated; the executor has at most one active call for the run id | Unit |
| RPO-006 | `KnowledgeEmbeddingQueueConsumer` | One executor call rejects while another item remains queued | The failure is contained by the worker and independent queued work still processes | Unit |
| RPO-007 | `RagPipelineOrchestrator.executeQueuedItem` | Queue item has a missing workflow, mismatched run id, or missing document | Execution rejects before parser invocation and does not create extracted-text rows | Integration |
| RPO-008 | `RagPipelineOrchestrator.executeQueuedItem` | Parser or extracted-text persistence fails | Failure is propagated, workflow failure state is persisted, and downstream chunking is not invoked | Integration |
| RPO-009 | `KnowledgeEmbeddingQueueConsumer` and `RagPipelineOrchestrator` | Publish a queue item, start the consumer, and provide the orchestrator as the executor | The consumer drains the queue and invokes `orchestrator.executeQueuedItem(item)` exactly once; the orchestrator performs the queued workflow behavior | Integration |
| RPO-010 | `KnowledgeEmbeddingQueueConsumer` executor contract | Provide an executor exposing only `executeQueuedItem`, then publish work | Type/runtime wiring uses the aligned method and does not attempt to call a legacy `execute` method | Unit |

## Test Execution Plan Details

- Use the existing `better-sqlite3` `:memory:` adapter and bundled migrations for repository-backed integration tests.
- Seed documents through `DrizzleDocumentRepository`; verify durable parent state through `DrizzleKnowledgeEmbeddingRunRepository` and stage state through `DrizzleDocumentChunkingWorkflowRepository`.
- Reuse production parser components: register `PdfTextParser` in `ParserRegistry`, set the fixture document to PDF metadata, and provide deterministic fixture content through `rawText`. Do not add `DeterministicTextParser`.
- Keep the orchestrator integration slice focused on parsing and extracted-text persistence. Downstream chunking and embedding collaborators may be no-op test collaborators where the scenario does not cover those stages.
- Test the consumer independently with `InMemoryWorkflowQueue` and an executor spy implementing `executeQueuedItem`. The consumer is a worker boundary, not a substitute for orchestrator execution tests.
- Add the consumer-to-orchestrator integration scenario after aligning the executor contract. It should prove queue publication, consumer drain, delegation to `executeQueuedItem`, and durable parsing behavior together without duplicating all orchestrator cases.
- The implementation must update the `KnowledgeEmbeddingPipelineExecutor` interface and its consumer call site from `execute(item)` to `executeQueuedItem(item)`, then update the DI factory to pass the orchestrator directly as that executor.
- Reset the in-memory database between integration scenarios and stop consumers after each worker test.
- Run the focused integration suite, existing consumer unit suite, and `npx tsc --noEmit`.

## Phase Gate

This blueprint separates orchestrator behavior from worker behavior. Unit coverage for the consumer is appropriate because its concurrency and drain semantics are local; SQLite integration coverage is appropriate for orchestrator persistence and parser flow. RPO-009 is the contract-level integration guard: it catches queue items being drained without reaching the orchestrator. Phase 2 should generate or update only the approved scenarios after review, with no new deterministic parser implementation.
