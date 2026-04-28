jest.mock('react-native-sqlite-storage', () => {
  function createAdapter(db: any) {
    return {
      executeSql: async (sql: string, params: any[] = []) => {
        const stmt = sql.trim();
        const upper = stmt.toUpperCase();

        if (upper.startsWith('SELECT')) {
          const rows = db.prepare(stmt).all(...params);
          return [ { rows: { length: rows.length, item: (i: number) => rows[i] } } ];
        }

        if (params && params.length > 0) {
          const prepared = db.prepare(stmt);
          prepared.run(...params);
          return [ { rows: { length: 0, item: (_: number) => undefined } } ];
        }

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
      const BetterSqlite3 = require('better-sqlite3');
      const db = new BetterSqlite3(':memory:');
      return createAdapter(db);
    }
  };
});

import { DrizzlePaymentRepository } from '../../infrastructure/DrizzlePaymentRepository';
import { PaymentEntity } from '../../../../domain/entities/Payment';
import { initDatabase, closeDatabase } from '../../../../infrastructure/database/connection';

describe('DrizzlePaymentRepository integration', () => {
  let repo: DrizzlePaymentRepository;

  beforeEach(async () => {
    await closeDatabase();
    repo = new DrizzlePaymentRepository();
  });

  beforeEach(async () => {
    // Ensure payments table exists with required columns for this integration test
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
        created_at INTEGER,
        updated_at INTEGER
      )
    `);
    try {
      await db.executeSql('ALTER TABLE payments ADD COLUMN due_date INTEGER');
    } catch (_) {}
    try {
      await db.executeSql("ALTER TABLE payments ADD COLUMN status TEXT");
    } catch (_) {}
  });

  afterEach(async () => {
    await closeDatabase();
  });

  it('list returns upcoming payments within date range', async () => {
    const now = new Date('2026-02-13T00:00:00.000Z');

    const p1 = PaymentEntity.create({ projectId: 'proj1', invoiceId: 'i1', amount: 100, status: 'pending', dueDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString() }).data();
    const p2 = PaymentEntity.create({ projectId: 'proj1', invoiceId: 'i2', amount: 50, status: 'pending', dueDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString() }).data();
    const p3 = PaymentEntity.create({ projectId: 'proj1', invoiceId: 'i3', amount: 75, status: 'settled', date: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString() }).data();

    expect(p1.id).toBeDefined();
    await repo.save(p1);
    await repo.save(p2);
    await repo.save(p3);

    const listUpcoming = await repo.list({ status: 'pending', fromDate: now.toISOString(), toDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString() });
    expect(listUpcoming.items.some((p) => p.id === p1.id)).toBe(true);
  });

  it('getMetrics computes pending total and overdue count', async () => {
    const now = new Date('2026-02-13T00:00:00.000Z');

    const p1 = PaymentEntity.create({ projectId: 'proj1', invoiceId: 'i1', amount: 100, status: 'pending', dueDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString() }).data();
    const p2 = PaymentEntity.create({ projectId: 'proj1', invoiceId: 'i2', amount: 50, status: 'pending', dueDate: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString() }).data();
    const p3 = PaymentEntity.create({ projectId: 'proj1', invoiceId: 'i3', amount: 75, status: 'settled', date: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString() }).data();

    await repo.save(p1);
    await repo.save(p2);
    await repo.save(p3);

    const metrics = await repo.getMetrics();
    expect(metrics.pendingTotalNext7Days).toBeGreaterThanOrEqual(100);
    expect(metrics.overdueCount).toBeGreaterThanOrEqual(1);
  });
});
