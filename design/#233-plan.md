# Plan for Issue #233: Local RAG Domain Foundation

**Status**: Draft  
**Date**: 2026-08-13  
**GitHub Issue**: #233  
**Parent issue**: #232 (RAG implementation)

---

## 1. Summary

This task establishes the first, provider-agnostic domain model for the local RAG feature. The goal is to define the core business objects, validation rules, and relationships without introducing SQLite persistence, React Native runtime dependencies, or any LLM/vector-search implementation.

The work is intentionally limited to the domain layer so the rest of the system can evolve independently around a stable contract.

---

## 2. Scope

### In scope
- Define the RAG domain model set proposed in #233 around the existing `Document` entity:
  - `Document` as the project-owned source document (replaces the redundant `ProjectDocument` concept)
  - `DocumentAnalysis`
  - `AnalysisRun`
  - `AnalysisCheckpoint`
  - `ProjectFact`
  - `FactSource`
  - `FactConfirmation`
  - `KnowledgeChunk`
  - `KnowledgeEmbedding`
- Define enums and value objects used by the model
- Define validation rules and canonical relationships
- Keep the model independent of:
  - SQLite
  - React Native APIs
  - LLM providers
  - vector indexes / search engines
- Add compile-level tests proving the model can be used without those dependencies

### Out of scope
- Storage implementation
- Database schema / Drizzle migration
- Vector database integration
- Embedding generation
- Semantic retrieval or ranking
- Generative answer synthesis
- UI screens or hooks

---

## 3. Design Goals

1. Build a durable domain contract for the future local RAG workflow.
2. Keep all types pure TypeScript and framework-independent.
3. Express business invariants in type guards and constructors rather than ad hoc checks.
4. Model evidence lineage clearly so facts can be traced to the source documents and chunks.
5. Support local-first workflows while remaining extensible for future cloud-backed retrieval.

---

## 4. Proposed Domain Model

### 4.1 `Document` (project-owned document)
This is the existing project document entity and should be treated as the canonical source artifact for the RAG feature. We should not introduce a separate `ProjectDocument` model unless a later requirement needs a specialized subtype.

Suggested fields (consistent with the existing domain entity in `src/domain/entities/Document.ts`):
- `id: string`
- `projectId?: string`
- `type?: 'plan' | 'permit' | 'invoice' | 'photo' | string`
- `title?: string`
- `filename?: string`
- `mimeType?: string`
- `size?: number`
- `status: DocumentStatus`
- `localPath?: string`
- `storageKey?: string`
- `cloudUrl?: string`
- `uri?: string`
- `source?: 'camera' | 'scan' | 'import'`
- `taskId?: string`
- `ocrText?: string`
- `tags?: string[]`
- `createdAt?: string`
- `updatedAt?: string`
- `userDocumentType?: DocumentType`
- `detectedDocumentTypeConfidence?: number`
- `documentNumber?: string`
- `issueDate?: Date`
- `author?: string`
- `organisation?: string`
- `analysisStatus: DocumentAnalysisStatus`

Responsibilities:
- Own the raw document lifecycle
- Track project ownership and file metadata
- Act as the parent for document analysis and chunking results
- Preserve the current project/document data model instead of duplicating it under a new name

---

### 4.2 `DocumentAnalysis`
Represents a processing pass performed against the canonical `Document` entity.

Suggested fields:
- `id: string`
- `documentId: string`
- `analysisRunId: string`
- `status: AnalysisStatus`
- `summary?: string`
- `language?: string`
- `confidence?: number`
- `startedAt?: Date`
- `completedAt?: Date`
- `errorMessage?: string`

Responsibilities:
- Capture one analysis job for one project document
- Record extraction/interpretation results without coupling to provider SDKs
- Allow future extension for OCR, metadata extraction, and fact mining

---

### 4.3 `AnalysisRun`
Represents a top-level execution for a project-level analysis session.

Suggested fields:
- `id: string`
- `projectId: string`
- `status: AnalysisStatus`
- `startedAt: Date`
- `completedAt?: Date`
- `documentIds: string[]`
- `checkpointIds: string[]`
- `notes?: string`

Responsibilities:
- Aggregate all document-level analysis work for a project
- Provide the lifecycle boundary for a local analysis workflow
- Keep all checkpoints and results anchored to a single run

---

### 4.4 `AnalysisCheckpoint`
Represents milestones or state transitions inside an analysis run.

Suggested fields:
- `id: string`
- `analysisRunId: string`
- `type: AnalysisCheckpointType`
- `message?: string`
- `payload?: Record<string, unknown>`
- `createdAt: Date`

Responsibilities:
- Make the analysis workflow observable and debuggable
- Preserve progress markers without requiring a full DB-backed audit log
- Support resumable or user-visible processing states

---

### 4.5 `ProjectFact`
Represents a normalized fact extracted from one or more documents.

