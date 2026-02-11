// Integration test: verify recording payments updates invoice status
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
          } catch (e: any) {
            if (e.code === 'SQLITE_CONSTRAINT_UNIQUE' || e.message?.includes('UNIQUE constraint failed')) {
              throw e;
            }
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

import { DrizzleInvoiceRepository } from '../../src/infrastructure/repositories/DrizzleInvoiceRepository';
import { DrizzlePaymentRepository } from '../../src/infrastructure/repositories/DrizzlePaymentRepository';
import { InvoiceEntity } from '../../src/domain/entities/Invoice';
import { PaymentEntity } from '../../src/domain/entities/Payment';
import { RecordPaymentUseCase } from '../../src/application/usecases/payment/RecordPaymentUseCase';
import { closeDatabase } from '../../src/infrastructure/database/connection';

describe('RecordPaymentUseCase integration', () => {
  let invoiceRepo: DrizzleInvoiceRepository;
  let paymentRepo: DrizzlePaymentRepository;
  let uc: RecordPaymentUseCase;

  beforeEach(async () => {
    await closeDatabase();
    invoiceRepo = new DrizzleInvoiceRepository();
    paymentRepo = new DrizzlePaymentRepository();
    uc = new RecordPaymentUseCase(paymentRepo, invoiceRepo);
  });

  afterEach(async () => {
    await closeDatabase();
  });

  it('marks invoice as paid when payments equal total', async () => {
    const inv = InvoiceEntity.create({ total: 200 }).data();
    await invoiceRepo.createInvoice(inv);

    const p = PaymentEntity.create({ projectId: inv.projectId ?? 'p', invoiceId: inv.id, amount: 200 }).data();
    await uc.execute(p);

    const updated = await invoiceRepo.getInvoice(inv.id);
    expect(updated).toBeDefined();
    expect(updated?.paymentStatus).toBe('paid');
    expect(updated?.status).toBe('paid');
  });

  it('marks invoice as partial when payments are less than total', async () => {
    const inv = InvoiceEntity.create({ total: 500 }).data();
    await invoiceRepo.createInvoice(inv);

    const p = PaymentEntity.create({ projectId: inv.projectId ?? 'p', invoiceId: inv.id, amount: 200 }).data();
    await uc.execute(p);

    const updated = await invoiceRepo.getInvoice(inv.id);
    expect(updated).toBeDefined();
    expect(updated?.paymentStatus).toBe('partial');
    expect(updated?.status).not.toBe('paid');
  });
});
