# #235 — Document Chunking Design Plan

Issue: #235  
Status: Draft pending approval  
Date: 2026-08-14

## Goal

Build the first stable slice of the local RAG pipeline: deterministic chunk generation from extracted document text, explicit document-version handling, and SQLite-safe persistence without introducing embeddings, ranking, or model-dependent logic.

This design is intentionally narrow. It creates a reliable contract for later extraction, embedding, and retrieval work while preserving historical chunk records and making stale data explicit.

---

## 1. Domain Model & Entities

### DocumentVersion
Represents a distinct processing version of a single document upload.

Fields:
- `id: string`
- `documentId: string`
- `version: number`
- `projectId?: string`
- `status: 'received' | 'validated' | 'extracted' | 'chunked' | 'persisted' | 'failed' | 'superseded'`
- `sourceType?: 'pdf' | 'image' | 'text' | 'docx'`
- `createdAt: Date`
- `updatedAt?: Date`

Responsibilities:
- model the lifecycle of one document revision
- act as the boundary for chunk generation and obsolescence checks
- keep a versioned lineage between historical and active chunks

### KnowledgeChunk
This is the canonical persisted chunk shape. It should remain intentionally plain and explainable.

Fields:
- `id: string`
- `documentId: string`
- `documentVersion: number`
- `projectId?: string`
- `content: string`
- `chunkIndex: number`
- `pageNumber?: number`
- `section?: string`
- `heading?: string`
- `documentType?: string`
- `revision?: string`
- `startOffset?: number`
- `endOffset?: number`
- `wordCount?: number`
- `charCount?: number`
- `tokenCount?: number`
- `isOutdated: boolean`
- `isSuperseded: boolean`
- `supersededByChunkId?: string`
- `supersededAt?: Date`
- `createdAt: Date`
- `updatedAt?: Date`

Responsibilities:
- preserve the normalized chunk text and document provenance
- maintain ordering and source metadata for later evidence tracing
- indicate stale state when a newer version supersedes the chunk

### ChunkingContext
A transient value object used during pipeline execution.

Fields:
- `documentId: string`
- `documentVersion: number`
- `rawText: string`
- `pageMetadata?: Array<{ pageNumber: number; text: string }>`
- `sectionHints?: Array<{ heading: string; text: string }>`
- `config: ChunkingConfig`

Responsibilities:
- centralize the deterministic inputs for chunk generation
- keep the algorithm stateless and testable
- allow later extension for OCR output or normalization stages

### WorkflowState
Represents orchestration state for the chunking pipeline.

States:
- `idle`
- `document_received`
- `validation_pending`
- `text_extracted`
- `chunking_in_progress`
- `chunking_complete`
- `persisting_chunks`
- `completed`
- `failed`
- `superseded`

Responsibilities:
- model checkpointed progress
- make retries and future transitions explicit
- keep local processing state inspectable for debugging

---

## 2. Key Abstractions & Interfaces

### DocumentChunkingService
The core domain/application contract that converts raw document text into ordered `KnowledgeChunk[]`.

```ts
export interface DocumentChunkingService {
  chunkDocument(context: ChunkingContext): Promise<KnowledgeChunk[]>;
  chunkParagraphs(text: string, config: ChunkingConfig): KnowledgeChunk[];
}
```

Contract rules:
- input is deterministic and side-effect free
- output ordering is stable and source-aware
- chunk creation is independent of SQLite persistence
- no embedding generation, semantic ranking, or model inference

### ChunkingConfig
Configuration object used by the chunker.

```ts
export interface ChunkingConfig {
  targetMinWords: number;
  targetMaxWords: number;
  hardMaxWords: number;
  mergeThresholdWords: number;
  preferBoundary: Array<'page' | 'section' | 'paragraph' | 'sentence' | 'word'>;
}
```

Defaults:
- target min: 80 words
- target max: 600 words
- hard max: 900 words

### KnowledgeChunkRepository
Repository boundary for persistence and retrieval.

