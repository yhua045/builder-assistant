// Mock react-native-sqlite-storage with a small adapter backed by better-sqlite3 (:memory:)
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
          try {
            const prepared = db.prepare(stmt);
            prepared.run(...params);
            return [ { rows: { length: 0, item: (_: number) => undefined } } ];
          } catch (e) {
            // fallthrough to exec
          }
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

import { initDatabase, closeDatabase, getDatabase } from '../../src/infrastructure/database/connection';
import { DrizzleReceiptRepository } from '../../src/infrastructure/repositories/DrizzleReceiptRepository';
import { InvoiceEntity } from '../../src/domain/entities/Invoice';
import { PaymentEntity } from '../../src/domain/entities/Payment';

describe('DrizzleReceiptRepository transaction behavior', () => {
  beforeAll(async () => {
    await initDatabase();
  });

  afterAll(async () => {
    await closeDatabase();
  });

  test('createReceipt rolls back on simulated failure (no partial inserts)', async () => {
    const repo = new DrizzleReceiptRepository();

    const invoice = InvoiceEntity.create({
      total: 100,
      externalReference: 'sim-ref-rollback-1',
      metadata: { simulateFailure: true },
    }).data();

    const payment = PaymentEntity.create({
      amount: 100,
      invoiceId: invoice.id,
    }).data();

    await expect(repo.createReceipt(invoice, payment)).rejects.toThrow('SIMULATE_FAIL');

    const { db } = getDatabase();
    const [invRes] = await db.executeSql('SELECT COUNT(*) as c FROM invoices WHERE external_reference = ?', [invoice.externalReference]);
    const invCount = invRes.rows.item(0).c;
    expect(invCount).toBe(0);

    const [payRes] = await db.executeSql('SELECT COUNT(*) as c FROM payments WHERE invoice_id = ?', [invoice.id]);
    const payCount = payRes.rows.item(0).c;
    expect(payCount).toBe(0);
  });
});
