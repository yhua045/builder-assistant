# #235 v2 — Document Received + Validate Document Design Plan

Issue: #235  
Status: Draft pending approval  
Date: 2026-08-18

## Goal

Define the first stable implementation slice for the local RAG pipeline in the existing feature area under `src/features/knowledge-embedding`.

This plan covers the first two workflow stages only:
1. document received
2. validate document

It deliberately excludes chunking, embeddings, retrieval, and ranking. The implementation should create a durable, testable contract for later pipeline stages while keeping the workflow deterministic and auditable.

---

## 1) Domain Model & Entities

The current knowledge-embedding feature already has a session-oriented flow, but it is not yet tied to actual document ingestion or persistence. The first implementation should treat the session as a high-level orchestration container, while the real pipeline work is tracked at the document and document-version level.

### Core concepts

- `KnowledgeEmbeddingSession`  
  High-level feature session created to manage a user/project intake flow.

- `Project`  
  Shared canonical domain entity representing the owning project or workspace for uploaded content.

- `Document`  
  Shared canonical logical file entity uploaded by the user.

- `DocumentVersion`  
  Shared canonical processing snapshot for a specific document revision. This is the key object for version-aware pipeline state and retries.

- `DocumentProcessingContext`  
  The immutable workflow context passed through the intake and validation pipeline.

### Shared vs feature-specific split

For v1, the domain objects that represent durable business identity and processing lineage should live under `src/shared/domain/entities` because they are reusable and not unique to the knowledge-embedding feature. The RAG-specific pipeline objects remain in the feature slice.

- Shared / reusable entities:
  - `Project`
  - `Document`
  - `DocumentVersion`

- Feature-specific entities / config:
  - `ExtractedDocumentText`
  - `KnowledgeChunk`
  - `ChunkingConfig`
  - `DocumentChunkingRun`
  - `KnowledgeEmbeddingSession`

### Proposed entity definitions

```ts
export type DocumentSourceType = 'pdf' | 'image' | 'text' | 'docx';
export type DocumentValidationStatus = 'pending' | 'passed' | 'failed';
export type DocumentWorkflowState =
  | 'document_received'
  | 'validation_pending'
  | 'validation_passed'
  | 'validation_failed'
  | 'text_extracted'
  | 'chunking_in_progress'
  | 'completed'
  | 'failed'
  | 'superseded';

export interface Project {
  id: string;
  name: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Document {
  id: string;
  projectId?: string;
  sessionId?: string;
  originalFileName?: string;
  sourceType: DocumentSourceType;
  mimeType?: string;
  storageKey?: string;
  checksum?: string;
  status: 'received' | 'validating' | 'validated' | 'failed' | 'chunked';
  createdAt: string;
  updatedAt?: string;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  projectId?: string;
  sessionId?: string;
  version: number;
  status: 'received' | 'validated' | 'extracted' | 'chunked' | 'persisted' | 'failed' | 'superseded';
  workflowState: DocumentWorkflowState;
  sourceType?: DocumentSourceType;
  supportedForAnalysis?: boolean;
  validationStatus?: DocumentValidationStatus;
  validationReason?: string;
  rejectionCode?:
    | 'unsupported_file_type'
    | 'empty_document'
    | 'cannot_read_file'
    | 'document_too_large';
  validatedAt?: string;
  retryCount?: number;
  createdAt: string;
  updatedAt?: string;
  completedAt?: string;
}

```

### Lifecycle model

The lifecycle should be explicit and checkpointed at each stage so the app can resume safely without transient in-memory state.

```ts
const documentPipelineStates = [
  'document_received',
  'validation_pending',
  'validation_passed',
  'validation_failed',
  'text_extracted',
  'chunking_in_progress',
  'completed',
  'failed',
  'superseded',
] as const;
```

### Relationship model

- `KnowledgeEmbeddingSession` owns the user flow and project context.
- `Project` groups related documents.
- `Document` is the logical file identity.
- `DocumentVersion` is the processing lineage for each revision of a document.
- Validation data remains on the current `DocumentVersion`, which keeps the model simpler and ensures the version record is the single source of truth for that processing step.
- Future stages (text extraction, chunking, indexing) will attach to the same version lineage and never rewrite the canonical document identity.

---

