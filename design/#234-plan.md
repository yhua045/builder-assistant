# Plan for Issue #234: RAG SQLite Persistence

**Status**: Draft  
**Date**: 2026-08-13  
**GitHub Issue**: #234  
**Parent issue**: #232 (RAG implementation)

---

## 1. Goal

Persist the local RAG domain so a project can survive app restarts without losing documents, extracted facts, chunks, or embeddings. This is storage-only work: it defines the repository contracts and SQLite-backed persistence needed to restore the knowledge graph after reopening the app.

## 2. Scope

### In scope
- Add repository interfaces for the RAG domain objects:
  - `DocumentRepository`
  - `AnalysisRepository`
  - `KnowledgeRepository`
  - `CheckpointRepository`
  - `ChunkRepository`
  - `EmbeddingRepository`
- Implement Drizzle-backed adapters in the infrastructure layer.
- Store and reload project-owned documents, analysis records, facts, chunks, and embeddings.
- Preserve provenance and relationships between facts and their source text/chunks.
- Ensure the app can reopen and rehydrate stored knowledge state.

### Out of scope
- Any UI or screen changes
- Embedding generation or model inference
- Search/retrieval ranking logic
- Prompting or answer synthesis
- Cross-device sync or cloud persistence

## 3. Proposed design

### Source code file structure
The domain entities should remain in the shared domain layer, while persistence-specific repositories remain in infrastructure. This preserves the current architecture and avoids letting every feature create its own domain model tree.

```text
src/
├── domain/
│   ├── entities/
│   │   ├── Document.ts
│   │   ├── DocumentAnalysis.ts
│   │   ├── AnalysisRun.ts
│   │   ├── AnalysisCheckpoint.ts
│   │   ├── KnowledgeFact.ts
│   │   ├── FactSource.ts
│   │   ├── FactConfirmation.ts
│   │   ├── KnowledgeChunk.ts
│   │   └── KnowledgeEmbedding.ts
│   ├── enums/
│   ├── value-objects/
│   ├── validation/
│   └── services/
├── features/
│   └── knowledge-embedding/
│       ├── application/
│       │   ├── use-cases/
│       │   │   ├── SaveDocumentAnalysis.ts
│       │   │   ├── RestoreProjectKnowledge.ts
│       │   │   └── UpsertKnowledgeFact.ts
│       │   └── ports/
│       ├── hooks/
│       ├── screens/
│       ├── tests/
│       └── index.ts
├── infrastructure/
│   ├── database/
│   │   ├── schema.ts
│   │   └── migrations/
│   └── repositories/
│       ├── DrizzleDocumentRepository.ts
│       ├── DrizzleAnalysisRepository.ts
│       ├── DrizzleKnowledgeRepository.ts
│       ├── DrizzleCheckpointRepository.ts
│       ├── DrizzleChunkRepository.ts
│       └── DrizzleEmbeddingRepository.ts
└── shared/ (only for generic helpers, not feature-specific domain state)
```

### Repository access rule
The design must enforce slice boundaries without introducing a second domain layer:
- Domain entities remain in `src/domain` and are not duplicated inside feature folders.
- Repository implementations live in `src/infrastructure/repositories` and are bound to their persistence concerns.
- A feature may depend on the domain entities and application use-cases, but it should not directly import unrelated feature repositories across the app.
- Cross-slice coordination happens through use-cases and DI wiring, not by aggregate-to-aggregate repository coupling.
- The only shared abstraction between domain and storage should be the repository contract or port that the infrastructure implementation satisfies.

This keeps the system vertical-slice friendly while preserving the project’s established domain/infrastructure split.

### Repository contract
Keep the repository layer aligned with the clean-architecture pattern:
- Shared domain entities live in `src/domain`.
- Repository contracts/ports are infrastructure-owned persistence boundaries, implemented by Drizzle adapters in `src/infrastructure`.
- Application/use-case layer orchestrates save/load flows without knowing storage details.

Each repository should support the basic CRUD pattern the issue calls for, plus project-scoped queries such as:
- `getById(id)`
- `getByProjectId(projectId)`
- `save(entity)`
- `delete(id)`
- `listByProject(projectId)` or equivalent read helpers

### Storage model
Persist the domain graph in a stable shape:
- `Document` is the root artifact
- `DocumentAnalysis` and `AnalysisCheckpoint` track processing status/history
- `Knowledge`/`Fact` records hold normalized facts
- `Chunk` stores text segments tied to a document
- `Embedding` stores vector representation for a chunk/fact when available

This keeps the database model 1:1 with the domain, while allowing later retrieval features to query the persisted knowledge without re-running analysis.

## 4. Acceptance criteria

- A project can be created.
- Documents can be added and saved.
- Facts and related chunks/embeddings can be persisted.
- The app can be closed.
- Reopening the app restores the stored project knowledge and document lineage.

## 5. Implementation notes

- Use Drizzle ORM only, consistent with the project’s existing persistence conventions.
- Add migration coverage for new tables and relationships.
- Keep repository methods narrow and typed to the domain objects.
- Validate restore behavior with a focused integration test that exercises the full app reopen flow.

---

This is intentionally a storage-focused plan only. I am not proceeding with implementation until it is approved.
