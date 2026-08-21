# Feature: Document Chunking Pipeline

## Goal

Provide a flexible and recoverable document chunking stage for the RAG processing pipeline. The stage transforms parsed document content into semantic KnowledgeChunk results while preserving document hierarchy and relevant context for downstream embedding and vector storage.

The stage must support multiple internal chunking strategies, enforce configured size constraints, recover from interruption or partial failure, and maintain enough progress state to resume processing without reprocessing completed work or producing duplicate results.

## System Flow

1. A document chunking job is started for a specific document version.
2. The system receives the parsed document content, document structure, metadata, prior processing results, and chunking constraints.
3. The ChunkService determines which chunking strategy or strategies are applicable.
4. The selected strategy groups document elements into semantic chunks and preserves hierarchy, context, tables, and other supported special elements.
5. The system applies the configured chunk size and token limits.
6. If the preferred strategy cannot process the input, the system applies an available fallback strategy and records that fallback occurred.
7. The system produces KnowledgeChunk results and records processing progress and checkpoint state.
8. On interruption or failure, a later attempt resumes from the last safe checkpoint and retries only incomplete processing units.
9. Completed chunks are made available to the downstream embedding stage.

## Acceptance Criteria

### AC1

**Given** a valid parsed document version with document structure, metadata, and chunking constraints,
**when** the chunking stage is started,
**then** the system processes the document as one recoverable ChunkService stage and produces KnowledgeChunk results.

### AC2

**Given** a document whose type, structure, metadata, and previous processing results identify one or more applicable chunking strategies,
**when** the chunking stage selects a strategy,
**then** the system executes an applicable strategy without exposing its internal algorithms as separate top-level workflow stages.

### AC3

**Given** a document containing hierarchical content, tables, or other supported special elements,
**when** the document is chunked,
**then** the resulting KnowledgeChunk data preserves the relevant hierarchy, context, and special-element information needed by downstream processing.

### AC4

**Given** configured chunk size and token constraints,
**when** content is grouped into chunks,
**then** every produced chunk complies with the applicable hard limits, and the system applies the configured target size and preferred boundaries where possible.

### AC5

**Given** the preferred chunking strategy is unavailable, unsuitable for the input, or unable to process a processing unit,
**when** chunking continues,
**then** the system uses an applicable fallback strategy and records that the fallback was used, including enough information to identify the affected document or processing unit and the reason for fallback.

### AC6

**Given** a processing unit completes successfully,
**when** the unit's results are accepted,
**then** the system persists the produced KnowledgeChunk results and a checkpoint identifying the completed unit before reporting that unit as complete.

### AC7

**Given** a chunking job is interrupted or fails after one or more processing units have been checkpointed,
**when** the same document version is submitted again,
**then** the system resumes from the last safe checkpoint and does not reprocess completed units.

### AC8

**Given** a chunking job is retried for the same document version and processing scope,
**when** previously completed units are encountered,
**then** the system behaves idempotently by retaining one logical result for each completed unit and does not create duplicate KnowledgeChunk results.

### AC9

**Given** one processing unit fails while other units can still be processed,
**when** the ChunkService handles the failure,
**then** the system records the failed unit, preserves successfully completed units, and allows the failed unit to be retried independently.

### AC10

**Given** a chunking stage completes all processing units successfully,
**when** the stage reports completion,
**then** the system records the stage as complete and exposes all resulting KnowledgeChunk data to the downstream embedding stage.

### AC11

**Given** invalid, incomplete, or empty document input,
**when** the chunking stage is started,
**then** the system does not produce invalid chunks, records the validation or empty-input outcome, and reports a clear unsuccessful or no-content result according to the input condition.

### AC12

**Given** an external dependency or internal strategy required by the preferred path is unavailable,
**when** an applicable fallback exists,
**then** the system continues using the fallback, records the dependency failure and fallback event, and preserves the checkpoint state for the affected processing unit.

## Error & Failure Handling

* A failed processing unit is recorded with its document version, processing scope, failure reason, and current checkpoint state.
* Successfully completed processing units and their results remain persisted when another unit fails.
* Retrying a failed job resumes from the last safe checkpoint and retries incomplete or failed units only.
* If the preferred strategy cannot be used and a fallback is available, processing continues and the fallback event is recorded.
* If no applicable strategy or fallback can process a unit, the unit remains failed, the stage does not claim full completion, and the failure is surfaced for later retry or operator handling.
* A dependency outage must not discard already persisted results or checkpoints.
* Repeated retries for the same document version and processing scope must not create duplicate logical chunks.

## Edge Cases

* Empty document content produces no invalid KnowledgeChunk results.
* Invalid or incomplete parsed input is rejected or recorded without corrupting existing checkpointed results.
* A document containing content larger than the configured target size is split while respecting the hard size limit.
* A single element larger than the hard limit uses the defined fallback or constraint-handling behavior and records the outcome.
* Tables and special elements retain their associated context when split or processed separately.
* Duplicate submissions for the same document version and processing scope are idempotent.
* Interruption immediately before or after checkpoint persistence does not result in duplicate completed chunks on resume.
* A preferred-strategy failure followed by fallback processing is distinguishable from normal processing in recorded state.
* A document version change is treated as a separate processing scope from an earlier version.

## Observability

* Log job start, document identifier, document version, processing scope, and selected strategy.
* Log each checkpoint creation and resume operation, including the last safe completed unit.
* Log strategy failures, dependency failures, fallback selection, and the reason for each fallback.
* Log failed processing units and retry attempts with correlation information.
* Record stage status, unit status, chunk counts, fallback counts, failure counts, and retry counts as metrics where monitoring is available.
* Log completion only after KnowledgeChunk results and the final checkpoint have been persisted.

## Out of Scope

* Parsing source documents into structured document elements.
* Generating embeddings from KnowledgeChunk results.
* Persisting or querying vectors in SQLite-Vec.
* Defining UI screens or user-facing controls for monitoring chunking jobs.
* Defining retention, deletion, or reprocessing policies beyond the document-version and checkpoint behavior described here.

## Rules

1. Acceptance criteria must describe **observable system behaviour**, not implementation details.
2. Do not prescribe classes, functions, frameworks, libraries, database schemas, or specific implementation techniques unless I explicitly provide them as requirements.
3. Each acceptance criterion should describe one clear and independently testable behaviour.
4. Acceptance criteria must be specific enough that they can later be converted into automated tests.
5. Consider both normal processing and failure scenarios.
6. Consider duplicate messages, retries, timeouts, invalid input, and dependency failures where relevant.
7. Do not assume that an operation is idempotent unless this has been explicitly stated or confirmed.
8. Do not invent business rules, integration behaviour, or technical requirements that I have not provided or confirmed.
9. If a requirement is ambiguous, ask me before producing the final document.
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