## 2) Key Abstractions & Interfaces

The design should avoid leaking storage or file-system concerns into the UI and use-case layer. The core contracts are intentionally narrow and focus on intake + validation.

### A. Intake contract

```ts
export interface ReceiveDocumentInput {
  sessionId: string;
  projectId?: string;
  originalFileName: string;
  sourceType: DocumentSourceType;
  mimeType?: string;
  storageKey: string;
  checksum?: string;
  uploadedAt?: string;
}

export interface ReceiveDocumentOutput {
  documentId: string;
  documentVersionId: string;
  version: number;
  workflowState: DocumentWorkflowState;
  status: 'received';
}
```

This use case creates the document and initial version record, then emits the workflow to the next step.

### B. Validation contract

```ts
export interface ValidateDocumentInput {
  documentId: string;
  documentVersionId: string;
  sessionId?: string;
  storageKey: string;
  sourceType: DocumentSourceType;
  mimeType?: string;
  fileSizeBytes?: number;
}

export interface ValidateDocumentOutput {
  documentId: string;
  documentVersionId: string;
  version: number;
  isSupported: boolean;
  status: 'passed' | 'failed';
  validationStatus: 'passed' | 'failed';
  rejectionCode?: string;
  reason?: string;
  warnings: string[];
  updatedVersion: DocumentVersion;
}
```

### C. Workflow context contract

This is the most important addition to make the pipeline explicit and testable. Every stage should read from the same immutable context object rather than scattering data through separate ad hoc parameters.

```ts
export interface DocumentProcessingContext {
  correlationId: string;
  sessionId: string;
  projectId?: string;
  documentId: string;
  documentVersionId: string;
  version: number;
  sourceType: DocumentSourceType;
  originalFileName?: string;
  storageKey?: string;
  mimeType?: string;
  checksum?: string;
  workflowState: DocumentWorkflowState;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}
```

This context should be created once when the document is received and then hydrated or updated as validation succeeds or fails. It enables:
- easy unit testing,
- logging and traceability,
- retries and resume flows,
- future extension to extraction and chunking without reworking the feature boundary.

### D. Repository contracts

```ts
export interface DocumentRepository {
  create(document: Document): Promise<Document>;
  getById(documentId: string): Promise<Document | null>;
  update(documentId: string, patch: Partial<Document>): Promise<Document>;
}

export interface DocumentVersionRepository {
  create(version: DocumentVersion): Promise<DocumentVersion>;
  getLatestByDocumentId(documentId: string): Promise<DocumentVersion | null>;
  getById(versionId: string): Promise<DocumentVersion | null>;
  update(versionId: string, patch: Partial<DocumentVersion>): Promise<DocumentVersion>;
}
```

### E. Validation service interfaces

```ts
export interface DocumentValidationService {
  validate(context: DocumentProcessingContext): Promise<DocumentValidationResult>;
}
```

This keeps validation logic out of the use case and allows implementation swapping for different source types or future provider-based validators.

### F. File-access and storage abstraction

```ts
export interface DocumentStorageAdapter {
  getFileInfo(storageKey: string): Promise<{ sizeBytes?: number; mimeType?: string; exists: boolean }>;
  readMetadata(storageKey: string): Promise<{ mimeType?: string; sizeBytes?: number }>;
}
```

This is intentionally small but enough to support native file validation without hard-wiring SQLite or platform-specific APIs into application logic.

---

## 3) Source Code Structure

The project already follows a vertical-slice feature structure. The first slice should continue that pattern inside the `knowledge-embedding` feature, while moving shared canonical business entities into the shared domain layer to avoid cross-feature duplication.

