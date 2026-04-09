// AC-12: Full flow integration test — pending payment on accepted-quotation invoice
// → CompleteTaskAndSettlePaymentsUseCase → task completed and payment settled in SQLite

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
          } catch (_e) {
            // fallthrough to exec
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

import { CompleteTaskAndSettlePaymentsUseCase } from '../../src/application/usecases/task/CompleteTaskAndSettlePaymentsUseCase';
import { DrizzleTaskRepository } from '../../src/infrastructure/repositories/DrizzleTaskRepository';
import { DrizzlePaymentRepository } from '../../src/infrastructure/repositories/DrizzlePaymentRepository';
import { DrizzleInvoiceRepository } from '../../src/infrastructure/repositories/DrizzleInvoiceRepository';
import { DrizzleQuotationRepository } from '../../src/infrastructure/repositories/DrizzleQuotationRepository';
import { TaskEntity } from '../../src/domain/entities/Task';
import { PaymentEntity } from '../../src/domain/entities/Payment';
import { InvoiceEntity } from '../../src/domain/entities/Invoice';
import { closeDatabase, initDatabase } from '../../src/infrastructure/database/connection';

describe('CompleteTaskAndSettlePaymentsUseCase integration (better-sqlite3 :memory:)', () => {
  let taskRepo: DrizzleTaskRepository;
  let paymentRepo: DrizzlePaymentRepository;
  let invoiceRepo: DrizzleInvoiceRepository;
  let quotationRepo: DrizzleQuotationRepository;
  let useCase: CompleteTaskAndSettlePaymentsUseCase;

  beforeEach(async () => {
    await closeDatabase();
    taskRepo = new DrizzleTaskRepository();
    paymentRepo = new DrizzlePaymentRepository();
    invoiceRepo = new DrizzleInvoiceRepository();
    quotationRepo = new DrizzleQuotationRepository();
    useCase = new CompleteTaskAndSettlePaymentsUseCase(
      taskRepo,
      paymentRepo,
      invoiceRepo,
      quotationRepo,
    );
  });

  afterEach(async () => {
    await closeDatabase();
  });

  function makeTask(overrides: Record<string, unknown> = {}) {
    return TaskEntity.create({
      title: 'Test Task',
      status: 'in_progress',
      projectId: 'proj-1',
      ...overrides,
    } as any).data();
  }

  function makePayment(overrides: Record<string, unknown> = {}) {
    return PaymentEntity.create({
      amount: 1000,
      status: 'pending',
      invoiceId: 'inv-1',
      contractorName: 'Bob Builder',
      ...overrides,
    } as any).data();
  }

  function makeInvoice(overrides: Record<string, unknown> = {}) {
    return InvoiceEntity.create({
      projectId: 'proj-1',
      vendorName: 'Bob Builder',
      total: 1000,
      status: 'issued',
      ...overrides,
    } as any).data();
  }

  // Ensure payments table columns exist (some may be missing from minimal migration)
  async function ensurePaymentColumns() {
    const { db } = await initDatabase();
    const alterColumns = [
      'ALTER TABLE payments ADD COLUMN contractor_name TEXT',
      'ALTER TABLE payments ADD COLUMN payment_category TEXT',
      'ALTER TABLE payments ADD COLUMN stage_label TEXT',
    ];
    for (const sql of alterColumns) {
      try { await db.executeSql(sql); } catch { /* column already exists */ }
    }
  }

  // AC-12: full flow — pending payment → settle → task completed
  it('settles pending payments and marks task as completed in SQLite', async () => {
    await ensurePaymentColumns();

    const invoice = makeInvoice({ id: 'inv-1' });
    await invoiceRepo.createInvoice(invoice);

    const task = makeTask({ quoteInvoiceId: 'inv-1' });
    await taskRepo.save(task);

    const payment = makePayment({ invoiceId: 'inv-1', projectId: 'proj-1', status: 'pending' });
    await paymentRepo.save(payment);

    await useCase.execute(task.id);

    // Payment should now be settled
    const updatedPayment = await paymentRepo.findById(payment.id);
    expect(updatedPayment?.status).toBe('settled');

    // Task should be completed
    const updatedTask = await taskRepo.findById(task.id);
    expect(updatedTask?.status).toBe('completed');
    expect(updatedTask?.completedAt).toBeDefined();
  });

  // AC-12 variant: task without quoteInvoiceId completes directly
  it('completes task directly when no quoteInvoiceId is set', async () => {
    await ensurePaymentColumns();

    const task = makeTask({ quoteInvoiceId: undefined });
    await taskRepo.save(task);

    await useCase.execute(task.id);

    const updatedTask = await taskRepo.findById(task.id);
    expect(updatedTask?.status).toBe('completed');
  });
});
