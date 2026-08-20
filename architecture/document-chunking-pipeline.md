# Feature: Document Chunking Pipeline

## 1. Architectural Context

### Relevant Existing Components

| Component | Responsibility | Relevance to Feature |
| --- | --- | --- |
| `src/shared/domain/services/DocumentChunkingService.ts` | Defines `ChunkingConfig`, `ChunkingContext`, and the chunking service contract. | Reuse as the domain boundary for chunk generation; extend the context only for structured elements and strategy inputs that are required by the approved behavior. |
| `src/shared/application/services/DocumentChunkingService.ts` | Normalizes text, invokes the LangChain splitter, creates ordered `KnowledgeChunk` results, and provides a fallback helper. | Retain as the default deterministic strategy implementation, but make strategy selection and fallback explicit at the application boundary. |
| `src/shared/application/usecases/ParseDocumentUseCase.ts` | Validates parser input and delegates document parsing through `ParserRegistry`. | Execute after document validation and persist its `ParsedDocumentText` result as the versioned extraction artifact. |
| `src/shared/domain/services/DocumentParser.ts` | Defines parser input and the `ParsedDocumentText` output, including page metadata, section hints, language, and warnings. | Reuse as the parsing contract between parsing and persistence; extend only when structural metadata is actually supported by a parser. |
| `src/shared/domain/entities/ExtractedDocumentText.ts` | Defines and validates the durable normalized parsed-text artifact. | Persist one extracted artifact per document version so later stages can retrieve it without reparsing the original file. |
| New `ExtractedDocumentTextRepository` and Drizzle adapter | Stores and retrieves parsed text by document/version. | Provides the explicit "Extract Parsed Document" hand-off before `ChunkDocumentUseCase`. |
| `src/shared/domain/entities/KnowledgeChunk.ts` | Defines and validates the persisted chunk entity. | Reuse as the output contract; preserve stable document/version/chunk identifiers for idempotent retries. |
| `src/features/knowledge-embedding/application/ChunkDocumentUseCase.ts` | Validates input, starts the workflow, invokes chunking, supersedes prior chunks, persists chunks, and updates workflow state. | Main orchestration owner. It must coordinate strategy selection, per-unit persistence, checkpoint updates, resume, and partial failure. |
| `src/shared/domain/services/DocumentChunkingWorkflow.ts` | XState state machine and transition helper for document-level lifecycle states. | Reuse for coarse stage lifecycle. Do not expose individual chunking algorithms as workflow states; add only states/events needed to represent resumable unit progress if the existing context cannot carry it. |
| `src/shared/domain/repositories/DocumentChunkingWorkflowRepository.ts` | Contract for the outer document-level workflow lifecycle. | Keep this contract limited to stage-level status and hand-off; it must not expose `ChunkDocumentUseCase` strategy, unit, fallback, or internal checkpoint state to the RAG pipeline. |
| `src/shared/infrastructure/repositories/DrizzleDocumentChunkingWorkflowRepository.ts` | SQLite adapter for outer workflow records. | Continue persisting only the coarse stage lifecycle visible to the RAG pipeline. |
| New internal `ChunkDocumentUseCase` progress port and Drizzle adapter | Persists strategy selection, internal processing-unit checkpoints, fallback events, and unit failures. | Owns resumability inside the chunking stage without expanding the outer RAG workflow contract. |
| `src/shared/domain/repositories/` and `src/shared/infrastructure/repositories/DrizzleChunkRepository.ts` | Repository contracts and SQLite persistence for chunks, including `saveMany`, lookup, and supersession. | Reuse chunk persistence and make `save`/unit writes safely repeatable by stable chunk identity. Add a narrow lookup or unit-status operation only if resume cannot be derived from existing data. |
| `src/shared/infrastructure/database/schema.ts` and `src/shared/infrastructure/database/migrations.ts` | Drizzle schema declarations and bundled SQLite migrations. | Add only the durable fields or table needed to represent per-unit checkpoints and recorded fallback/failure events. Keep migrations backward compatible. |
| `__tests__/unit/domain/ragDomain.test.ts` | Existing unit coverage for chunk output and workflow checkpoint persistence. | Extend with strategy selection, fallback recording, empty input, hard-limit, and resume contract tests. |
| `src/features/knowledge-embedding/tests/integration/DrizzleKnowledgePersistence.integration.test.ts` | Integration coverage for persistence across database reopen. | Extend or add a focused integration test proving chunks and checkpoint/unit state survive interruption and database reopen without duplicates. |

