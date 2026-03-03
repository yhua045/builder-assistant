// Integration test: DrizzleDelayReasonTypeRepository reads the seeded catalog

jest.mock('react-native-sqlite-storage', () => {
  function createAdapter(db: any) {
    return {
      executeSql: async (sql: string, params: any[] = []) => {
        const stmt = sql.trim();
        const upper = stmt.toUpperCase();
        if (upper.startsWith('SELECT')) {
          const rows = db.prepare(stmt).all(...params);
          return [{ rows: { length: rows.length, item: (i: number) => rows[i] } }];
        }
        if (params && params.length > 0) {
          try {
            const prepared = db.prepare(stmt);
            prepared.run(...params);
            return [{ rows: { length: 0, item: (_: number) => undefined } }];
          } catch {
            // fallthrough
          }
        }
        if (stmt) db.exec(stmt);
        return [{ rows: { length: 0, item: (_: number) => undefined } }];
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
      const BetterSqlite3 = require('better-sqlite3');
      const db = new BetterSqlite3(':memory:');
      return createAdapter(db);
    },
  };
});

import { initDatabase } from '../../src/infrastructure/database/connection';
import { DrizzleDelayReasonTypeRepository } from '../../src/infrastructure/repositories/DrizzleDelayReasonTypeRepository';

describe('DrizzleDelayReasonTypeRepository (integration)', () => {
  let repo: DrizzleDelayReasonTypeRepository;

  beforeAll(async () => {
    await initDatabase();
    repo = new DrizzleDelayReasonTypeRepository();
  });

  it('findAll() returns the 10 seeded reason types ordered by display_order', async () => {
    const types = await repo.findAll();

    expect(types).toHaveLength(10);
    // Ordered by displayOrder
    expect(types[0].id).toBe('WEATHER');
    expect(types[0].label).toBe('Bad weather');
    expect(types[0].displayOrder).toBe(1);
    expect(types[0].isActive).toBe(true);

    expect(types[9].id).toBe('OTHER');
    expect(types[9].displayOrder).toBe(10);
  });

  it('findAll() includes only active entries', async () => {
    const types = await repo.findAll();
    expect(types.every((t) => t.isActive)).toBe(true);
  });

  it('findById() returns the correct entry', async () => {
    const weather = await repo.findById('WEATHER');
    expect(weather).not.toBeNull();
    expect(weather!.label).toBe('Bad weather');
    expect(weather!.displayOrder).toBe(1);
  });

  it('findById() returns null for unknown id', async () => {
    const missing = await repo.findById('NONEXISTENT');
    expect(missing).toBeNull();
  });
});