```ts
export interface KnowledgeChunkRepository {
  save(chunk: KnowledgeChunk): Promise<void>;
  saveMany(chunks: KnowledgeChunk[]): Promise<void>;
  findByDocumentId(documentId: string): Promise<KnowledgeChunk[]>;
  findByDocumentVersion(documentId: string, version: number): Promise<KnowledgeChunk[]>;
  markSuperseded(oldChunkIds: string[], newerChunkId: string, supersededAt: Date): Promise<void>;
  deleteByDocumentId(documentId: string): Promise<void>;
}
```

This repository should not contain chunking logic. It is responsible for persistence only.

### ChunkingWorkflow
Optional state machine wrapper used to coordinate the pipeline across phases.

Recommended shape:
- `idle`
- `document_received`
- `validation_pending`
- `text_extracted`
- `chunking_in_progress`
- `chunking_complete`
- `persisting_chunks`
- `completed`
- `failed`
- `superseded`

A minimal XState-style state machine is enough for the first implementation. We are not introducing a larger event bus or full runtime orchestration at this stage.

---

## 3. Source Code Structure

The design should follow the project’s current clean architecture boundaries.

```text
src/
  domain/
    entities/
      KnowledgeChunk.ts
      DocumentVersion.ts
    services/
      DocumentChunkingService.ts
      ChunkingConfig.ts
    repositories/
      KnowledgeChunkRepository.ts

  application/
    services/
      DefaultDocumentChunkingService.ts
    use-cases/
      ProcessDocumentChunkingUseCase.ts
    workflows/
      documentChunkingMachine.ts

  infrastructure/
    database/
      schema.ts
      migrations.ts
    repositories/
      DrizzleChunkRepository.ts

  features/
    knowledge-embedding/
      domain/
      application/
      infrastructure/
```

### Module boundaries
- Domain: pure types and business rules only
- Application: orchestration, validation, deterministic conversion logic
- Infrastructure: SQLite repository and migrations
- Features: future embedding/retrieval layers, kept separate from chunk generation

### Database contract
The existing schema already contains a `knowledge_chunks` table and should be expanded to include the versioning metadata required by this design:

```ts
export const knowledgeChunks = sqliteTable('knowledge_chunks', {
  id: text('id').primaryKey(),
  documentId: text('document_id').notNull(),
  documentVersion: integer('document_version').notNull(),
  projectId: text('project_id'),
  content: text('content').notNull(),
  chunkIndex: integer('chunk_index').notNull(),
  pageNumber: integer('page_number'),
  section: text('section'),
  heading: text('heading'),
  documentType: text('document_type'),
  revision: text('revision'),
  startOffset: integer('start_offset'),
  endOffset: integer('end_offset'),
  wordCount: integer('word_count'),
  charCount: integer('char_count'),
  tokenCount: integer('token_count'),
  isOutdated: integer('is_outdated', { mode: 'boolean' }).notNull().default(false),
  isSuperseded: integer('is_superseded', { mode: 'boolean' }).notNull().default(false),
  supersededByChunkId: text('superseded_by_chunk_id'),
  supersededAt: integer('superseded_at'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at'),
});
```

This matches the project’s existing Drizzle and SQLite conventions while preserving the historical lineage required for version-aware retrieval.

---

## 4. Architectural Trade-offs & Risks

### Determinism over flexibility
We intentionally avoid semantic or embedding-aware chunking in this phase. This makes the output stable and easy to test, but it may create slightly less optimal chunk boundaries for advanced retrieval later.

Trade-off:
- benefit: predictable chunk output and simple unit/integration tests
- cost: not optimized for retrieval quality yet

### Versioning semantics vs. storage simplicity
Keeping old chunks instead of deleting them is more complex to query and reason about, but it is the safest pattern for future fact extraction and evidence provenance.

Trade-off:
- benefit: historical integrity and transparent supersession
- cost: more repository logic and additional filtering for active vs. stale records

### Boundary preservation vs. chunk size optimization
Paragraph, section, and page-aware splitting improves readability and provenance, but may create a few chunks that exceed or fall short of the ideal target range.

Mitigation:
- use paragraph merge rules before fallback to sentence and word splitting
- enforce hard max and minimum chunk size in deterministic ways

### SQLite compatibility
Local-first storage must remain fast and predictable. Overly complex indexes or JSON blobs reduce portability and slow down tests.