### Architectural Constraints

* Preserve the repository's Clean Architecture dependency direction: feature/application orchestration depends on domain contracts; infrastructure implements persistence and external adapters.
* Keep `ChunkDocumentUseCase` as one coarse-grained pipeline stage. Strategy implementations are internal collaborators, not top-level workflow stages.
* Use the existing Drizzle-backed SQLite persistence path. Do not introduce direct SQLite access in domain or application code.
* Preserve `KnowledgeChunk` IDs based on document, version, and chunk index so repeated execution can be idempotent.
* Reuse the existing XState document lifecycle rather than adding a second state-management library or parallel workflow engine.
* Document parsing is an upstream pipeline step and is included only for its hand-off and persistence contract; parser algorithm implementation remains outside this chunking plan.
* The current default splitter is text-oriented and currently applies the first page number only; structured hierarchy/table preservation requires an explicit input contract before the strategy can claim that behavior.

## 2. Proposed Architecture

### Data Flow

```text
Original document
    ↓
Document validation
    ↓
ParseDocumentUseCase
    ↓
Persist ExtractedDocumentText
    ↓
Extract Parsed Document step retrieves the versioned artifact
    ↓
RAG pipeline invokes ChunkDocumentUseCase stage
    ↓
ChunkDocumentUseCase-owned strategy selector
    ↓
ChunkDocumentUseCase-owned internal processing units
    ↓
KnowledgeChunk results + stage-level completion
    ↓
RAG pipeline hands results to embedding stage
```

Document validation creates or locates the `DocumentVersion`. After validation succeeds, `ParseDocumentUseCase` parses the original document and persists the normalized result as `ExtractedDocumentText`, keyed by document ID and document version. The separate **Extract Parsed Document** step retrieves that persisted artifact and passes it to `ChunkDocumentUseCase`.

The RAG pipeline sees only the public contracts of these coarse stages: validation, parsing, extracted-document retrieval, and chunking. It does not load, interpret, or transition `ChunkDocumentUseCase`'s internal strategy/unit/checkpoint state. `ChunkDocumentUseCase` owns its internal progress store and resumes internally when invoked again for the same document version and processing scope.

Here, an **internal processing unit is not an individual `KnowledgeChunk`**. It is the smallest deterministic slice of parsed document elements that the selected strategy can process and checkpoint atomically, such as a page, section, table, or bounded group of related elements. A unit may produce zero, one, or multiple `KnowledgeChunk` entities. The unit boundary is an implementation detail of `ChunkDocumentUseCase` and may vary by strategy; it must not become part of the outer RAG pipeline contract.

The strategy selector evaluates document type, structure, metadata, prior internal processing results, and configured limits. It returns an applicable strategy ordered by preference. The default text strategy reuses `DefaultDocumentChunkingService`; specialized handling for structured elements or tables should be added as separate internal strategy implementations behind a small common strategy contract.

For each internal unit, `ChunkDocumentUseCase` persists its generated chunks and then advances its own checkpoint. The checkpoint write must occur after the chunk write succeeds. On an internal resume, completed units are skipped and failed/incomplete units are retried. Fallback selection and strategy failures are recorded in the internal progress store and surfaced to the outer pipeline only through the stage-level outcome or diagnostics contract.

If chunking fails after parsing has completed, the retry path starts at **Extract Parsed Document**, retrieves the existing `ExtractedDocumentText` artifact, and invokes `ChunkDocumentUseCase` again. It must not parse the original document again unless the extracted artifact is missing, invalid, incomplete, or explicitly invalidated by a source/parser version change.

