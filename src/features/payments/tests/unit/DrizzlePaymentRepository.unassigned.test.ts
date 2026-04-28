/**
 * T-14, T-15: DrizzlePaymentRepository — noProject filter
 * Tests that list({ noProject: true }) returns only payments with project_id IS NULL.
 *
 * Uses the better-sqlite3 in-memory mock (same pattern as integration tests).
 */

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
          const prepared = db.prepare(stmt);
          prepared.run(...params);
          return [{ rows: { length: 0, item: (_: number) => undefined } }];
        }

        if (stmt) db.exec(stmt);
        return [{ rows: { length: 0, item: (_: number) => undefined } }];
      },
      transaction: async (fn: any) => {
        db.exec('BEGIN');
        try {
          const tx = {
            executeSql: (sql: string, ps?: any[]) => createAdapter(db).executeSql(sql, ps),
          };
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

import { DrizzlePaymentRepository } from '../../infrastructure/DrizzlePaymentRepository';
import { initDatabase, closeDatabase } from '../../../../infrastructure/database/connection';

describe('DrizzlePaymentRepository — noProject filter (T-14, T-15)', () => {
  let repo: DrizzlePaymentRepository;

  beforeEach(async () => {
    await closeDatabase();
    repo = new DrizzlePaymentRepository();

    const { db } = await initDatabase();
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        invoice_id TEXT,
        amount REAL,
        currency TEXT,
        payment_date INTEGER,
        due_date INTEGER,
        status TEXT,
        payment_method TEXT,
        reference TEXT,
        notes TEXT,
        contact_id TEXT,
        contractor_name TEXT,
        payment_category TEXT DEFAULT 'other',
        stage_label TEXT,
        created_at INTEGER,
        updated_at INTEGER
      )
    `);
  });

  afterEach(async () => {
    await closeDatabase();
  });

  it('T-14: returns only payments with project_id IS NULL when noProject:true', async () => {
    const now = Date.now();
    const { db } = await initDatabase();
    // Payment with project
    await db.executeSql(
      `INSERT INTO payments (id, project_id, amount, status, contractor_name, payment_category, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['p-with-proj', 'proj-1', 500, 'pending', 'Alice', 'other', now, now],
    );
    // Payment without project
    await db.executeSql(
      `INSERT INTO payments (id, project_id, amount, status, contractor_name, payment_category, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['p-no-proj', null, 200, 'pending', 'Bob', 'other', now - 1000, now],
    );

    const result = await repo.list({ allProjects: true, noProject: true });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('p-no-proj');
  });

  it('T-15: combines noProject:true with contractorSearch', async () => {
    const now = Date.now();
    const { db } = await initDatabase();
    // Bob, no project
    await db.executeSql(
      `INSERT INTO payments (id, project_id, amount, status, contractor_name, payment_category, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['bob-no-proj', null, 100, 'pending', 'Bob Smith', 'other', now, now],
    );
    // Alice, no project
    await db.executeSql(
      `INSERT INTO payments (id, project_id, amount, status, contractor_name, payment_category, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['alice-no-proj', null, 200, 'pending', 'Alice Jones', 'other', now - 1000, now],
    );
    // Bob, with project
    await db.executeSql(
      `INSERT INTO payments (id, project_id, amount, status, contractor_name, payment_category, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ['bob-with-proj', 'proj-1', 300, 'pending', 'Bob Smith', 'other', now - 2000, now],
    );

    const result = await repo.list({
      allProjects: true,
      noProject: true,
      contractorSearch: 'Bob',
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('bob-no-proj');
  });
});