```text
src/
  app/
    di/
      knowledgeEmbeddingProvider.ts

  shared/
    domain/
      entities/
        Project.ts
        Document.ts
        DocumentVersion.ts
      repositories/
        DocumentRepository.ts
        DocumentVersionRepository.ts
      utils/
        id.ts
        timestamps.ts

  features/
    knowledge-embedding/
      domain/
        entities/
          KnowledgeEmbeddingSession.ts
        value-objects/
          DocumentSourceType.ts
          DocumentWorkflowState.ts
          DocumentValidationStatus.ts
        services/
          DocumentValidationService.ts
        context/
          DocumentProcessingContext.ts

      application/
        dto/
          ReceiveDocumentInput.ts
          ValidateDocumentInput.ts
          DocumentProcessingContextDto.ts
        use-cases/
          ReceiveDocumentUseCase.ts
          ValidateDocumentUseCase.ts
        workflows/
          DocumentIntakeWorkflow.ts

      infrastructure/
        storage/
          DocumentStorageAdapter.ts
        validation/
          FileTypeValidator.ts
          SizeAndSanityValidator.ts
        persistence/
          DrizzleDocumentRepository.ts
          DrizzleDocumentVersionRepository.ts

      hooks/
        useDocumentIntake.ts
        useDocumentValidation.ts

      screens/
        DocumentUploadScreen.tsx
        DocumentValidationScreen.tsx

      ui/
        components/
          DocumentUploadCard.tsx
          ValidationResultBanner.tsx
```

### Module boundaries

- `shared/domain`: reusable canonical business entities and shared repository contracts that are not specific to one feature
- `feature/domain`: feature-specific session, workflow state, and pipeline rules
- `application`: use cases, payload DTOs, workflow orchestration, validation orchestration
- `infrastructure`: file checks, storage adapters, repository implementations, DB access
- `hooks` + `ui`: presentation and state binding only

This preserves the clean architecture direction already visible in the repo while keeping the feature self-contained for the first local RAG slice.

---

## 4) Proposed workflow behavior

### Step 1: document received

The app should accept an uploaded file and immediately create a durable, versioned intake record.

Flow:
1. User selects or uploads a document.
2. `ReceiveDocumentUseCase.execute(input)` creates a `Document` row.
3. A new `DocumentVersion` is created with:
   - `version = N`
   - `status = 'received'`
   - `workflowState = 'document_received'`
4. A `DocumentProcessingContext` is created with the document + version metadata.
5. The result returns the new `documentId`, `documentVersionId`, and workflow state.

This step should be idempotent: if the same file is re-uploaded with the same checksum, the system should either reuse the existing document or create a new version only if the business rules explicitly call for version churn.

### Step 2: validate document

The validation step should inspect the file in a deterministic, provider-independent way. It should answer a very small question:

> Is this document supported for downstream processing in the local RAG pipeline?

Validation checks should be explicit and easy to test:
- file type is supported (`pdf`, `image`, `text`, `docx`)
- file is non-empty
- file can be read from storage
- file is not beyond the configured size guardrail
- document metadata is sane (e.g., extension matches MIME type where applicable)

If validation fails, record:
- `validationStatus = 'failed'`
- `supportedForAnalysis = false`
- `rejectionCode`
- `validationReason`
- `workflowState = 'validation_failed'`

If validation passes:
- `validationStatus = 'passed'`
- `supportedForAnalysis = true`
- `workflowState = 'validation_passed'`
- the next stage can be scheduled for extraction

### Validation implementation split

Keep validation logic modular by source type:
- `FileTypeValidator`
- `SizeAndSanityValidator`
- optional future parser-specific validators later

This keeps the first pass simple and avoids mixing source-type validation and text extraction logic in the same class.

---

## 5) Workflow context / DTO specification

This slice needs a single explicit workflow contract because all later stages will depend on it.

### Proposed `DocumentProcessingContext` DTO

```ts
export interface DocumentProcessingContext {
  correlationId: string;
  sessionId: string;
  projectId?: string;
  documentId: string;
  documentVersionId: string;
  version: number;
  sourceType: DocumentSourceType;
  originalFileName?: string;
  storageKey?: string;
  mimeType?: string;
  checksum?: string;
  workflowState: DocumentWorkflowState;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, unknown>;
}
```

### Why this DTO matters

This pattern matters more than the individual use-case signatures because it makes the pipeline resumable and observable. The context is:
- created once when document intake begins,
- enriched as validation runs,
- passed to later extraction and chunking stages,
- stored in logs or audit records when a stage updates.

Without this explicit context, future steps will silently drift into ad hoc parameter passing and inconsistent state.

---

## 6) Architectural Trade-offs & Risks

### Benefits of this design

- Clear separation between session state and document pipeline state
- Easy to test with unit tests for receive + validation outcomes
- Versioned workflow is resilient to retries and stale data
- Future extraction and chunking stages will fit naturally on the same `DocumentVersion` contract