Mitigation:
- store structural metadata as typed columns
- keep chunk content as plain text
- index by `document_id`, `document_version`, and `chunk_index`

### Future-proofing
The chunking contract must not assume retrieval or embedding exist yet. If later stages add `embeddingId`, `retrievalScore`, or vectors, they should be modeled as separate concern-specific tables rather than bloating `KnowledgeChunk`.

---

## 5. Proposed Processing Flow

```text
Document upload
  -> DocumentVersionCreated
  -> Validation
  -> Text extraction / OCR / normalization
  -> DocumentChunkingService.chunkDocument()
  -> KnowledgeChunk[]
  -> Version-aware supersession check
  -> saveMany() in SQLite
  -> completed
```

### Version-aware obsolescence rule
When a new document version is processed:
1. create the new versioned chunk set
2. mark older chunks as `isOutdated = true`
3. mark them as `isSuperseded = true`
4. populate `supersededByChunkId` and `supersededAt`
5. keep them in the database for historical traceability

This rule should be enforced in the application service, not as a hidden repository side effect.

---

### Step 1: `document_received` checkpoint creation and resume contract
The `document_received` state is the durable intake checkpoint. Its purpose is not just to move the state machine forward; it is the point where we create the first persisted workflow record for a specific document version and guarantee that the pipeline can be resumed safely after an interruption or failure.

#### Required persistence behavior
When the workflow receives a `DOCUMENT_RECEIVED` event, the application must:
- create or upsert a durable `DocumentVersion` (or equivalent checkpoint record) keyed by `documentId + documentVersion + projectId`
- set the record status to `received`
- set the workflow state to `document_received`
- persist `lastEvent`, `retryCount`, `circuitOpen`, `updatedAt`, and `createdAt`
- persist the originating request metadata: source type, file/reference id, and the client request context if available
- treat the operation as idempotent so repeated delivery of the same event does not create duplicate workflow rows

This checkpoint record is the source of truth for resume logic. If the app restarts or a later stage fails, the system can query the most recent record and continue from the last safe checkpoint instead of losing the workflow state.

#### Required fields for the persisted checkpoint
At minimum the checkpoint record should include:
- `id`
- `documentId`
- `documentVersion`
- `projectId?`
- `status` (`received`, `validated`, `extracted`, `chunked`, `persisted`, `failed`, `superseded`)
- `workflowState` (`idle`, `document_received`, `validation_pending`, ...)
- `lastEvent`
- `retryCount`
- `circuitOpen`
- `lastError?`
- `supportedForAnalysis?`
- `createdAt`
- `updatedAt`
- `completedAt?`

This guarantees that both workflow lifecycle and business outcome are captured in one durable record.

#### Retry and resume semantics
The `document_received` step must explicitly support resume behavior:
1. If a previous checkpoint already exists for the same document version and is still in a recoverable state, the workflow must resume from the persisted record rather than create a new one.
2. If an earlier stage is already persisted as successful (`validated`, `text_extracted`, etc.), the service must not re-run upstream work unless it is required by the recovery policy.
3. `retryCount` must be persisted and incremented only when the workflow transitions out of a failure state via `RETRY_REQUESTED`.
4. The app must record whether the record was resumed from a checkpoint versus created fresh, so debugging and auditability are preserved.
5. If the system sees the same document version submitted again while the prior one is still active, it should treat the second request as a resume/replay rather than a duplicate processing attempt.

This design intentionally keeps the retry contract outside the chunking algorithm itself. The workflow record gives us a durable, auditable place to resume, while the deterministic chunking logic remains side-effect free and testable.

---

### Step 2: `validation_pending` support verification and persistent result capture
The `validation_pending` state is where the workflow verifies whether the document is supported for analysis before any extraction or chunking work proceeds. This is a gatekeeping step; it does not chunk the text yet, and it should not trigger expensive parsing work unless the document passes validation.

#### Validation intent
The validation step answers three questions before we spend time extracting or chunking:
1. Is the document supported for analysis?
2. Has this exact document version already been analyzed and should we skip reprocessing?
3. Is this a resumable checkpoint or a fresh run?

This gate should verify supported source types, file readability, size/content sanity, and whether the same document/version is already completed or still in progress, then persist the result so it can be resumed or deduped reliably.