Suggested fields:
- `id: string`
- `projectId: string`
- `factType: FactType`
- `canonicalText: string`
- `normalizedText?: string`
- `status: FactStatus`
- `confidence?: number`
- `createdAt: Date`
- `updatedAt: Date`

Responsibilities:
- Encapsulate a meaningful project fact
- Keep canonical content separate from raw evidence snippets
- Allow multiple sources and validation states

---

### 4.6 `FactSource`
Represents a provenance record showing where a fact came from.

Suggested fields:
- `id: string`
- `factId: string`
- `sourceType: FactSourceType`
- `sourceId: string`
- `excerpt: string`
- `documentId?: string`
- `chunkId?: string`
- `page?: number`
- `startOffset?: number`
- `endOffset?: number`
- `confidence?: number`

Responsibilities:
- Tie facts back to the exact document/chunk used to derive them
- Preserve evidence and traceability for later validation or debugging
- Support local explainability without requiring a vector index

---

### 4.7 `FactConfirmation`
Represents user or system validation of a fact.

Suggested fields:
- `id: string`
- `factId: string`
- `decision: FactConfirmationDecision`
- `confirmedBy: string`
- `reason?: string`
- `confirmedAt: Date`

Responsibilities:
- Separate fact extraction from fact acceptance
- Support human review, override, and future trust scoring
- Provide the basis for fact-quality improvement loops

---

### 4.8 `KnowledgeChunk`
Represents a semantically bounded section of a document.

Suggested fields:
- `id: string`
- `documentId: string`
- `content: string`
- `chunkIndex: number`
- `tokenCount?: number`
- `startOffset?: number`
- `endOffset?: number`
- `metadata?: Record<string, unknown>`

Responsibilities:
- Break long documents into searchable, reviewable chunks
- Preserve chunk ordering and source offsets
- Create the unit of retrieval for future local RAG workflows

---

### 4.9 `KnowledgeEmbedding`
Represents a vector representation for a `KnowledgeChunk`.

Suggested fields:
- `id: string`
- `chunkId: string`
- `vector: number[]`
- `dimension: number`
- `provider?: string`
- `modelVersion?: string`
- `createdAt: Date`
- `fingerprint?: string`

Responsibilities:
- Store vector metadata without requiring a concrete embedding provider
- Keep vector content separate from the chunk text itself
- Allow future provider swaps without changing the domain contract

---

## 5. Enums and Value Objects

### Proposed enums
- `ProjectDocumentKind`
  - `pdf`
  - `image`
  - `text`
  - `email`
  - `spreadsheet`
  - `other`

- `ProjectDocumentStatus`
  - `uploaded`
  - `queued`
  - `processing`
  - `ready`
  - `failed`

- `AnalysisStatus`
  - `queued`
  - `running`
  - `completed`
  - `failed`
  - `cancelled`

- `AnalysisCheckpointType`
  - `started`
  - `document_extracted`
  - `facts_generated`
  - `confirmations_updated`
  - `completed`
  - `error`

- `FactType`
  - `budget`
  - `schedule`
  - `scope`
  - `risk`
  - `requirement`
  - `constraint`
  - `assumption`
  - `procurement`
  - `quality`
  - `other`

- `FactStatus`
  - `proposed`
  - `confirmed`
  - `rejected`
  - `stale`

- `FactSourceType`
  - `document`
  - `chunk`
  - `fact`
  - `user`
  - `external`

- `FactConfirmationDecision`
  - `accepted`
  - `rejected`
  - `needs_review`

### Proposed value objects
- `EmbeddingVector`
  - wraps `number[]` and validates non-empty finite values
- `NormalizedFactText`
  - canonicalized string with whitespace normalization
- `DocumentFingerprint`
  - hash-based identity for deduplication / caching
- `ConfidenceScore`
  - bounded numeric range (for example $[0,1]$)

---

## 6. Validation Rules

The domain should enforce the following invariants:

1. Every entity must have a stable id.
2. `projectId` is required for all project-scoped entities.
3. `ProjectDocument.filename` and `ProjectDocument.kind` must be non-empty and valid.
4. `KnowledgeChunk.content` cannot be empty.
5. `KnowledgeEmbedding.vector` must be non-empty and each value must be finite.
6. `KnowledgeEmbedding.dimension` must match `vector.length`.
7. `ProjectFact.canonicalText` must not be blank after normalization.
8. `FactSource.excerpt` must refer to a valid underlying source record or document.
9. `AnalysisRun.documentIds` must not contain duplicates.
10. `AnalysisCheckpoint.analysisRunId` must reference an existing run within the same aggregate.
11. `FactConfirmation.confirmedBy` must be populated.
12. Confidence, when present, must be within the allowed range.

These rules should live in the domain model and be checked by constructors or static factory methods, not by repository or UI code.

---

## 7. Relationship Model

