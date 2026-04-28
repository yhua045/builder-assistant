/**
 * Integration test: LinkPaymentToProjectUseCase — persistence round-trip
 *
 * Verifies that:
 *  ✓ Linking a pending payment to a project persists the projectId in SQLite
 *  ✓ Clearing the project (undefined) removes the projectId from the DB
 *  ✗ Attempting to link a settled payment is rejected with PaymentNotPendingError
 *
 * Uses an in-memory better-sqlite3 adapter to exercise the full
 * DrizzlePaymentRepository → SQLite stack without touching the file system.
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
import { PaymentEntity } from '../../../../domain/entities/Payment';
import { LinkPaymentToProjectUseCase } from '../../application/LinkPaymentToProjectUseCase';
import { PaymentNotPendingError } from '../../application/PaymentErrors';
import { closeDatabase, initDatabase } from '../../../../infrastructure/database/connection';

describe('LinkPaymentToProjectUseCase integration', () => {
  let paymentRepo: DrizzlePaymentRepository;
  let useCase: LinkPaymentToProjectUseCase;

  beforeEach(async () => {
    await closeDatabase();
    paymentRepo = new DrizzlePaymentRepository();
    useCase = new LinkPaymentToProjectUseCase(paymentRepo);

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
        contractor_name TEXT,
        payment_category TEXT,
        stage_label TEXT,
        created_at INTEGER,
        updated_at INTEGER
      )
    `);
  });

  afterEach(async () => {
    await closeDatabase();
  });

  it('persists projectId after linking a pending payment to a project', async () => {
    const payment = PaymentEntity.create({
      amount: 500,
      status: 'pending',
    }).data();
    await paymentRepo.save(payment);

    await useCase.execute({ paymentId: payment.id, projectId: 'proj_abc' });

    const stored = await paymentRepo.findById(payment.id);
    expect(stored?.projectId).toBe('proj_abc');
  });

  it('clears projectId when linking with undefined', async () => {
    const payment = PaymentEntity.create({
      amount: 500,
      status: 'pending',
      projectId: 'proj_abc',
    }).data();
    await paymentRepo.save(payment);

    await useCase.execute({ paymentId: payment.id, projectId: undefined });

    const stored = await paymentRepo.findById(payment.id);
    expect(stored?.projectId ?? null).toBeNull();
  });

  it('throws PaymentNotPendingError for a settled payment', async () => {
    const payment = PaymentEntity.create({
      amount: 500,
      status: 'settled',
    }).data();
    await paymentRepo.save(payment);

    await expect(
      useCase.execute({ paymentId: payment.id, projectId: 'proj_abc' }),
    ).rejects.toThrow(PaymentNotPendingError);

    // projectId must remain unchanged
    const stored = await paymentRepo.findById(payment.id);
    expect(stored?.projectId ?? null).toBeNull();
  });
});
