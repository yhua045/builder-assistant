jest.mock('react-native-sqlite-storage', () => {
  const BetterSqlite3 = require('better-sqlite3');
  const sharedDb = new BetterSqlite3(':memory:');

  function createAdapter(db: any) {
    return {
      executeSql: async (sql: string, params: any[] = []) => {
        const trimmed = sql.trim();
        const upper = trimmed.toUpperCase();

        if (upper.startsWith('SELECT')) {
          const rows = db.prepare(trimmed).all(...params);
          return [{ rows: { length: rows.length, item: (index: number) => rows[index] } }];
        }

        if (params.length > 0) {
          try {
            db.prepare(trimmed).run(...params);
            return [{ rows: { length: 0, item: () => undefined } }];
          } catch {
            // DDL and migration statements are executed below.
          }
        }

        db.exec(trimmed);
        return [{ rows: { length: 0, item: () => undefined } }];
      },
      transaction: async (fn: any) => {
        db.exec('BEGIN');
        try {
          const transaction = {
            executeSql: (sql: string, params?: any[]) => createAdapter(db).executeSql(sql, params ?? []),
          };
          await fn(transaction);
          db.exec('COMMIT');
        } catch (error) {
          db.exec('ROLLBACK');
          throw error;
        }
      },
      close: async () => {},
    };
  }

  return {
    enablePromise: (_enabled: boolean) => {},
    openDatabase: async () => createAdapter(sharedDb),
  };
});

import type { Document } from '../../../../shared/domain/entities/Document';
import { ParserRegistry } from '../../../../shared/application/services/DocumentParserService';
import { PdfTextParser } from '../../infrastructure/parsers/PdfTextParser';
import { closeDatabase, getDatabase, initDatabase } from '../../../../shared/infrastructure/database/connection';
import { DrizzleDocumentRepository } from '../../../../shared/infrastructure/repositories/DrizzleDocumentRepository';
import { DrizzleEmbeddingRepository } from '../../../../shared/infrastructure/repositories/DrizzleEmbeddingRepository';
import { DrizzleExtractedDocumentTextRepository } from '../../infrastructure/repositories/DrizzleExtractedDocumentTextRepository';
import { DrizzleDocumentChunkingWorkflowRepository } from '../../infrastructure/repositories/DrizzleDocumentChunkingWorkflowRepository';
import { DrizzleKnowledgeEmbeddingRunRepository } from '../../infrastructure/repositories/DrizzleKnowledgeEmbeddingRunRepository';
import { ParseDocumentUseCase } from '../../application/usecases/ParseDocumentUseCase';
import { ExtractParsedDocumentUseCase } from '../../application/usecases/ExtractParsedDocumentUseCase';
import { ChunkDocumentUseCase } from '../../application/usecases/ChunkDocumentUseCase';
import { InMemoryWorkflowQueue } from '../../application/services/InMemoryWorkflowQueue';
import { KnowledgeEmbeddingQueueConsumer } from '../../application/services/KnowledgeEmbeddingQueueConsumer';
import { RagPipelineOrchestrator } from '../../application/services/RagPipelineOrchestrator';

const documentText = 'The project schedule requires concrete delivery before the final inspection. '.repeat(12).trim();

function createParserRegistry(): ParserRegistry {
  return new ParserRegistry([new PdfTextParser()]);
}

function createDocument(id: string): Document {
  return {
    id,
    projectId: 'project-integration',
    title: 'Integration text document',
    filename: 'integration.pdf',
    mimeType: 'application/pdf',
    status: 'local-only',
    ocrText: documentText,
    tags: [],
  };
}

async function clearDatabase(): Promise<void> {
  await initDatabase();
  const { db } = getDatabase();
  for (const table of [
    'knowledge_embeddings',
    'knowledge_chunks',
    'chunk_document_progress',
    'extracted_document_text',
    'knowledge_embedding_runs',
    'documents',
  ]) {
    try {
      await db.executeSql(`DELETE FROM ${table}`);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('no such table')) {
        throw error;
      }
    }
  }
}