### Risks and edge cases

1. Duplicate uploads  
   Same file uploaded repeatedly may create multiple versions or duplicate records. The design should use `checksum` + `storageKey` checks to avoid accidental reprocessing.

2. Large files  
   A validation guard must stop obviously oversized files before extraction to avoid memory spikes.

3. Unsupported file types  
   Validation must fail early and return a structured rejection code, rather than letting downstream parse code crash.

4. Platform-specific storage differences  
   File metadata should be read via a small storage adapter so the use case does not depend on app-specific filesystem code.

5. Non-deterministic session IDs or timestamps  
   Use UUIDs and ISO timestamps consistently so testing and auditing remain deterministic and cross-platform stable.

6. Partial progress and retries  
   Because the workflow is checkpointed, a restart must be able to resume from the last known state and not “re-open” an already-validated document incorrectly.

### Performance and complexity trade-off

This design intentionally keeps validation and workflow state lightweight. It avoids introducing embeddings, ranking, OCR quality scoring, or search indexing in the first slice. That keeps the initial implementation fast and predictable, while preserving a clean path to later stages.

---

## 7) Acceptance criteria for this slice

- A document upload creates a `Document` and initial `DocumentVersion` record.
- The workflow state is explicitly set to `document_received` after intake.
- A validation step inspects file type, emptiness, readability, and size guardrails.
- Validation writes a structured result with `passed` or `failed` status and explicit rejection metadata.
- The same workflow context is used for both intake and validation steps.
- No embeddings, retrieval, or chunking logic is added in this slice.

---

## 8) Recommendation

Proceed with the first implementation in the feature slice using:
1. `ReceiveDocumentUseCase`
2. `ValidateDocumentUseCase`
3. `DocumentProcessingContext`
4. `DocumentRepository` + `DocumentVersionRepository`
5. `DocumentValidationService` + storage/file adapter

This gives us a durable and reviewable contract for the remaining local RAG pipeline without prematurely expanding scope.

---

## Review Summary

This v2 plan narrows the design to the actual operating boundaries of the first stage:
- intake records the document and creates versioned lifecycle metadata;
- validation decides supportability and saves durable state;
- explicit workflow context preserves traceability across the pipeline;
- the architecture stays aligned with the existing feature-based codebase and the repo’s clean architecture boundaries.

If this direction is approved, implementation should proceed in TDD across the receive/validate slice before moving to extraction or chunking.

---

## Proposed TDD Coverage for v1 Receive + Validate Slice

Keep the tests focused on each workflow step as a separate contract, not on a full end-to-end pipeline.

### 1) `ReceiveDocumentUseCase`
- happy path: valid input creates `Document` and first `DocumentVersion`
- sets `workflowState` to `document_received`
- assigns incrementing `version` for each new upload of same document
- preserves `projectId`, `sourceType`, `storageKey`, and `checksum`
- edge case: missing optional fields still creates a valid record
- edge case: duplicate content with same checksum should either reuse or create version according to the business rule

### 2) `ValidateDocumentUseCase`
- happy path: supported file type and readable file returns `passed`
- invalid file type returns `failed` with `unsupported_file_type`
- empty file returns `failed` with `empty_document`
- unreadable/missing storage file returns `failed` with `cannot_read_file`
- oversized file returns `failed` with `document_too_large`
- updates `DocumentVersion` with `validationStatus`, `supportedForAnalysis`, `validationReason`, `rejectionCode`, and `validatedAt`
- updates workflow state to `validation_passed` or `validation_failed`

### 3) `DocumentProcessingContext`
- created once for a receive/validate cycle and carries `documentId`, `documentVersionId`, `sessionId`, and `projectId`
- immutable enough to be passed through validation without mutation drift
- persists the latest workflow state after each stage

### 4) Repository and storage seams
- repository creates and updates version rows correctly
- storage adapter returns readable metadata and file existence checks
- repo + validator integration confirms persisted version state matches validation result

### 5) TDD execution expectation
- all new tests should be added first and intentionally fail before implementation
- once green, proceed to the next slice (extraction/chunking)

This keeps validation strict and reviewable without introducing embedding or chunking logic before the intake contract is proven stable.