### Chunking Strategy

The first implementation should use the following ordered strategy pipeline inside `ChunkDocumentUseCase`:

1. **Structural enrichment when available.** Consume parser output that contains page boundaries, paragraph boundaries, section hints, headings, tables, or OCR layout blocks. The current `DocumentParser` contract provides normalized text and page metadata, and declares `sectionHints`, but the current `PdfTextParser` only populates a single page and does not extract headings or sections. The current ML Kit OCR adapter provides text blocks, lines, and bounding boxes, which can support layout-based paragraph or heading heuristics, but it does not provide semantic heading or section labels directly.
2. **Default document chunk strategy.** Use LangChain `RecursiveCharacterTextSplitter` with sentence-first separators, a maximum **character** length, and configurable character overlap. Prefer separators in this order: paragraph break, line break, sentence boundary, whitespace, then individual characters. Configure `lengthFunction` to count characters for this strategy; do not use the current word-count length function when the requirement is a character limit.
3. **Deterministic fallback.** If structural input is absent or a preferred structural strategy fails, run the same splitter against normalized plain text with the configured character limit and overlap, then record the fallback and reason in `ChunkDocumentUseCase` internal progress.

The initial structural strategy should be conservative: preserve parser-provided boundaries and metadata, but do not claim reliable heading or section extraction until representative PDF, DOCX, and OCR fixtures demonstrate it. Heading detection from OCR should be treated as a heuristic based on layout signals such as line bounds, line length, capitalization, repetition, and surrounding whitespace, with confidence and warnings recorded rather than silently treating every short line as a heading.

### State Flow

```text
Idle
 ↓
Document received
 ↓
Document validated
 ↓
Document parsing in progress
 ↓
ExtractedDocumentText persisted
 ↓
Extract Parsed Document
 ↓
ChunkDocumentUseCase in progress
 ↓
Internal unit selected
 ↓
Internal unit processing
 ├─ success → persist chunks → checkpoint unit → next unit
 ├─ preferred strategy failure → record failure → fallback strategy
 └─ unit failure → persist failure state → retry incomplete unit
 ↓
All units checkpointed
 ↓
Document chunking complete
 ↓
Persisted / completed
```

The outer document-level states should distinguish parsing from chunking: `document_received`, `validation_pending`, `validation_passed`, `parsing_in_progress`, `text_extracted`, `extracting_document`, `chunking_in_progress`, `chunking_complete`, `persisting_chunks`, `completed`, `failed`, and `superseded`. `text_extracted` means the `ExtractedDocumentText` artifact has been durably persisted; `extracting_document` means the retrieval hand-off is in progress. These are the only states visible to the outer RAG pipeline. Unit status, selected strategy, fallback reason, and last safe unit belong to `ChunkDocumentUseCase`-owned progress data and must not be added to the outer workflow state machine.

## 5. Data / Persistence Changes

The existing `knowledge_chunks` table is sufficient for stable chunk identity and idempotent upsert behavior. Preserve the current primary key and document/version indexes. Do not add embeddings or vector fields.

Persist the parsed document before chunking. The existing `ExtractedDocumentText` entity should be backed by an `ExtractedDocumentTextRepository` with operations to save/upsert and retrieve by document ID plus version. Its persisted record should include normalized text, page metadata and offsets, section hints when available, language, parser warnings, creation/update timestamps, and an extraction/parser fingerprint if parser-version invalidation is needed.

The parsing artifact is immutable for a given document version and extraction fingerprint. A retry of chunking reads this artifact; it does not reread or reparse the original file. If parsing is retried, the artifact should be replaced only under an explicit extraction retry or parser/source invalidation policy.

The existing `document_chunking_workflows` record should remain the outer stage lifecycle record. Do not add `ChunkDocumentUseCase` unit state, strategy state, or fallback details to this record merely to support internal resume.