function createOrchestrator() {
  const queue = new InMemoryWorkflowQueue();
  const workflowRepository = new DrizzleDocumentChunkingWorkflowRepository();
  const runRepository = new DrizzleKnowledgeEmbeddingRunRepository();
  const extractedTextRepository = new DrizzleExtractedDocumentTextRepository();
  const chunkDocument = {
    execute: async (input: Parameters<ChunkDocumentUseCase['execute']>[0]) => ({
      documentId: input.documentId,
      documentVersionId: input.documentVersionId,
      documentVersion: input.documentVersion,
      workflowState: 'chunking_complete' as const,
      status: 'chunked' as const,
      chunks: [],
    }),
  } as unknown as ChunkDocumentUseCase;

  const orchestrator = new RagPipelineOrchestrator({
    workflowRepository: runRepository,
    queue,
    pipeline: {
      documentRepository: new DrizzleDocumentRepository(),
      workflowRepository,
      parseDocument: new ParseDocumentUseCase(createParserRegistry(), extractedTextRepository),
      extractParsedDocument: new ExtractParsedDocumentUseCase(extractedTextRepository),
      chunkDocument,
      embedChunk: { execute: async () => ({ chunkId: '', status: 'duplicate' as const }) },
      embeddingRepository: new DrizzleEmbeddingRepository(),
    },
  });

  return { orchestrator, queue, workflowRepository, extractedTextRepository };
}

describe('RagPipelineOrchestrator SQLite integration', () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  it('persists a pending workflow and publishes one matching queue item', async () => {
    const documentRepository = new DrizzleDocumentRepository();
    const { orchestrator, queue, workflowRepository } = createOrchestrator();
    const document = createDocument('doc-rpo-001');
    await documentRepository.save(document);

    const run = await orchestrator.execute(document.id);
    const persisted = await workflowRepository.findByDocumentVersion(document.id, 1);
    const queued = queue.dequeue();

    expect(run.documentId).toBe(document.id);
    expect(run.status).toBe('pending');
    expect(run.currentStage).toBe('parsing');
    expect(persisted?.id).toBe(run.id);
    expect(persisted?.status).toBe('pending');
    expect(persisted?.workflowState).toBe('parsing');
    expect(queued).toEqual({ runId: run.id, documentId: document.id, documentVersion: 1 });
    expect(queue.dequeue()).toBeUndefined();
  });

  it('parses the queued text document and persists extracted text before downstream stages', async () => {
    const documentRepository = new DrizzleDocumentRepository();
    const { orchestrator, queue, workflowRepository, extractedTextRepository } = createOrchestrator();
    const document = createDocument('doc-rpo-002');
    await documentRepository.save(document);

    await orchestrator.execute(document.id);
    const queued = queue.dequeue();
    expect(queued).toBeDefined();

    const result = await orchestrator.executeQueuedItem(queued!);
    const extracted = await extractedTextRepository.findByDocumentVersion(document.id, 1);
    const persisted = await workflowRepository.findByDocumentVersion(document.id, 1);

    expect(result.status).toBe('completed');
    expect(extracted?.documentId).toBe(document.id);
    expect(extracted?.documentVersion).toBe(1);
    expect(extracted?.text).toBe(documentText);
    expect(extracted?.pageMetadata).toHaveLength(0);
    expect(persisted?.workflowState).toBe('completed');
    expect(persisted?.lastEvent).toBe('pipeline_completed');
  });

  it('reuses the active workflow and does not publish a duplicate queue item', async () => {
    const documentRepository = new DrizzleDocumentRepository();
    const { orchestrator, queue, workflowRepository } = createOrchestrator();
    const document = createDocument('doc-rpo-003');
    await documentRepository.save(document);

    const first = await orchestrator.execute(document.id);
    const second = await orchestrator.execute(document.id);
    const persisted = await workflowRepository.findByDocumentVersion(document.id, 1);

    expect(second.id).toBe(first.id);
    expect(persisted?.id).toBe(first.id);
    expect(queue.dequeue()).toEqual({ runId: first.id, documentId: document.id, documentVersion: 1 });
    expect(queue.dequeue()).toBeUndefined();
  });

  it('drains published work through the consumer into the orchestrator', async () => {
    const documentRepository = new DrizzleDocumentRepository();
    const { orchestrator, queue, workflowRepository, extractedTextRepository } = createOrchestrator();
    const consumer = new KnowledgeEmbeddingQueueConsumer(queue, orchestrator);
    const document = createDocument('doc-rpo-004');
    await documentRepository.save(document);

    consumer.start();
    try {
      await orchestrator.execute(document.id);
      await consumer.drain();

      const extracted = await extractedTextRepository.findByDocumentVersion(document.id, 1);
      const persisted = await workflowRepository.findByDocumentVersion(document.id, 1);

      expect(extracted?.text).toBe(documentText);
      expect(persisted?.status).toBe('completed');
      expect(persisted?.lastEvent).toBe('pipeline_completed');
    } finally {
      consumer.stop();
    }
  });
});
