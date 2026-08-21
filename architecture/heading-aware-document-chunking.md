# Feature: Heading-Aware Document Chunking Strategy

## 1. Architectural Context

### Relevant Existing Components

| Component | Responsibility | Relevance to Feature |
| --- | --- | --- |
| `src/features/knowledge-embedding/domain/services/DocumentChunkingStrategy.ts` | Defines `ChunkingConfig`, `ChunkingContext`, section hints, and the chunking strategy contract. | Extend the context with ordered parsed structural elements and keep structure-aware chunking behind the existing strategy boundary. |
| `src/shared/domain/services/DocumentParser.ts` | Defines parser input and normalized parsed-document output. | Extend the parser output with a typed ordered structural representation; parser adapters remain responsible for extraction, not chunking. |
| `src/features/knowledge-embedding/application/services/DefaultDocumentChunkingService.ts` | Splits normalized text with LangChain and creates ordered `KnowledgeChunk` results. | Remains the plain-text strategy and fallback when heading context is unavailable. |
| `src/features/knowledge-embedding/application/ChunkDocumentUseCase.ts` | Owns strategy execution, page-unit processing, progress checkpoints, fallback handling, and chunk persistence. | Selects the heading-aware strategy when section hints are usable and keeps it inside one coarse chunking stage. |
| `src/features/knowledge-embedding/domain/entities/ExtractedDocumentText.ts` | Stores normalized parsed text, page metadata, and optional section hints. | Supplies the ordered headings, paragraphs, lists, tables, and figures consumed by the structure-aware strategy. |
| `src/features/knowledge-embedding/domain/entities/KnowledgeChunk.ts` | Defines the persisted chunk output and metadata. | Stores enriched content such as `Engineering Plan, ...45x45 mm steel post...` and the associated heading metadata. |
| `src/features/knowledge-embedding/infrastructure/repositories/DrizzleChunkRepository.ts` | Persists chunks idempotently and handles supersession. | Requires no schema change; it persists the enriched `content` and metadata already supported. |
| `src/features/knowledge-embedding/domain/repositories/ChunkDocumentProgressRepository.ts` | Tracks selected strategy, completed units, fallback events, and failures. | Records heading-aware strategy selection and any fallback to plain-text chunking. |
| `src/features/knowledge-embedding/tests/unit/ChunkDocumentUseCase.test.ts` | Covers validation, persistence, retries, and supersession. | Adds strategy-selection and fallback coverage at the orchestration boundary. |
| `__tests__/unit/domain/ragDomain.test.ts` | Covers chunking service output and domain contracts. | Adds focused tests for heading prefixing, metadata, limits, and no-heading compatibility. |

### Architectural Constraints

* Keep heading-aware chunking inside `ChunkDocumentUseCase` as an internal strategy, not as a new outer workflow state.
* Preserve the Clean Architecture dependency direction: application code depends on domain contracts, and Drizzle remains an infrastructure adapter.
* Reuse `ChunkingContext.sectionHints` and `KnowledgeChunk.metadata`; do not introduce a second section or heading persistence model.
* Preserve deterministic chunk IDs based on document, version, and chunk index so retries remain idempotent.
* Treat parser-provided structural elements as source data. Do not make the chunker infer headings, tables, figures, or lists from flattened text.
* Apply configured hard limits to the final enriched chunk content, including the heading prefix.
* Preserve the existing default strategy behavior when structural elements are absent, invalid, or unsupported by a parser.

## 2. Proposed Architecture

### Data Flow

```text
Parsed ExtractedDocumentText with ordered structural elements
    ↓
ChunkDocumentUseCase selects strategy
    ↓
StructuredDocumentChunkingStrategy when usable structure exists
    ↓
Combine related elements, preserve type-specific structure, and prefix section context
    ↓
KnowledgeChunk content + heading metadata
    ↓
Persist chunk and checkpoint processing unit
```

`ChunkDocumentUseCase` remains the single public chunking stage. Its strategy selector evaluates the extracted document's ordered structural elements. When usable headings, paragraphs, lists, tables, or figures are available, it selects `StructuredDocumentChunkingStrategy`. When only heading/section hints are available, the strategy can still enrich plain section text. Otherwise, it selects `DefaultDocumentChunkingService`.

The document parser is the owner of structural extraction. It should return a normalized, ordered intermediate representation rather than asking the chunker to reconstruct structure from `rawText`:

```ts
type ParsedDocumentElement =
    | { type: 'heading'; text: string; level?: number; pageNumber?: number }
    | { type: 'paragraph'; text: string; pageNumber?: number }
    | {
            type: 'list';
            items: Array<{ text: string; level?: number; ordered?: boolean }>;
            pageNumber?: number;
        }
    | {
            type: 'table';
            caption?: string;
            headers?: string[];
            rows: string[][];
            pageNumber?: number;
        }
    | {
            type: 'figure';
            caption?: string;
            altText?: string;
            extractedText?: string;
            pageNumber?: number;
        };
```