Add a separate internal `ChunkDocumentUseCase` progress representation that supports:

* last safe processing unit or chunk index;
* deterministic processing scope for document ID and version;
* unit/stage status sufficient to distinguish completed, failed, and incomplete work;
* selected strategy and fallback usage/reason where fallback occurs;
* failure reason and retry information;
* resume intent and timestamps/correlation information where needed for observability.

Prefer a structured progress payload on the existing workflow record if the project accepts JSON metadata for workflow state. Introduce a separate checkpoint/unit table only if atomic querying or multiple independent units cannot be represented safely in that payload. If a new table is required, add its Drizzle schema and a bundled migration with indexes for document/version and unit identity.

Define the internal progress port in the `ChunkDocumentUseCase` application boundary before changing its Drizzle adapter. Required operations should support loading progress for a document version and processing scope, recording a successful unit atomically with its checkpoint where possible, and recording fallback/failure events. The outer `DocumentChunkingWorkflowRepository` should receive only stage-level transitions. The chunk repository should retain repeatable `save` semantics keyed by chunk ID; avoid marking current-version chunks superseded until the new run has a complete, valid result set.

Update schema and migrations together. Add the extracted-document table and indexes for document/version lookup, plus any internal chunk progress storage. Existing workflow rows must remain readable with default empty progress and no fallback event. The parse and retrieval stages must update the outer workflow only after their respective persistence/read hand-offs succeed.

## 6. Error Handling & Resilience

* Invalid, incomplete, or empty input is rejected before strategy execution; no invalid chunks are persisted, and the workflow records the reason.
* Document parsing failures leave the document version failed or retryable and do not advance it to `text_extracted`.
* A successfully parsed document is persisted before the workflow reports `text_extracted`.
* If the extracted artifact is missing, corrupt, incomplete, or invalidated, the pipeline reruns parsing before attempting chunking.
* If the extracted artifact is valid, a chunking retry begins with retrieval and does not reparse the original document.
* A preferred strategy failure is recorded in `ChunkDocumentUseCase`-owned progress with document/version, internal unit, strategy, and reason. If a fallback applies, processing continues and the fallback event is observable through the stage diagnostics/result without exposing the internal state model to the RAG pipeline.
* If no strategy can process an internal unit, preserve completed units, mark only the affected internal work incomplete/failed, and leave the `ChunkDocumentUseCase` stage retryable rather than reporting full completion.
* Persist an internal unit's chunks before advancing the `ChunkDocumentUseCase` checkpoint. Resume must treat a chunk with an existing deterministic ID as already completed and must not duplicate it.
* On restart, `ChunkDocumentUseCase` loads its last safe checkpoint and skips completed internal units. It retries only failed or incomplete units for the same document version and processing scope.
* Use the existing workflow retry/circuit fields for stage-level retry accounting; do not silently reset retry state during resume.
* A newer document version is a separate processing scope. Do not resume an older version's units into the newer version.
* Preserve existing chunks and checkpoints when persistence or an external strategy dependency fails. Mark prior-version chunks superseded only after the current version's complete result is safely persisted.
* The application layer should surface a clear failed or partial result to its caller while keeping enough durable state for a later retry. Cancellation behavior is limited to preserving the last completed checkpoint because no UI cancellation contract is currently defined.

## 11. Implementation Sequence

