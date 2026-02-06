// Mock react-native-sqlite-storage with a small adapter backed by better-sqlite3 (:memory:)

jest.mock('react-native-sqlite-storage', () => {
  function createAdapter(db: any) {
    return {
      executeSql: async (sql: string, params: any[] = []) => {
        const stmt = sql.trim();
        const upper = stmt.toUpperCase();

        // Run SELECT queries and return rows
        if (upper.startsWith('SELECT')) {
          const rows = db.prepare(stmt).all(...params);
          return [ { rows: { length: rows.length, item: (i: number) => rows[i] } } ];
        }

        // If params are provided, use a prepared statement (handles placeholders)
        if (params && params.length > 0) {
          try {
            const prepared = db.prepare(stmt);
            prepared.run(...params);
            return [ { rows: { length: 0, item: (_: number) => undefined } } ];
          } catch (e) {
            // fallthrough to exec
          }
        }

        // No params or prepared failed: try exec (for DDL or simple statements)
        if (stmt) db.exec(stmt);
        return [ { rows: { length: 0, item: (_: number) => undefined } } ];
      },
      transaction: async (fn: any) => {
        db.exec('BEGIN');
        try {
          const tx = { executeSql: (sql: string, params?: any[]) => createAdapter(db).executeSql(sql, params) };
          await fn(tx);
          db.exec('COMMIT');
        } catch (err) {
          db.exec('ROLLBACK');
          throw err;
        }
      },
      close: async () => db.close(),
    };
  }

  return {
    enablePromise: (_: boolean) => {},
    openDatabase: async (_: any) => {
      // require inside factory to satisfy Jest's mock factory constraints
      const BetterSqlite3 = require('better-sqlite3');
      const db = new BetterSqlite3(':memory:');
      return createAdapter(db);
    }
  };
});

import { DrizzleProjectRepository } from '../../src/infrastructure/repositories/DrizzleProjectRepository';
import { ProjectStatus } from '../../src/domain/entities/Project';
import { closeDatabase } from '../../src/infrastructure/database/connection';

describe('DrizzleProjectRepository contract methods (better-sqlite3 :memory:)', () => {
  it('create, findByExternalId, list, count, withTransaction', async () => {
    const repo: any = new DrizzleProjectRepository();

    await repo.init();

    // create (should return created project)
    const created = await repo.create?.({ id: 'int-project-2', name: 'Created Project', status: ProjectStatus.PLANNING, materials: [], phases: [], meta: { externalId: 'ext-123' } });
    expect(created).toBeDefined();

    // findByExternalId
    const byExternal = await repo.findByExternalId?.('ext-123');
    expect(byExternal).not.toBeNull();
    expect(byExternal?.id).toBe('int-project-2');

    // list & count
    const listRes = await repo.list?.({}, { limit: 10 });
    expect(listRes).toBeDefined();
    expect(Array.isArray(listRes.items)).toBeTruthy();

    const total = await repo.count?.({});
    expect(typeof total).toBe('number');

    // withTransaction: perform a transaction and rollback on error
    try {
      await repo.withTransaction(async (txRepo: any) => {
        await txRepo.save({ id: 'tx-proj', name: 'Tx Project', status: ProjectStatus.PLANNING, materials: [], phases: [] });
        throw new Error('force rollback');
      });
    } catch (e) {
      // expected
    }

    const txCheck = await repo.findById('tx-proj');
    expect(txCheck).toBeNull();

    // cleanup
    await repo.delete?.('int-project-2');
    await closeDatabase();
  }, 15000);
});
