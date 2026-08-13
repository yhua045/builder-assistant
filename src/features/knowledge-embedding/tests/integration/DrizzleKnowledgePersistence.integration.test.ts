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
          return [{ rows: { length: rows.length, item: (i: number) => rows[i] } }];
        }

        if (params.length > 0) {
          try {
            db.prepare(trimmed).run(...params);
            return [{ rows: { length: 0, item: () => undefined } }];
          } catch (e) {
            // fall through for DDL / bulk SQL
          }
        }

        db.exec(trimmed);
        return [{ rows: { length: 0, item: () => undefined } }];
      },
      transaction: async (fn: any) => {
        db.exec('BEGIN');
        try {
          const tx = {
            executeSql: (sql: string, params?: any[]) => createAdapter(db).executeSql(sql, params ?? []),
          };
          await fn(tx);
          db.exec('COMMIT');
        } catch (err) {
          db.exec('ROLLBACK');
          throw err;
        }
      },
      close: async () => {
        // preserve the shared in-memory database across reopen simulation
      },
    };
  }

  return {
    enablePromise: (_: boolean) => {},
    openDatabase: async () => createAdapter(sharedDb),
  };
});

import { closeDatabase, initDatabase } from '../../../../infrastructure/database/connection';
import { DrizzleKnowledgeRepository } from '../../../../infrastructure/repositories/DrizzleKnowledgeRepository';
import { DrizzleChunkRepository } from '../../../../infrastructure/repositories/DrizzleChunkRepository';
import { DrizzleEmbeddingRepository } from '../../../../infrastructure/repositories/DrizzleEmbeddingRepository';
import { ProjectFactEntity } from '../../../../domain/entities/ProjectFact';
import { KnowledgeChunkEntity } from '../../../../domain/entities/KnowledgeChunk';
import { KnowledgeEmbeddingEntity } from '../../../../domain/entities/KnowledgeEmbedding';

describe('RAG SQLite persistence', () => {
  it('persists facts, chunks and embeddings for a project and restores them after reopening', async () => {
    const knowledgeRepo = new DrizzleKnowledgeRepository();
    const chunkRepo = new DrizzleChunkRepository();
    const embeddingRepo = new DrizzleEmbeddingRepository();

    await initDatabase();

    const fact = ProjectFactEntity.create({
      id: 'fact-1',
      projectId: 'project-1',
      factType: 'budget',
      canonicalText: 'Concrete budget is $12,000',
      normalizedText: 'concrete budget is 12000',
      status: 'confirmed',
      confidence: 0.97,
    }).data();

    await knowledgeRepo.saveFact(fact);
    const savedFacts = await knowledgeRepo.findFactsByProjectId('project-1');
    expect(savedFacts).toHaveLength(1);
    expect(savedFacts[0].canonicalText).toBe('Concrete budget is $12,000');

    const chunk = KnowledgeChunkEntity.create({
      id: 'chunk-1',
      documentId: 'doc-1',
      content: 'Concrete budget is $12,000 and schedule is tight.',
      chunkIndex: 0,
      startOffset: 0,
      endOffset: 44,
    }).data();

    await chunkRepo.save(chunk);
    const restoredChunk = await chunkRepo.findByDocumentId('doc-1');
    expect(restoredChunk).toHaveLength(1);
    expect(restoredChunk[0].content).toContain('Concrete budget');

    const embedding = KnowledgeEmbeddingEntity.create({
      id: 'embedding-1',
      chunkId: 'chunk-1',
      vector: [0.1, 0.2, 0.3],
      dimension: 3,
      provider: 'local-test',
      createdAt: new Date(),
    }).data();

    await embeddingRepo.save(embedding);
    const storedEmbedding = await embeddingRepo.findByChunkId('chunk-1');
    expect(storedEmbedding).toHaveLength(1);
    expect(storedEmbedding[0].vector).toEqual([0.1, 0.2, 0.3]);

    await closeDatabase();

    const reopenedKnowledgeRepo = new DrizzleKnowledgeRepository();
    const reopenedChunkRepo = new DrizzleChunkRepository();
    const reopenedEmbeddingRepo = new DrizzleEmbeddingRepository();

    await initDatabase();
    const reopenedFacts = await reopenedKnowledgeRepo.findFactsByProjectId('project-1');
    const reopenedChunks = await reopenedChunkRepo.findByDocumentId('doc-1');
    const reopenedEmbeddings = await reopenedEmbeddingRepo.findByChunkId('chunk-1');

    expect(reopenedFacts).toHaveLength(1);
    expect(reopenedChunks).toHaveLength(1);
    expect(reopenedEmbeddings).toHaveLength(1);

    await closeDatabase();
  }, 15000);
});