```text
Project
  ├── ProjectDocument[]
  │     ├── DocumentAnalysis[]
  │     └── KnowledgeChunk[]
  │
  ├── AnalysisRun[]
  │     ├── AnalysisCheckpoint[]
  │     └── DocumentAnalysis[]
  │
  ├── ProjectFact[]
  │     ├── FactSource[]
  │     └── FactConfirmation[]
  │
  └── KnowledgeChunk[]
        └── KnowledgeEmbedding?
```

Key relationships:
- One `Project` owns many project documents and facts.
- One `ProjectDocument` may produce many `KnowledgeChunk` values and many `DocumentAnalysis` records.
- One `DocumentAnalysis` belongs to one `AnalysisRun`.
- One `AnalysisRun` contains many checkpoints.
- One `ProjectFact` may have many `FactSource` records.
- One `ProjectFact` may have many `FactConfirmation` records.
- One `KnowledgeChunk` may have zero or one `KnowledgeEmbedding`.

---

## 8. Proposed File Layout

Because this project favors clean architecture, the RAG domain types should live in the shared domain layer rather than in a feature-local `domain` folder. A better structure is:

```text
src/
  domain/
    entities/
      Document.ts
      DocumentAnalysis.ts
      AnalysisRun.ts
      AnalysisCheckpoint.ts
      ProjectFact.ts
      FactSource.ts
      FactConfirmation.ts
      KnowledgeChunk.ts
      KnowledgeEmbedding.ts
    enums/
      ragEnums.ts
    value-objects/
      EmbeddingVector.ts
      NormalizedFactText.ts
      ConfidenceScore.ts
    validation/
      ragValidation.ts

  features/
    rag/
      application/
      infrastructure/
      tests/
```

This keeps the core business model in the domain layer while still leaving feature-specific orchestration and adapters in the RAG feature area.

---

## 9. Implementation Plan

### Phase 1 — Domain entity scaffolding
1. Create the model files under `src/domain/entities/` (or a focused subfolder such as `src/domain/entities/rag/` if we want grouping without moving them out of the domain layer).
2. Define explicit TypeScript interfaces or classes with readonly properties.
3. Add minimal constructors or factory helpers for required invariants.
4. Keep all types independent of storage, React Native, and provider SDKs.

### Phase 2 — Enums and value objects
1. Add enums for document type, fact type, status, checkpoint type, and confirmation type.
2. Add value-object wrappers for vector data and normalized fact text.
3. Validate numeric boundaries and empty-content rules.

### Phase 3 — Validation and relationships
1. Add shared domain validation helpers.
2. Add `assert*` or factory checks for invalid states.
3. Document aggregate relationships and expected ownership.

### Phase 4 — Compile safety / TDD
1. Write failing tests for invalid model states and valid model creation.
2. Verify TypeScript compile passes with no framework or SQLite coupling.
3. Keep tests focused on data integrity, not on repository or runtime behavior.

### Phase 5 — Integration readiness
1. Document the expected repository contracts for future stages.
2. Classify which pieces are domain-only vs infrastructure-bound.
3. Leave the next issue open for persistence and vector-store adapters.

---

## 10. Testing Strategy

### Unit tests to add
- `ProjectDocument` can be created with valid metadata
- invalid empty filename fails validation
- `KnowledgeEmbedding` rejects mismatched vector length and dimension
- `ProjectFact` rejects blank canonical text
- `AnalysisRun` does not allow duplicate document IDs
- `FactSource` links to a valid project document or chunk
- `FactConfirmation` requires a non-empty actor identity

### Compile-level checks
- `tsc --noEmit` passes in a clean environment
- no `react-native` imports in the RAG domain package
- no SQLite/Drizzle imports in the RAG domain package
- no provider or embedding-library imports in the domain package

This is the minimum proof that the model is properly isolated from implementation dependencies.

---

## 11. Acceptance Criteria

The issue is complete when all of the following are true:

- [ ] The existing `Document` entity is used as the project-owned source document model; no redundant `ProjectDocument` type is introduced unless explicit need emerges.
- [ ] All remaining RAG models are defined in the domain layer.
- [ ] Enums and value objects are defined and used consistently.
- [ ] Domain validation prevents invalid empty or inconsistent object states.
- [ ] The model is free of SQLite, React Native, and provider-specific imports.
- [ ] TypeScript compilation succeeds for the new model code.
- [ ] The model can be used as the contract for future repositories, storage adapters, and retrieval services.

---

## 12. Risks / Non-Goals

### Risks
- Defining the model too early or too concretely may lock future retrieval implementation into a poor abstraction.
- If fact provenance is under-specified, it will be difficult to support explainable AI or user review later.

### Approach to reduce risk
- Keep the model intentionally framework-neutral and evidence-first.
- Prefer explicit relationships and provenance over hidden assumptions.
- Keep vector-specific logic isolated to the `KnowledgeEmbedding` model, not spread across the whole domain.

---

## 13. Next Step

The immediate next issue should be to implement the actual TypeScript domain files and unit tests for validation and model composition, while leaving the repository and infrastructure layers for later RAG feature milestones.