1. Extend the outer workflow contract with explicit parsing, parsed-artifact persistence, and extracted-document retrieval states while keeping `ChunkDocumentUseCase` internal state private.
2. Add the `ExtractedDocumentTextRepository` domain contract and its Drizzle/SQLite persistence, including document/version lookup and extraction fingerprint handling.
3. Connect `ParseDocumentUseCase` to persist `ParsedDocumentText` as `ExtractedDocumentText` before transitioning the version to `text_extracted`.
4. Add the **Extract Parsed Document** step that retrieves the persisted artifact and supplies it to `ChunkDocumentUseCase`; do not pass original-file parsing responsibilities into chunking.
5. Add or refine domain types for a common chunking strategy, strategy-selection input/result, and `ChunkDocumentUseCase`-owned processing-unit progress and recorded fallback/failure information. Keep these types outside the outer RAG workflow contract.
6. Extend `ChunkingContext` only with the structured document elements and metadata required to preserve hierarchy, tables, and other supported special elements.
7. Refactor `DefaultDocumentChunkingService` behind the strategy contract while preserving its current deterministic output and public service compatibility.
8. Implement strategy selection with structural enrichment when parser metadata supports it, LangChain sentence-first character splitting as the default strategy, and a deterministic normalized-text fallback. Record selection and fallback outcomes without adding workflow stages.
9. Define an internal `ChunkDocumentUseCase` progress repository and persistence model for per-unit checkpoint/progress data, then update the Drizzle schema and bundled migration. Leave `DocumentChunkingWorkflowRepository` stage-level only.
10. Extend `ChunkRepository` only where needed for repeatable unit persistence or completion lookup; preserve stable chunk IDs and existing version-aware queries.
11. Update `ChunkDocumentUseCase` to process its internal units, persist chunks before internal checkpoints, resume from the last safe checkpoint, retry incomplete units, and return only the agreed stage-level result to the RAG pipeline. Defer supersession until successful completion.
12. Add unit tests for parse persistence, retrieval on chunk retry, no reparsing when extraction is valid, sentence-first character limits, overlap, structural metadata preservation, strategy selection, fallback recording, invalid/empty input, deterministic IDs, partial failure, and idempotent resume.
13. Add SQLite integration tests for extracted-text persistence across reopen, checkpoint persistence across reopen, retry after failure, no duplicate chunks, and preservation of completed units.
14. Run the repository typecheck and focused Jest tests, then review the migration and workflow compatibility with existing RAG persistence tests.

## 15. Implementation Guardrails

* Reuse `DocumentChunkingService`, `KnowledgeChunk`, `ChunkRepository`, `DocumentChunkingWorkflow`, and their existing Drizzle adapters before creating alternatives.
* Keep `ChunkDocumentUseCase` internal progress separate from `DocumentChunkingWorkflowRepository`; the outer RAG pipeline must not depend on internal unit, strategy, or checkpoint states.
* Persist `ExtractedDocumentText` before reporting `text_extracted`; do not make chunk retries depend on the original file being available.
* Make the **Extract Parsed Document** step read the versioned parsed artifact and pass that artifact to `ChunkDocumentUseCase`.
* Do not reparse a valid extracted artifact during a chunk retry. Reparse only for missing, invalid, incomplete, or explicitly invalidated extraction data.
* Treat an internal processing unit as a deterministic slice of parsed elements, never assume it is one `KnowledgeChunk`, and never expose that unit boundary as an outer workflow stage.
* Keep strategy selection and execution behind domain/application contracts; do not expose individual algorithms as top-level workflow stages.
* Keep `ChunkDocumentUseCase` checkpoint writes durable and ordered after successful chunk persistence for each internal unit.
* Preserve deterministic chunk IDs and make retries safe when a chunk already exists.
* Do not mark current-version chunks superseded until the replacement run has completed successfully.
* Keep structured context in `ChunkingContext` and `KnowledgeChunk.metadata` or an explicitly approved domain field; do not place business rules in the SQLite adapter.
* Record every preferred-strategy failure and fallback with enough document/version/unit context to diagnose it later.
* Do not add embeddings, SQLite-Vec/vector search, new parser implementations, retrieval ranking, UI, or monitoring screens. The parsing hand-off and artifact persistence are in scope; parser algorithm expansion is not.
* Do not introduce a new state-management library, workflow engine, or persistence technology.
* Update tests and migrations with contract changes; do not weaken existing persistence or entity validation tests.
* Limit changes to the shared RAG domain/application/infrastructure modules, the knowledge-embedding use case, related migrations, and focused tests.