#### Required persistence behavior
When the workflow enters `validation_pending`, the service should:
- load the current document checkpoint from storage
- perform document support validation
- persist the result into the same durable checkpoint record
- set `status` to either `validated` or `failed` depending on result
- set `supportedForAnalysis` to `true` / `false`
- persist `lastEvent`, `lastError`, and `updatedAt`
- leave a direct reason for rejection when unsupported, such as `unsupported_file_type`, `empty_document`, `cannot_read_file`, or `document_too_large`

If validation fails, the workflow should not continue to extraction or chunking. The checkpoint should still record the failure with enough detail to support retrial or user-visible feedback later.

#### Supported vs unsupported outcomes
The validation step should produce a structured decision, not just a boolean flag. A good persisted result should capture:
- `supportedForAnalysis: boolean`
- `validationReason?: string`
- `validationVersion?: string`
- `validatedAt?: Date`
- `rejectionCode?: string`

This keeps the pipeline transparent and gives later code a stable contract for whether a document should be sent downstream.

#### Resume semantics for validation
Validation is intentionally checkpointed as a clear boundary:
- if validation passes, the persisted record should advance to `validated` and then proceed to text extraction
- if validation fails, the persisted record should remain in a durable failed state with a rejection reason and retry count
- a later retry should re-run validation from the checkpoint and decide whether the document is still unsupported or recoverable

This means the system does not have to infer intent from logs alone; the persisted checkpoint provides the explicit state needed to resume or diagnose the failure.

---

### Step 3: `text_extracted` — normalized text is the durable input contract
The `text_extracted` stage marks the boundary where raw source content becomes a normalized, versioned text payload. This is the last safe point before chunk generation begins.

Required behavior:
- persist the extracted text, page metadata, and section hints against `documentId + documentVersion`
- record the extraction result as a checkpoint so resume/retry logic can continue without re-parsing the same file
- keep the contract deterministic: same source input => same normalized text and same page offsets
- do not mix OCR/parsing logic with SQLite persistence or chunk generation

Transition rules:
- `VALIDATION_SUCCEEDED` -> `text_extracted` after extraction completes
- `TEXT_EXTRACTED` -> `CHUNKING_STARTED` to move into chunk generation
- any extraction failure should emit `FAILED` with a persisted reason and stop the pipeline

### Step 4: `chunking_in_progress` — deterministic chunk creation with version awareness
The `chunking_in_progress` state is where the extracted text is split into ordered `KnowledgeChunk[]` using paragraph, section, page, sentence, and word boundaries in that order. The algorithm should remain deterministic and side-effect free.

Required behavior:
- load the normalized text + page metadata from the last successful extraction checkpoint
- generate chunks with stable ordering by `chunkIndex`, page, and section
- enforce min/max target word ranges and a hard maximum guardrail
- attach provenance metadata: `documentId`, `documentVersion`, `pageNumber`, `section`, `heading`, offsets, and word/char counts
- if a newer version is being created, mark older chunks as `isOutdated = true` and `isSuperseded = true` with `supersededByChunkId`

Transition rules:
- `CHUNKING_STARTED` -> `chunking_in_progress`
- `CHUNKING_COMPLETED` -> `chunking_complete`
- `FAILED` -> `failed` with persisted error metadata
- `SUPERSEDED` -> `superseded` when a newer document version invalidates the current chunk set

### Proposed source code structure for the extracted + chunking slice

```text
src/
  domain/
    entities/
      DocumentVersion.ts
      KnowledgeChunk.ts
      ParsedDocumentText.ts
    services/
      DocumentChunkingService.ts
      DocumentParser.ts
      ChunkingConfig.ts
    repositories/
      KnowledgeChunkRepository.ts

  application/
    services/
      DefaultDocumentChunkingService.ts
      ParserRegistry.ts
    workflows/
      documentChunkingMachine.ts
    use-cases/
      ParseDocumentUseCase.ts
      ProcessDocumentChunkingUseCase.ts

  infrastructure/
    parsers/
      PdfTextParser.ts
      ImageOcrParser.ts
      TextFileParser.ts
      DocxTextParser.ts
    repositories/
      DrizzleChunkRepository.ts

  features/
    knowledge-embedding/
      domain/
      application/
      infrastructure/
```

