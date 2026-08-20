# #235 — Document Chunking Design Plan

Issue: #235  
Status: Draft pending approval  
Date: 2026-08-14

## Goal

Build the first stable slice of the local RAG pipeline: deterministic chunk generation from extracted document text, explicit document-version handling, and SQLite-safe persistence without introducing embeddings, ranking, or model-dependent logic.

This design is intentionally narrow. It creates a reliable contract for later extraction, embedding, and retrieval work while preserving historical chunk records and making stale data explicit.

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
