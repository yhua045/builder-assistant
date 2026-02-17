// Integration test: verify invoice-payment integration and automatic status updates
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
import { closeDatabase, initDatabase } from '../../src/infrastructure/database/connection';

describe('InvoicePayment Integration', () => {
  let invoiceRepo: DrizzleInvoiceRepository;
  let paymentRepo: DrizzlePaymentRepository;
  let recordPaymentUseCase: RecordPaymentUseCase;

  beforeEach(async () => {
    await closeDatabase();
    invoiceRepo = new DrizzleInvoiceRepository();
    paymentRepo = new DrizzlePaymentRepository();
    recordPaymentUseCase = new RecordPaymentUseCase(paymentRepo, invoiceRepo);
    
    // Ensure payments table exists with required columns
    const { db } = await initDatabase();
    await db.executeSql(`
      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        project_id TEXT,
        invoice_id TEXT,
        expense_id TEXT,
        contact_id TEXT,
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
    // Add columns if they don't exist (for existing test databases)
    try { await db.executeSql('ALTER TABLE payments ADD COLUMN due_date INTEGER'); } catch(_) {}
    try { await db.executeSql('ALTER TABLE payments ADD COLUMN status TEXT'); } catch(_) {}
  });

  afterEach(async () => {
    await closeDatabase();
  });

  describe('payment status updates', () => {
    it('updates invoice paymentStatus to "paid" when payment equals total', async () => {
      // Create an invoice with total of 1000
      const invoice = InvoiceEntity.create({
        total: 1000,
        status: 'issued',
        paymentStatus: 'unpaid',
      }).data();
      await invoiceRepo.createInvoice(invoice);

      // Record a payment for the full amount
      const payment = PaymentEntity.create({
        invoiceId: invoice.id,
        amount: 1000,
        projectId: 'proj_1',
      }).data();
      await recordPaymentUseCase.execute(payment);

      // Verify invoice status is updated
      const updatedInvoice = await invoiceRepo.getInvoice(invoice.id);
      expect(updatedInvoice).toBeDefined();
      expect(updatedInvoice!.paymentStatus).toBe('paid');
      expect(updatedInvoice!.status).toBe('paid');
      expect(updatedInvoice!.paymentDate).toBeDefined();
    });

    it('updates invoice paymentStatus to "partial" when payment is less than total', async () => {
      // Create an invoice with total of 1000
      const invoice = InvoiceEntity.create({
        total: 1000,
        status: 'issued',
        paymentStatus: 'unpaid',
      }).data();
      await invoiceRepo.createInvoice(invoice);

      // Record a partial payment
      const payment = PaymentEntity.create({
        invoiceId: invoice.id,
        amount: 400,
        projectId: 'proj_1',
      }).data();
      await recordPaymentUseCase.execute(payment);

      // Verify invoice paymentStatus is partial
      const updatedInvoice = await invoiceRepo.getInvoice(invoice.id);
      expect(updatedInvoice).toBeDefined();
      expect(updatedInvoice!.paymentStatus).toBe('partial');
      expect(updatedInvoice!.status).toBe('issued'); // Status should remain issued
    });

    it('handles multiple partial payments and marks as paid when total is reached', async () => {
      // Create an invoice with total of 1500
      const invoice = InvoiceEntity.create({
        total: 1500,
        status: 'issued',
        paymentStatus: 'unpaid',
      }).data();
      await invoiceRepo.createInvoice(invoice);

      // Record first partial payment (500)
      const payment1 = PaymentEntity.create({
        invoiceId: invoice.id,
        amount: 500,
        projectId: 'proj_1',
      }).data();
      await recordPaymentUseCase.execute(payment1);

      let updatedInvoice = await invoiceRepo.getInvoice(invoice.id);
      expect(updatedInvoice!.paymentStatus).toBe('partial');

      // Record second partial payment (500)
      const payment2 = PaymentEntity.create({
        invoiceId: invoice.id,
        amount: 500,
        projectId: 'proj_1',
      }).data();
      await recordPaymentUseCase.execute(payment2);

      updatedInvoice = await invoiceRepo.getInvoice(invoice.id);
      expect(updatedInvoice!.paymentStatus).toBe('partial');

      // Record final payment (500) to complete
      const payment3 = PaymentEntity.create({
        invoiceId: invoice.id,
        amount: 500,
        projectId: 'proj_1',
      }).data();
      await recordPaymentUseCase.execute(payment3);

      updatedInvoice = await invoiceRepo.getInvoice(invoice.id);
      expect(updatedInvoice!.paymentStatus).toBe('paid');
      expect(updatedInvoice!.status).toBe('paid');
    });

    it('handles overpayment (payment exceeds total)', async () => {
      // Create an invoice with total of 800
      const invoice = InvoiceEntity.create({
        total: 800,
        status: 'issued',
        paymentStatus: 'unpaid',
      }).data();
      await invoiceRepo.createInvoice(invoice);

      // Record a payment exceeding the total
      const payment = PaymentEntity.create({
        invoiceId: invoice.id,
        amount: 1000,
        projectId: 'proj_1',
      }).data();
      await recordPaymentUseCase.execute(payment);

      // Verify invoice is marked as paid
      const updatedInvoice = await invoiceRepo.getInvoice(invoice.id);
      expect(updatedInvoice).toBeDefined();
      expect(updatedInvoice!.paymentStatus).toBe('paid');
      expect(updatedInvoice!.status).toBe('paid');
    });

    it('keeps paymentStatus as "unpaid" when no payments are recorded', async () => {
      // Create an invoice
      const invoice = InvoiceEntity.create({
        total: 500,
        status: 'issued',
        paymentStatus: 'unpaid',
      }).data();
      await invoiceRepo.createInvoice(invoice);

      // Verify invoice remains unpaid
      const retrievedInvoice = await invoiceRepo.getInvoice(invoice.id);
      expect(retrievedInvoice).toBeDefined();
      expect(retrievedInvoice!.paymentStatus).toBe('unpaid');
      expect(retrievedInvoice!.status).toBe('issued');
    });
  });

  describe('edge cases', () => {
    it('handles payment with no invoice link gracefully', async () => {
      // Record a payment without an invoiceId
      const payment = PaymentEntity.create({
        amount: 300,
        projectId: 'proj_1',
      }).data();

      // Should not throw an error
      await expect(recordPaymentUseCase.execute(payment)).resolves.not.toThrow();
    });

    it('handles payment linked to non-existent invoice gracefully', async () => {
      // Record a payment with a non-existent invoiceId
      const payment = PaymentEntity.create({
        invoiceId: 'nonexistent_invoice',
        amount: 200,
        projectId: 'proj_1',
      }).data();

      // Should not throw an error
      await expect(recordPaymentUseCase.execute(payment)).resolves.not.toThrow();
    });

    it('correctly accumulates payments from multiple sources', async () => {
      // Create an invoice
      const invoice = InvoiceEntity.create({
        total: 1000,
        status: 'issued',
        paymentStatus: 'unpaid',
      }).data();
      await invoiceRepo.createInvoice(invoice);

      // Record payments with different methods
      const payment1 = PaymentEntity.create({
        invoiceId: invoice.id,
        amount: 400,
        projectId: 'proj_1',
        method: 'bank',
      }).data();
      await recordPaymentUseCase.execute(payment1);

      const payment2 = PaymentEntity.create({
        invoiceId: invoice.id,
        amount: 300,
        projectId: 'proj_1',
        method: 'cash',
      }).data();
      await recordPaymentUseCase.execute(payment2);

      const payment3 = PaymentEntity.create({
        invoiceId: invoice.id,
        amount: 300,
        projectId: 'proj_1',
        method: 'card',
      }).data();
      await recordPaymentUseCase.execute(payment3);

      // Verify all payments are accumulated correctly
      const updatedInvoice = await invoiceRepo.getInvoice(invoice.id);
      expect(updatedInvoice!.paymentStatus).toBe('paid');
      expect(updatedInvoice!.status).toBe('paid');

      // Verify all payments are stored
      const payments = await paymentRepo.findByInvoice(invoice.id);
      expect(payments.length).toBe(3);
    });
  });

  describe('status transitions', () => {
    it('transitions from "overdue" to "paid" when full payment is received', async () => {
      // Create an overdue invoice
      const invoice = InvoiceEntity.create({
        total: 600,
        status: 'overdue',
        paymentStatus: 'unpaid',
      }).data();
      await invoiceRepo.createInvoice(invoice);

      // Record full payment
      const payment = PaymentEntity.create({
        invoiceId: invoice.id,
        amount: 600,
        projectId: 'proj_1',
      }).data();
      await recordPaymentUseCase.execute(payment);

      // Verify transition to paid
      const updatedInvoice = await invoiceRepo.getInvoice(invoice.id);
      expect(updatedInvoice!.status).toBe('paid');
      expect(updatedInvoice!.paymentStatus).toBe('paid');
    });

    it('does not change status from "draft" when payment is received', async () => {
      // Create a draft invoice
      const invoice = InvoiceEntity.create({
        total: 700,
        status: 'draft',
        paymentStatus: 'unpaid',
      }).data();
      await invoiceRepo.createInvoice(invoice);

      // Record payment
      const payment = PaymentEntity.create({
        invoiceId: invoice.id,
        amount: 700,
        projectId: 'proj_1',
      }).data();
      await recordPaymentUseCase.execute(payment);

      // Verify paymentStatus is updated but status remains draft
      const updatedInvoice = await invoiceRepo.getInvoice(invoice.id);
      expect(updatedInvoice!.paymentStatus).toBe('paid');
      expect(updatedInvoice!.status).toBe('draft'); // Should remain draft
    });
  });
});