The representation must preserve document order, page association, and the relationship between a heading and the elements that follow it. Parser adapters may populate only the element types they can support; unsupported structure remains absent and triggers the normal fallback path.

The structure-aware strategy maintains the current heading/section context while walking elements in order. It combines adjacent compatible elements into chunks and enriches each chunk with the active heading. For the example heading `Engineering Plan` and paragraph `...45x45 mm steel post..`, the persisted chunk content is `Engineering Plan, ...45x45 mm steel post..`.

Type-specific rendering is deterministic:

* Paragraphs retain their normalized prose.
* Lists retain item order and nesting, including numbering when available.
* Tables retain captions, column headers, and row values. When a table is split, headers are repeated in every table chunk.
* Figures retain captions, alt text, extracted/OCR text, and page metadata.
* Headings update the active context and are not emitted as heading-only chunks unless the source contains no associated body content.

The strategy may combine a heading, paragraph, list, table, or figure when they are adjacent and belong to the same section. It must not combine unrelated sections merely to fill a target size. Tables and figures should remain atomic until they exceed the hard limit; only then may they be split using type-aware rules.

The prefix is applied before word/token counts and hard-limit validation. If adding the heading would exceed the configured hard limit, the strategy must split or reduce the body segment according to the existing deterministic constraint-handling behavior. It must never silently persist an enriched chunk over the configured limit. A heading is added once per emitted chunk; it is not repeatedly prefixed if the source segment already begins with the same normalized heading.

Each enriched chunk carries the heading in `KnowledgeChunk.metadata`, for example `{ heading: 'Engineering Plan', sectionTitle: 'Engineering Plan' }`, while `content` remains the retrieval and embedding text containing the heading. Existing page, boundary, offsets, and document/version metadata are preserved where they remain meaningful. Offsets refer to the source body text, not the synthetic prefix, and should not claim source offsets for characters introduced by enrichment.

### Strategy Contract

Add a feature-local `StructuredDocumentChunkingStrategy` implementing `DocumentChunkingStrategy`. It should reuse the default strategy's normalization, splitter configuration, chunk construction conventions, and deterministic ordering through a shared helper or narrow composition point rather than duplicating unrelated logic. Heading-only enrichment is one behavior of this strategy, not a separate top-level workflow stage.

The strategy selector should return an applicable strategy plus a stable strategy identifier such as `heading-aware` or `default-text`. The selector must not expose individual strategies as workflow states. Strategy selection and fallback outcomes remain internal progress diagnostics.

The initial applicability rule is conservative:

* At least one supported structural element must contain non-empty meaningful data.
* A heading must be non-empty after normalization before it becomes active context.
* A table must contain at least one meaningful header or row.
* A figure must contain a caption, alt text, or extracted text.
* Invalid or unassociated elements are ignored and recorded as a diagnostic only if they prevent the preferred strategy from being used.

The strategy must not infer headings, tables, figures, lists, or relationships from typography, capitalization, OCR layout, or short lines. Parser and OCR structural extraction are contract work for the upstream parser phase; parser algorithm expansion remains outside this chunking implementation.

### State Flow

```text
Chunking in progress
    ↓
Inspect section hints
    ├─ usable structural elements → structured strategy
    └─ no usable heading context → default text strategy

Structured strategy
    ↓
Walk ordered elements and maintain section context
    ↓
Render compatible paragraphs, lists, tables, and figures
    ↓
Prefix active heading and validate final limits
    ↓
Persist enriched chunks
    ↓
Checkpoint unit

Structured strategy failure
    ↓
Record strategy failure
    ↓
Run default deterministic fallback
    ↓
Persist fallback chunks and checkpoint unit
```

The outer workflow remains unchanged: `chunking_in_progress`, `chunking_complete`, `failed`, and existing retry states continue to represent the stage. Strategy selection, heading applicability, prefixing, and fallback details remain in the internal chunk progress record.

## 5. Data / Persistence Changes

The extraction artifact must persist the structural representation so a chunking retry does not need to reparse the original document. Add an `elements` JSON column to the existing `extracted_document_text` table and a corresponding `elements?: ParsedDocumentElement[]` field to `ExtractedDocumentText`. The migration must be backward compatible: existing rows remain valid with `elements` absent or empty.

`KnowledgeChunk.content` already stores the text consumed by downstream embedding, and `KnowledgeChunk.metadata` already supports structured values. The strategy should populate:

* `content`: the heading prefix followed by the body segment.
* `metadata.heading`: the normalized heading used for enrichment.
* `metadata.sectionTitle`: the section title, when distinct from the heading.
* `metadata.elementTypes`: the source element types represented in the chunk.
* `metadata.table` / `metadata.figure` details when the chunk contains a table or figure, without storing binary assets in the chunk record.
* Existing page and boundary metadata without overwriting unrelated values.