This keeps the extraction and chunking logic split cleanly: parse/normalize in the extraction boundary, chunk generation in the application service, and persistence only in the SQLite repository layer.

---

## 6. Acceptance Criteria for the Design

- Chunking is deterministic for identical extracted input.
- Chunk metadata retains document identity, version, page, section, and provenance fields.
- Chunk splitting respects paragraph/section/page boundaries before falling back to sentence and word boundaries.
- Old chunks remain in SQLite and are marked stale rather than discarded silently.
- The workflow can progress from `received` to `persisted` with explicit states for failures or supersession.
- No embedding model, semantic re-ranking, or retrieval logic is introduced in this slice.

---

## 7. Recommended First Implementation Slice

Phase 1 should only include:
- `KnowledgeChunk` entity update
- deterministic chunking algorithm
- `DocumentChunkingService` contract
- minimal workflow state machine
- SQLite repository persistence and versioning updates
- focused unit/integration tests for deterministic output and obsolescence behavior

Phase 2 can add:
- OCR / extraction integration
- embedding generation
- retrieval and ranking
- fact extraction and evidence links

This keeps the architecture incremental while preserving the clean boundary between document chunking and downstream RAG logic.

---

## Appendix: Document Parser Proposal (Phase 2)

This phase introduces the text-extraction boundary that sits between raw file uploads and chunk generation. The parser is intentionally limited to turning source files into normalized text and page-level metadata. It does not perform chunking, ranking, embeddings, or retrieval logic.

### Design intent

The parser should provide a single, deterministic contract for all document types:
- accept a document upload or stored file reference
- extract text content and page/section context
- normalize inconsistent whitespace and line breaks
- return both raw extracted text and source metadata for later chunking
- emit explicit parse failures without mixing extraction logic into SQLite persistence

This preserves a clean pipeline:

```text
raw upload
  -> document parser
  -> normalized text + page metadata
  -> chunking service
  -> SQLite knowledge chunks
```

### Key abstractions

#### DocumentParser
Core application/domain interface for extraction.

```ts
export interface DocumentParser {
  canHandle(input: DocumentParseInput): boolean;
  parse(input: DocumentParseInput): Promise<ParsedDocumentText>;
}
```

Responsibilities:
- identify whether a parser supports the given file/source type
- extract text from the source in a file-type-specific way
- return structured output that the chunker can consume without knowing the original format

#### DocumentParseInput
Represents the input contract passed into the parser.

```ts
export interface DocumentParseInput {
  documentId: string;
  documentVersion: number;
  projectId?: string;
  sourceType: 'pdf' | 'image' | 'text' | 'docx';
  contentType?: string;
  filePath?: string;
  rawText?: string;
  binary?: ArrayBuffer | Uint8Array;
  storageKey?: string;
  options?: {
    preservePages?: boolean;
    includePageBreaks?: boolean;
    normalizeWhitespace?: boolean;
  };
}
```

Responsibilities:
- isolate parser inputs from the persistence layer
- keep source handling explicit and testable
- allow later OCR or PDF pipeline variations without changing downstream code

#### ParsedDocumentText
Canonical output contract for the extraction stage.

```ts
export interface ParsedDocumentText {
  documentId: string;
  documentVersion: number;
  projectId?: string;
  text: string;
  pageMetadata: Array<{
    pageNumber: number;
    text: string;
    startOffset: number;
    endOffset: number;
  }>;
  sectionHints?: Array<{
    heading: string;
    text: string;
  }>;
  language?: string;
  warnings?: string[];
  createdAt: Date;
}
```

Responsibilities:
- bundle normalized extracted content and page-level provenance
- act as the contract boundary between parser and chunker
- keep the chunking algorithm independent of raw file format handling

#### ParserStrategy
Optional type-specific strategy abstraction for file formats.

```ts
export interface ParserStrategy {
  readonly sourceType: 'pdf' | 'image' | 'text' | 'docx';
  parse(input: DocumentParseInput): Promise<ParsedDocumentText>;
}
```

This allows a registry to choose among:
- `PdfTextParser`
- `ImageOcrParser`
- `TextFileParser`
- `DocxTextParser`

