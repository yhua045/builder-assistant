## 7. Persistence-Oriented Orchestration Amendment

This section updates the architecture for the workflow persistence requirement. The main design change is that the orchestration boundary is the `DocumentParserService`, not only the thin use-case façade. This service must own the RAG pipeline lifecycle record and persist both the extraction result and the workflow status for the same document version.

### Revised Ownership

`DocumentParserService` becomes the authoritative workflow orchestrator for parsing and persistence. Its responsibilities are:

* validate the request payload
* resolve the correct parser from the registry
* call the parser and normalize the result
* persist the current workflow state into the `DocumentVersion` record
* upsert the parsed-content payload into the `extracted_document_text` table
* enforce idempotency on retries for the same `(documentId, documentVersion)`
* classify failures and record the latest error without creating duplicate extracted results

`ParseDocumentUseCase` may remain as an application-layer façade, but it should delegate to `DocumentParserService` for the actual workflow persistence and retry-safe execution pattern. This keeps the state lifecycle aligned with the repository and the RAG pipeline monitoring model.

### Persisted Workflow State

The canonical persisted workflow status remains the existing `DocumentVersion` entity in the shared domain model:

```ts
interface DocumentVersion {
  id: string;
  documentId: string;
  projectId?: string;
  version: number;
  status: 'received' | 'validated' | 'extracted' | 'chunked' | 'persisted' | 'failed' | 'superseded';
  workflowState: 'idle' | 'document_received' | 'validation_pending' | 'validation_passed' | 'validation_failed' | 'text_extracted' | 'chunking_in_progress' | 'chunking_complete' | 'persisting_chunks' | 'completed' | 'failed' | 'superseded';
  validationStatus?: 'pending' | 'passed' | 'failed';
  validationReason?: string;
  lastEvent?: string;
  retryCount?: number;
  lastError?: string;
  createdAt: Date;
  updatedAt?: Date;
  completedAt?: Date;
}
```

The `DocumentParserService` should update that record as the parse lifecycle evolves:

```text
received
    ↓
validation_pending / validation_passed
    ↓
text_extracted
    ↓
persisted / failed
```

For a successful extraction, the service records:

* `DocumentVersion.status = 'extracted'` or `'persisted'` depending on the exact completion point
* `DocumentVersion.workflowState = 'text_extracted'` when extraction succeeds
* `DocumentVersion.lastEvent = 'document_parsed'`
* `DocumentVersion.updatedAt = now`

For a failed extraction, the service records:

* `DocumentVersion.status = 'failed'`
* `DocumentVersion.workflowState = 'failed'`
* `DocumentVersion.validationStatus = 'failed'` when validation fails, or the corresponding failure classification for format/file issues
* `DocumentVersion.lastError = <message>`
* `DocumentVersion.retryCount = incremented retry count`

### Persisted Parse Result

The parsed document text payload must be stored in the existing extracted-document persistence table, which is represented in the model as `ExtractedDocumentText` and in the database as `extracted_document_text`.

```ts
interface ExtractedDocumentText {
  id: string;
  documentId: string;
  documentVersion: number;
  projectId?: string;
  text: string;
  pageMetadata: ParsedDocumentPage[];
  sectionHints?: Array<{ heading: string; text: string }>;
  elements?: ParsedDocumentElement[];
  language?: string;
  warnings?: string[];
  createdAt: Date;
  updatedAt?: Date;
}
```

The save semantics are:

* store the result keyed by `(documentId, documentVersion)`
* overwrite only the matching version row when a re-run occurs for the same version
* never create duplicate rows for a single document version
* maintain `updatedAt` changes while preserving the same stable logical record

This ensures downstream chunking and RAG ingestion can safely assume there is at most one extracted result for a document version.

### Idempotent Retry Design

Idempotency is required across retries and reprocessing attempts for the same document version. The safe idempotency key is:

```text
(documentId, documentVersion)
```

Recommended behavior:

1. Before parsing a document version, query for an existing extracted text row by `documentId + documentVersion`.
2. If an extracted row already exists and is valid, return it immediately without re-running the parser.
3. If the row does not exist, proceed with parse execution and persist the result.
4. If the parse fails, update the DocumentVersion failure state and keep the retry metadata, but do not create a partial extracted-text row.
5. If a retry later succeeds, update the same `DocumentVersion` row and replace the extracted-text payload for that document version atomically.
6. On repeat success calls after a successful parse, the service must return the stored normalized result without re-extracting or mutating the content.

This gives the system a deterministic replay-safe behavior during job retries, duplicate webhook deliveries, or process restarts.

### State & Repository Interaction

```text
DocumentParserService.execute(input)
    ↓
Load DocumentVersion by (documentId, version)
    ↓
If prior extracted result exists -> return stored result (idempotent replay)
    ↓
Update DocumentVersion status to validation_pending / validation_passed
    ↓
Select parser and parse document
    ↓
Persist extracted result in extracted_document_text
    ↓
Update DocumentVersion status to text_extracted / persisted / failed
    ↓
Return parsed result to caller
```

Important transitions:

* `received -> validated -> text_extracted -> persisted`
* `received -> validation_failed -> failed`
* retry: `failed -> validation_pending -> text_extracted` without creating duplicate extracted rows

### Architectural Constraints for This Amendment

* The parser remains stateless and side-effect free; the service owns persistence and workflow state.
* `DocumentVersion` is the canonical record for workflow status, not a transient in-memory flag.
* `ExtractedDocumentText` is the canonical persisted result for a document version. It is keyed by `(documentId, documentVersion)`.
* `DocumentParserService` must be safe to call repeatedly with the same version; repeated successful calls must not duplicate parse artifacts or duplicate workflow history.
* The service should record `retryCount`, `lastError`, and `updatedAt` on every failure and recovery attempt.
* The feature must not broaden the parser contract beyond extraction and normalization; persistence and idempotency are orchestration concerns, not parser concerns.

This amendment keeps the pipeline traceable, supports retry-safe reprocessing, and ensures the RAG workflow status is persisted in the existing version history without introducing a separate workflow table for the parse step.
