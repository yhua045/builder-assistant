# CLAUDE.md

## Project Principles & Non-Negotiables

- Keep feature ownership local: app-specific logic lives under `src/features/*`, shared runtime wiring stays in `src/shared`.
- All persistence goes through repository implementations; no raw database calls from screens, hooks, or use cases.
- Preserve the aggregate boundary: the parent run validates child retry state before any stage is resumed or retried.
- Use the existing SQLite + Drizzle schema as the canonical source of truth; never create a second DB or orchestration engine for the same feature.
- Treat `documents.checksum` as content identity only: preserve duplicate `documents` rows and reuse RAG through `rag_source_document_id` instead of deleting or merging uploads.
- Keep the RAG persistence chain intact: `documents` -> `extracted_document_text` -> `knowledge_chunks` -> `knowledge_embeddings`; workflow state belongs in `knowledge_embedding_runs`.
- Treat `knowledge_embedding_runs` as the durable parent workflow and `knowledge_detail_runs` as per-stage progress/retry/checkpoint state; `InMemoryWorkflowQueue` is only an in-process projection.
- Keep one container-cached `KnowledgeEmbeddingQueueConsumer`; startup restores pending/partial/running rows before draining, and duplicate run IDs must not execute concurrently.

## Directory & File Location Rules

```text
Feature domain models:      src/features/<feature>/domain/entities/
Feature repositories:       src/features/<feature>/infrastructure/repositories/
Feature use cases:          src/features/<feature>/application/usecases/
Feature services:           src/features/<feature>/application/services/
Knowledge queue worker:     src/features/knowledge-embedding/workflow/application/services/KnowledgeEmbeddingQueueConsumer.ts
Shared DB schema:           src/shared/infrastructure/database/schema.ts
Shared DI wiring:           src/shared/infrastructure/di/registerServices.ts
App bootstrap:              src/app/**
UI screens/components:      src/features/<feature>/screens/ or src/components/
Tests:                      src/features/<feature>/tests/**
Embedding data-flow docs:   docs/Embedding-Data-Flow.md
```

## Coding Idioms & Patterns

```ts
// Use case owns orchestration; domain entities validate state.
const run = KnowledgeEmbeddingRunEntity.create({ id, documentId, status: 'pending', createdAt: new Date() });
const detail = run.createDetailRun({ id: 'detail-1', runId: run.data().id, stage: 'chunking', status: 'failed', retryCount: 1, createdAt: new Date() });
```

```ts
// Search orchestration delegates to the retrieval service; repository remains the SQL boundary.
const service = new DefaultSemanticSearchService(repository, embeddingService);
const result = await new SearchKnowledgeUseCaseImpl(service).execute(request);
```

```ts
// Repositories are the only boundary that touches SQLite directly.
async function findByDocumentVersion(documentId: string, version: number) {
  return db.executeSql('SELECT * FROM knowledge_embedding_runs WHERE document_id = ? AND document_version = ?', [documentId, version]);
}
```

```ts
// Default DI pattern for feature wiring.
container.register('SearchKnowledgeUseCase', {
  useFactory: (c) => new SearchKnowledgeUseCaseImpl(c.resolve('SemanticSearchService')),
});
```

```ts
// State machine pattern: validate before transition.
if (run.status === 'completed' || run.status === 'cancelled') {
  throw new Error('KnowledgeEmbeddingRun retry is only allowed while active or partial');
}
```

```ts
// Queue pattern: durable state first; runtime queue only dispatches work.
await orchestrator.restorePipelineQueue();
consumer.start();
```

```ts
// Duplicate uploads remain independent documents but reuse completed RAG data.
const source = await documentRepository.findAll({ checksum: document.checksum });
duplicate.ragSourceDocumentId = sourceDocument.id;
```

## Testing & Verification Commands

```bash
# Type check
npx tsc --noEmit

# Knowledge-embedding feature tests
npx jest src/features/knowledge-embedding/tests --runInBand

# Targeted unit suite
npx jest src/features/knowledge-embedding/tests/unit --runInBand

# Integration suite
npx jest src/features/knowledge-embedding/tests/integration --runInBand

# Lint
npm run lint
```

## Quick Commands

```bash
npm start
npm test
npx tsc --noEmit
npm run db:generate
npm run db:push
```