### Proposed source code structure

```text
src/
  domain/
    entities/
      DocumentSource.ts
      ParsedDocumentText.ts
    services/
      DocumentParser.ts
      ParserStrategy.ts
      TextNormalizer.ts
    repositories/
      DocumentStorageRepository.ts

  application/
    services/
      DefaultDocumentParser.ts
      ParserRegistry.ts
      DefaultTextNormalizer.ts
    use-cases/
      ParseDocumentUseCase.ts

  infrastructure/
    parsers/
      PdfTextParser.ts
      ImageOcrParser.ts
      TextFileParser.ts
      DocxTextParser.ts
    adapters/
      PdfExtractorAdapter.ts
      TesseractOcrAdapter.ts
      DocxReaderAdapter.ts
    normalization/
      whitespace.ts
      pageBoundaryCleaner.ts

  features/
    document-parser/
      domain/
      application/
      infrastructure/
```

### Module boundaries

- Domain: pure parser contracts and plain output types.
- Application: registry selection, orchestration, and normalization rules.
- Infrastructure: parser implementations and platform-specific adapters.
- Features: reserved for later extraction enhancements, advanced OCR tuning, or model-adapter integrations.

### Execution flow

```text
Document upload
  -> DocumentVersionCreated
  -> ParseDocumentUseCase.execute()
  -> ParserRegistry.selectParser()
  -> Pdf/Text/Image/Docx parser
  -> DefaultTextNormalizer.normalize()
  -> ParsedDocumentText
  -> DocumentChunkingService.chunkDocument()
```

### Notes on implementation scope

The initial parser slice should avoid:
- semantic extraction or classification
- AI-based OCR fallback decisions
- embedding generation
- chunking logic inside the parser layer

It should only do the following:
- extract text reliably from known source types
- preserve page boundaries and section cues
- normalize whitespace and remove obvious boilerplate noise
- return data in a stable format for the chunking pipeline

### Review focus

The critical architectural choice is that parsing is a separate, typed contract from chunking. This creates a reliable input boundary:
- parser output is normalized text plus provenance metadata
- chunking consumes only `ParsedDocumentText`
- future OCR, PDF, or document-format improvements can be added behind the same interface without changing the chunking model

This keeps the first extraction slice small, deterministic, and ready for later RAG upgrades.

---

## Decision Gate

This design should be approved before implementation begins. Once approved, work proceeds in small, test-first slices and does not expand into retrieval or embedding until the chunking contract is proven stable.

---

## Appendix: v1 Data Entity Model for the Local RAG Slice

This is the first approved, intentionally minimal entity set for the workflow from "document received" to "document is chunked". It is deliberately narrower than the full product model: no embeddings, no vectors, no retrieval indexes, and no semantic metadata. The goal is to capture the durable facts needed for a repeatable local RAG pipeline and later expansion.

### Design intent

The entity model should answer four questions reliably:
1. What document are we processing?
2. What version is active and what is historical?
3. Did validation and extraction succeed, and what normalized text was produced?
4. Which chunk records belong to the current version, and which were superseded?

Everything else is deferred.

### v1 entities

#### Project
Represents a higher-level owner or product workspace. This is not the RAG index itself; it gives us the top-level grouping for uploaded docs and version history.

```ts
interface Project {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt?: Date;
}
```

#### Document
The canonical uploaded document record. It represents one logical document regardless of version churn.

```ts
interface Document {
  id: string;
  projectId?: string;
  originalFileName?: string;
  sourceType: 'pdf' | 'image' | 'text' | 'docx';
  mimeType?: string;
  storageKey?: string;
  checksum?: string;
  status: 'received' | 'validating' | 'validated' | 'failed' | 'chunked';
  createdAt: Date;
  updatedAt?: Date;
}
```

#### DocumentVersion
The processing version for a single document. This is the key entity for deterministic reuse, retry, supersession, and historical continuity. Validation is persisted directly on this record because it is part of the same workflow checkpoint, not a separate entity.

