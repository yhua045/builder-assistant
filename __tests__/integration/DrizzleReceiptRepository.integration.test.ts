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

  test('createReceipt succeeds and persists invoice and payment', async () => {
    const repo = new DrizzleReceiptRepository();

    const invoice = InvoiceEntity.create({
      total: 200,
      externalReference: 'happy-path-1',
      metadata: {},
    }).data();

    const payment = PaymentEntity.create({
      id: `testpay_${Date.now()}`,
      projectId: 'proj_test_1',
      amount: 200,
      invoiceId: invoice.id,
    }).data();

    let res: any;
    res = await repo.createReceipt(invoice, payment);

    expect(res).toBeDefined();
    expect(res.invoice && res.invoice.id).toBeDefined();
    expect(res.payment && res.payment.id).toBeDefined();

    const { db } = getDatabase();
    const [invRes] = await db.executeSql('SELECT COUNT(*) as c FROM invoices WHERE external_reference = ?', [invoice.externalReference]);
    const invCount = invRes.rows.item(0).c;
    expect(invCount).toBeGreaterThanOrEqual(1);

    const [payRes] = await db.executeSql('SELECT COUNT(*) as c FROM payments WHERE invoice_id = ?', [invoice.id]);
    const payCount = payRes.rows.item(0).c;
    expect(payCount).toBeGreaterThanOrEqual(1);
  });
});

describe('DrizzleReceiptRepository — project aggregate updates', () => {
  const PROJECT_ID = 'proj_aggregate_test';

  beforeAll(async () => {
    await initDatabase();
    const { db } = getDatabase();
    // Seed a project row used in aggregate tests
    await db.executeSql(
      `INSERT OR IGNORE INTO projects (id, name, status, total_payments, pending_payments, created_at, updated_at)
       VALUES (?, ?, ?, 0, 0, ?, ?)`,
      [PROJECT_ID, 'Aggregate Test Project', 'planning', Date.now(), Date.now()]
    );
  });

  afterAll(async () => {
    await closeDatabase();
  });

  test('createReceipt increments total_payments on the linked project', async () => {
    const repo = new DrizzleReceiptRepository();
    const { db } = getDatabase();

    // Read baseline
    const [before] = await db.executeSql('SELECT total_payments FROM projects WHERE id = ?', [PROJECT_ID]);
    const baseTotal: number = before.rows.item(0).total_payments ?? 0;

    const invoice = InvoiceEntity.create({
      total: 300,
      projectId: PROJECT_ID,
    }).data();

    const payment = PaymentEntity.create({
      amount: 300,
      invoiceId: invoice.id,
      projectId: PROJECT_ID,
    }).data();

    await repo.createReceipt(invoice, payment);

    const [after] = await db.executeSql('SELECT total_payments FROM projects WHERE id = ?', [PROJECT_ID]);
    const newTotal: number = after.rows.item(0).total_payments;
    expect(newTotal).toBeCloseTo(baseTotal + 300, 5);
  });

  test('createUnpaidInvoice inserts invoice with status issued/unpaid and increments pending_payments', async () => {
    const repo = new DrizzleReceiptRepository();
    const { db } = getDatabase();

    // Read baseline
    const [before] = await db.executeSql('SELECT pending_payments FROM projects WHERE id = ?', [PROJECT_ID]);
    const basePending: number = before.rows.item(0).pending_payments ?? 0;

    const invoice = InvoiceEntity.create({
      total: 500,
      projectId: PROJECT_ID,
      status: 'issued',
      paymentStatus: 'unpaid',
    }).data();

    const result = await repo.createUnpaidInvoice(invoice);

    expect(result.status).toBe('issued');
    expect(result.paymentStatus).toBe('unpaid');

    const [invRes] = await db.executeSql('SELECT status, payment_status FROM invoices WHERE id = ?', [invoice.id]);
    expect(invRes.rows.length).toBe(1);
    expect(invRes.rows.item(0).status).toBe('issued');
    expect(invRes.rows.item(0).payment_status).toBe('unpaid');

    const [after] = await db.executeSql('SELECT pending_payments FROM projects WHERE id = ?', [PROJECT_ID]);
    const newPending: number = after.rows.item(0).pending_payments;
    expect(newPending).toBeCloseTo(basePending + 500, 5);
  });

  test('createUnpaidInvoice rolls back on simulated failure — project pending_payments unchanged', async () => {
    const repo = new DrizzleReceiptRepository();
    const { db } = getDatabase();

    const [before] = await db.executeSql('SELECT pending_payments FROM projects WHERE id = ?', [PROJECT_ID]);
    const basePending: number = before.rows.item(0).pending_payments ?? 0;

    const invoice = InvoiceEntity.create({
      total: 999,
      projectId: PROJECT_ID,
      metadata: { simulateFailure: true },
    }).data();

    await expect(repo.createUnpaidInvoice(invoice)).rejects.toThrow('SIMULATE_FAIL');

    const [after] = await db.executeSql('SELECT pending_payments FROM projects WHERE id = ?', [PROJECT_ID]);
    const newPending: number = after.rows.item(0).pending_payments;
    expect(newPending).toBe(basePending);

    // Invoice row must not be persisted
    const [invRes] = await db.executeSql('SELECT COUNT(*) as c FROM invoices WHERE id = ?', [invoice.id]);
    expect(invRes.rows.item(0).c).toBe(0);
  });
});
