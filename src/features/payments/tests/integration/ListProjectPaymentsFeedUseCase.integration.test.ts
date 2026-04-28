/**
 * Integration tests for ListProjectPaymentsFeedUseCase
 *
 * Uses in-memory better-sqlite3 via the same react-native-sqlite-storage mock
 * pattern used across other integration tests in this project.
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
          try {
            const prepared = db.prepare(stmt);
            prepared.run(...params);
            return [{ rows: { length: 0, item: (_: number) => undefined } }];
          } catch (e: any) {
            if (
              e.code === 'SQLITE_CONSTRAINT_UNIQUE' ||
              e.message?.includes('UNIQUE constraint failed')
            ) {
              throw e;
            }
          }
        }

        if (stmt) db.exec(stmt);
        return [{ rows: { length: 0, item: (_: number) => undefined } }];
      },
      transaction: async (fn: any) => {
        db.exec('BEGIN');
        try {
          const tx = {
            executeSql: (sql: string, params?: any[]) =>
              createAdapter(db).executeSql(sql, params),
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
import { DrizzleInvoiceRepository } from '../../../../features/invoices/infrastructure/DrizzleInvoiceRepository';
import { PaymentEntity } from '../../../../domain/entities/Payment';
import { InvoiceEntity } from '../../../../domain/entities/Invoice';
import { ListProjectPaymentsFeedUseCase } from '../../application/ListProjectPaymentsFeedUseCase';
import { closeDatabase } from '../../../../infrastructure/database/connection';

describe('ListProjectPaymentsFeedUseCase integration', () => {
  let paymentRepo: DrizzlePaymentRepository;
  let invoiceRepo: DrizzleInvoiceRepository;
  let useCase: ListProjectPaymentsFeedUseCase;

  beforeEach(async () => {
    await closeDatabase();
    paymentRepo = new DrizzlePaymentRepository();
    invoiceRepo = new DrizzleInvoiceRepository();
    useCase = new ListProjectPaymentsFeedUseCase(paymentRepo, invoiceRepo);
  });

  afterEach(async () => {
    await closeDatabase();
  });

  // F1: 1 unlinked payment + 1 unpaid invoice → 2 items
  it('F1: returns unlinked payment and invoice as 2 feed items', async () => {
    const projectId = 'proj-f1';

    const payment = PaymentEntity.create({
      projectId,
      amount: 1500,
      status: 'settled',
      // no invoiceId → unlinked
    }).data();
    await paymentRepo.save(payment);

    const invoice = InvoiceEntity.create({
      projectId,
      total: 3000,
    }).data();
    await invoiceRepo.createInvoice(invoice);

    const result = await useCase.execute(projectId);

    expect(result.items).toHaveLength(2);
    expect(result.truncated).toBe(false);

    const kinds = result.items.map((i) => i.kind).sort();
    expect(kinds).toEqual(['invoice', 'payment']);
  });

  // F2: paid invoice + linked payment → only invoice item returned (payment excluded)
  it('F2: excludes linked payments; returns only the invoice item', async () => {
    const projectId = 'proj-f2';

    const invoice = InvoiceEntity.create({
      projectId,
      total: 5000,
      status: 'paid',
      paymentStatus: 'paid',
    }).data();
    await invoiceRepo.createInvoice(invoice);

    // This payment IS linked to the invoice
    const linkedPayment = PaymentEntity.create({
      projectId,
      invoiceId: invoice.id,
      amount: 5000,
      status: 'settled',
    }).data();
    await paymentRepo.save(linkedPayment);

    const result = await useCase.execute(projectId);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].kind).toBe('invoice');
  });

  // F3: invoices from a different project must not appear
  it('F3: excludes invoices from other projects', async () => {
    const projectId = 'proj-f3';
    const otherProjectId = 'proj-other';

    const myInvoice = InvoiceEntity.create({ projectId, total: 100 }).data();
    const otherInvoice = InvoiceEntity.create({ projectId: otherProjectId, total: 9999 }).data();

    await invoiceRepo.createInvoice(myInvoice);
    await invoiceRepo.createInvoice(otherInvoice);

    const result = await useCase.execute(projectId);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].kind).toBe('invoice');
    if (result.items[0].kind === 'invoice') {
      expect(result.items[0].data.id).toBe(myInvoice.id);
    }
  }, 30_000);
});