```ts
interface DocumentVersion {
  id: string;
  documentId: string;
  projectId?: string;
  version: number;
  status: 'received' | 'validated' | 'extracted' | 'chunked' | 'persisted' | 'failed' | 'superseded';
  workflowState: 'idle' | 'document_received' | 'validation_pending' | 'text_extracted' | 'chunking_in_progress' | 'chunking_complete' | 'persisting_chunks' | 'completed' | 'failed' | 'superseded';
  sourceType?: 'pdf' | 'image' | 'text' | 'docx';
  supportedForAnalysis?: boolean;
  validationStatus?: 'pending' | 'passed' | 'failed';
  validationReason?: string;
  rejectionCode?: 'unsupported_file_type' | 'empty_document' | 'cannot_read_file' | 'document_too_large';
  validatedAt?: Date;
  lastEvent?: string;
  retryCount?: number;
  circuitOpen?: boolean;
  lastError?: string;
  createdAt: Date;
  updatedAt?: Date;
  completedAt?: Date;
}
```

#### ExtractedDocumentText
Normalized extracted text + page-level metadata. This is the contract that sits between parsing and chunking.

```ts
interface ExtractedDocumentText {
  id: string;
  documentId: string;
  documentVersion: number;
  projectId?: string;
  text: string;
  pageMetadata: Array<{
    pageNumber: number;
    text: string;
    startOffset: number;
    endOffset: number;
  }>;
  sectionHints?: Array<{
    heading: string;
    text: string;
  }>;
  language?: string;
  warnings?: string[];
  createdAt: Date;
  updatedAt?: Date;
}
```

#### ChunkingConfig
The deterministic algorithm settings. This stays pure, explicit, and easy to test.

```ts
interface ChunkingConfig {
  targetMinWords: number;
  targetMaxWords: number;
  hardMaxWords: number;
  mergeThresholdWords: number;
  preferBoundary: Array<'page' | 'section' | 'paragraph' | 'sentence' | 'word'>;
}
```

#### KnowledgeChunk
The canonical data record for one chunk. This is the core unit that later retrieval and evidence systems can build upon.

```ts
interface KnowledgeChunk {
  id: string;
  documentId: string;
  documentVersion: number;
  projectId?: string;
  content: string;
  chunkIndex: number;
  pageNumber?: number;
  section?: string;
  heading?: string;
  documentType?: string;
  revision?: string;
  startOffset?: number;
  endOffset?: number;
  wordCount?: number;
  charCount?: number;
  tokenCount?: number;
  isOutdated: boolean;
  isSuperseded: boolean;
  supersededByChunkId?: string;
  supersededAt?: Date;
  createdAt: Date;
  updatedAt?: Date;
}
```

#### DocumentChunkingRun
Optional orchestration lifecycle record for the chunking slice. It is useful for observability, retries, and resume debugging without carrying commercial retrieval logic.

```ts
interface DocumentChunkingRun {
  id: string;
  documentId: string;
  documentVersion: number;
  status: 'queued' | 'started' | 'completed' | 'failed' | 'superseded';
  startedAt?: Date;
  completedAt?: Date;
  failureReason?: string;
  chunkCount?: number;
  createdAt: Date;
}
```

### Entity selection rationale

This v1 set intentionally excludes:
- embeddings and vector representations
- retrieval rankings and candidate scores
- semantic metadata, topics, summaries, and labels
- user-specific chat memory or conversation state
- any long-lived AI inference caches

These are valuable later, but they do not belong in the minimal v1 slice.

---

## v1 Source Code Structure

This is the minimal structure needed to support the local RAG pipeline without introducing downstream retrieval concerns.

```text
src/
  domain/
    entities/
      Project.ts
      Document.ts
      DocumentVersion.ts
      ExtractedDocumentText.ts
      KnowledgeChunk.ts
      DocumentChunkingRun.ts
    services/
      DocumentChunkingService.ts
      ChunkingConfig.ts
      DocumentParser.ts
    repositories/
      KnowledgeChunkRepository.ts
      DocumentVersionRepository.ts
      ExtractedDocumentTextRepository.ts

  application/
    services/
      DefaultDocumentChunkingService.ts
      ParserRegistry.ts
    use-cases/
      ParseDocumentUseCase.ts
      ProcessDocumentChunkingUseCase.ts
    workflows/
      documentChunkingMachine.ts

  infrastructure/
    database/
      schema.ts
      migrations.ts
    repositories/
      DrizzleChunkRepository.ts
      DrizzleDocumentVersionRepository.ts
      DrizzleExtractedTextRepository.ts
    parsers/
      PdfTextParser.ts
      ImageOcrParser.ts
      TextFileParser.ts
      DocxTextParser.ts
```

