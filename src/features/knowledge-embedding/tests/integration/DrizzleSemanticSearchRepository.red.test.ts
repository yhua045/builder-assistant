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

import { initDatabase, getDatabase } from '../../../../shared/infrastructure/database/connection';
import { DrizzleSemanticSearchRepository } from '../../infrastructure/repositories/DrizzleSemanticSearchRepository';

describe('DrizzleSemanticSearchRepository (red)', () => {
  beforeEach(async () => {
    await initDatabase();
    const { db } = getDatabase();

    await db.executeSql(`DELETE FROM knowledge_embeddings`);
    await db.executeSql(`DELETE FROM knowledge_chunks`);

    await db.executeSql(
      `INSERT INTO knowledge_chunks (
        id,
        document_id,
        document_version,
        project_id,
        content,
        chunk_index,
        start_offset,
        end_offset,
        is_outdated,
        is_superseded,
        metadata,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        'chunk-1',
        'doc-1',
        1,
        'project-1',
        'Budget approval timeline for the renovation project.',
        0,
        0,
        44,
        0,
        0,
        JSON.stringify({ sectionHint: 'budget', page: 3 }),
        Date.now(),
        Date.now(),
      ],
    );

    await db.executeSql(
      `INSERT INTO knowledge_embeddings (
        id,
        chunk_id,
        vector,
        dimension,
        provider,
        model_version,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        'embedding-1',
        'chunk-1',
        JSON.stringify([0.4, 0.8, 0.2, 0.7]),
        4,
        'local-search-test',
        'semantic-search-test-v1',
        Date.now(),
      ],
    );
  });

  it('applies document and metadata filters while retrieving nearest matches', async () => {
    const repository = new DrizzleSemanticSearchRepository();

    const matches = await repository.findNearestMatches([0.4, 0.8, 0.2, 0.7], {
      documentId: 'doc-1',
      projectId: 'project-1',
      metadataFilters: { sectionHint: 'budget' },
      limit: 5,
      threshold: 0.1,
    });

    expect(matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          documentId: 'doc-1',
          metadata: expect.objectContaining({ sectionHint: 'budget' }),
        }),
      ]),
    );
  });

  it('returns an empty match list when no persisted chunks satisfy the filters', async () => {
    const repository = new DrizzleSemanticSearchRepository();

    const matches = await repository.findNearestMatches([0.1, 0.2, 0.3, 0.4], {
      documentId: 'doc-missing',
      metadataFilters: { sectionHint: 'no-such-section' },
      limit: 10,
      threshold: 0.9,
    });

    expect(matches).toEqual([]);
  });
});