The existing deterministic chunk ID format, chunk repository, and progress table remain unchanged. The extracted-text table requires only the additive `elements` column. The selected strategy and fallback events should continue to be recorded through `ChunkDocumentProgressRepository`.

If tests require a stable diagnostic distinction, add only a strategy identifier or fallback reason to the existing progress payload. Do not add a new workflow table or outer workflow state for heading-aware chunking.

## 6. Error Handling & Resilience

* Empty headings, paragraphs, list items, tables, and figures do not produce invalid chunks.
* Missing structural elements preserves existing default chunking behavior.
* A structural element that cannot be associated with the current unit is ignored or causes a recorded strategy fallback; it must not produce a heading-only or metadata-only chunk.
* If the structured strategy fails, record the document/version/unit, strategy identifier, and reason, then use the existing deterministic default strategy when applicable.
* The final enriched content must satisfy the configured hard word/token limits. A heading prefix counts toward those limits.
* If a heading plus body element exceeds the limit, preserve the heading and apply type-aware splitting. Repeat table headers in table splits, preserve list order in list splits, and record a warning or fallback reason when a figure cannot be safely split.
* Prefixing must be deterministic so retries generate the same logical content and stable chunk IDs.
* Persist enriched chunks before advancing the unit checkpoint, exactly as with the existing strategy.
* A retry must not duplicate chunks or re-prefix an already persisted chunk. Existing deterministic IDs and completed-unit detection remain authoritative.
* Existing chunks and checkpoints must remain intact if heading enrichment or persistence fails.

## 11. Implementation Sequence

1. Extend the parser and extraction contracts with `ParsedDocumentElement` and `ExtractedDocumentText.elements`.
2. Add the additive extraction-table migration and update the Drizzle extraction adapter to serialize and deserialize elements.
3. Add unit-level acceptance tests for heading prefixing, paragraph/heading association, lists, tables, figures, missing structure, and final hard-limit compliance.
4. Define the strategy selection result or applicability contract in `DocumentChunkingStrategy.ts`, including a stable strategy identifier.
5. Extract or expose the smallest reusable splitter/chunk-construction helper from `DefaultDocumentChunkingService` so the structured strategy does not duplicate normalization and limit logic.
6. Implement `StructuredDocumentChunkingStrategy` under `src/features/knowledge-embedding/application/services/`.
7. Add conservative structural-element applicability matching for the current processing unit and preserve default strategy behavior when no usable structure exists.
8. Update `ChunkDocumentUseCase` to select the structured strategy, pass the relevant context, record the selected strategy, and retain the existing default fallback path.
9. Ensure enriched heading, table, figure, list, page, and boundary metadata is merged without overwriting unrelated metadata.
10. Add orchestration tests proving strategy selection, fallback recording, retry idempotency, and persistence ordering.
11. Add extraction persistence tests proving structural elements survive database reopen and are available to chunking retries.
12. Run the existing RAG domain, extraction pipeline, chunk use-case, and integration persistence tests.
13. Run typecheck and review final content, counts, offsets, table-header repetition, list ordering, and figure context against representative fixtures.

## 15. Implementation Guardrails

* Keep all new strategy code under `src/features/knowledge-embedding`.
* Reuse `DocumentChunkingStrategy`, `ChunkingContext`, `DefaultDocumentChunkingService`, `KnowledgeChunk`, and `ChunkDocumentUseCase` before creating new abstractions.
* Do not add a new workflow engine, workflow state, vector field, or parser implementation.
* Keep parser structural extraction and chunking composition as separate responsibilities. The parser emits elements; the strategy combines them.
* Do not infer headings, tables, figures, or lists from raw text or OCR layout in the chunking strategy; use only parser-provided structural elements.
* Prefix the heading into `KnowledgeChunk.content` because downstream embedding consumes content, and also preserve the heading in metadata.
* Preserve table headers, list ordering/nesting, figure captions/text, and section context in rendered chunk content.
* Count the synthetic heading prefix against the configured hard limits.
* Do not alter source offsets to include synthetic prefix characters.
* Do not duplicate a heading when the body already contains the same heading prefix.
* Preserve existing default chunking output when no applicable structural context exists.
* Record strategy selection and fallback through the existing internal progress repository; do not expose strategy algorithms as outer pipeline stages.
* Persist chunks before marking their processing unit complete.
* Preserve stable document/version/chunk IDs and retry idempotency.
* Limit implementation changes to the knowledge-embedding feature, focused tests, the parser/extraction contracts, and the additive extraction migration.
* Do not implement parser-specific table/figure/list extraction algorithms, OCR heuristics, embeddings, retrieval ranking, UI, or monitoring screens in the chunking phase.