### Boundary rules

- Domain: pure entities and contracts; no SQLite or external adapter code
- Application: orchestration, validation, normalization, deterministic chunking logic
- Infrastructure: persistence and parser adapters only
- No entity in this slice should know about embeddings, retrieval scoring, or vector database setup

---

## RAG Pipeline: "document received" to "document is chunked"

This is the v1 lifecycle we must support before any retrieval or indexing work is introduced.

```text
Document upload received
  -> Document created
  -> DocumentVersion created (version = N)
  -> workflowState = document_received
  -> validation_pending
  -> validation updates DocumentVersion with supportedForAnalysis + rejectionCode
  -> if failed: persist failure state and stop
  -> text_extracted
  -> parse/normalize source into ExtractedDocumentText
  -> chunking_in_progress
  -> DocumentChunkingService.chunkDocument(context)
  -> KnowledgeChunk[] created in stable order
  -> persist chunks with documentId + documentVersion metadata
  -> version-aware supersession check
  -> previous version chunks marked isOutdated / isSuperseded
  -> document version status = chunked / persisted
  -> workflowState = completed
``` 

### Step-by-step contract

#### 1) Document received
- create or upsert `Document`
- create new `DocumentVersion` for `documentId + version`
- set workflow state to `document_received`
- save minimal metadata: sourceType, file reference, request info, createdAt

#### 2) Validation
- update the current `DocumentVersion` checkpoint with `validationStatus`, `supportedForAnalysis`, and `rejectionCode`
- validate source type, readability, sanity checks, and size guardrails
- if validation fails, persist the failure state and stop before extraction

#### 3) Text extraction
- parse raw file into a deterministic `ExtractedDocumentText`
- keep `pageMetadata` and `sectionHints` to preserve boundaries
- persist extracted content and offsets using `documentId + documentVersion`
- transition state to `text_extracted`

#### 4) Chunk generation
- call `DocumentChunkingService.chunkDocument(context)`
- chunk content using paragraph/section/page/sentence/word boundary rules in order
- assign ordinal `chunkIndex`
- populate provenance fields (`pageNumber`, `section`, `heading`, offsets, counts)
- return ordered `KnowledgeChunk[]`

#### 5) Persistence and supersession
- save all new chunks in SQLite
- if a newer version exists, mark older chunks as stale
- populate `isOutdated`, `isSuperseded`, `supersededByChunkId`, and `supersededAt`
- leave old chunks in place for traceability and auditability
- mark `DocumentVersion.status = 'chunked'` or `persisted`

#### 6) Completed boundary
- the lifecycle ends once the latest version is chunked and persisted
- no embedding, ranking, or query logic is attempted in this slice

### Minimal state transitions

```ts
const stages = [
  'document_received',
  'validation_pending',
  'text_extracted',
  'chunking_in_progress',
  'chunking_complete',
  'persisting_chunks',
  'completed',
  'failed',
  'superseded',
] as const;
```

The critical design choice is that the pipeline is explicitly checkpointed between stages so resumes and retries are based on durable records rather than transient in-memory state.

---

## Review Summary

This v1 slice is intentionally lean but complete enough for the first stable implementation:
- one logical document
- multiple versioned processing records
- one extracted normalized text contract
- one deterministic chunk model
- one explicit pipeline lifecycle from receipt to chunk persistence

It is also intentionally narrow: the future retrieval and reasoning layers can build on this model without rewriting the underlying document/version/chunk semantics.

---

## Decision Gate for v1 Entities

The review question is whether this minimal entity set is sufficient to implement the first stable local RAG slice without introducing premature complexity. If approved, implementation should proceed in test-first increments around:
1. `Document` + `DocumentVersion`
2. `ExtractedDocumentText`
3. `KnowledgeChunk`
4. deterministic chunking service
5. SQLite repository persistence and supersession behavior

No embedding or retrieval logic should be added until this contract is proven stable.
