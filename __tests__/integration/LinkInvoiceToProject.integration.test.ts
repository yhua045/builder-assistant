/**
 * Integration test: LinkInvoiceToProjectUseCase — persistence round-trip
 *
 * Verifies that:
 *  ✓ Linking an unpaid invoice to a project persists the projectId in SQLite
 *  ✓ Clearing the project (undefined) removes the projectId from the DB
 *  ✗ Attempting to link a cancelled invoice is rejected with InvoiceNotEditableError
 *  ✗ Attempting to link a paid invoice is rejected with InvoiceNotEditableError
 *
 * Uses an in-memory better-sqlite3 adapter to exercise the full
 * DrizzleInvoiceRepository → SQLite stack without touching the file system.
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

import { DrizzleInvoiceRepository } from '../../src/infrastructure/repositories/DrizzleInvoiceRepository';
import { InvoiceEntity } from '../../src/domain/entities/Invoice';
import { LinkInvoiceToProjectUseCase } from '../../src/application/usecases/invoice/LinkInvoiceToProjectUseCase';
import { InvoiceNotEditableError } from '../../src/application/errors/PaymentErrors';
import { closeDatabase } from '../../src/infrastructure/database/connection';

describe('LinkInvoiceToProjectUseCase integration', () => {
  let invoiceRepo: DrizzleInvoiceRepository;
  let useCase: LinkInvoiceToProjectUseCase;

  beforeEach(async () => {
    await closeDatabase();
    invoiceRepo = new DrizzleInvoiceRepository();
    useCase = new LinkInvoiceToProjectUseCase(invoiceRepo);
  });

  afterEach(async () => {
    await closeDatabase();
  });

  it('persists projectId after linking an unpaid invoice to a project', async () => {
    const invoice = InvoiceEntity.create({
      total: 1000,
      status: 'issued',
      paymentStatus: 'unpaid',
    }).data();
    await invoiceRepo.createInvoice(invoice);

    await useCase.execute({ invoiceId: invoice.id, projectId: 'proj_xyz' });

    const stored = await invoiceRepo.getInvoice(invoice.id);
    expect(stored?.projectId).toBe('proj_xyz');
  });

  it('clears projectId when linking with undefined', async () => {
    const invoice = InvoiceEntity.create({
      total: 1000,
      status: 'issued',
      paymentStatus: 'unpaid',
      projectId: 'proj_xyz',
    }).data();
    await invoiceRepo.createInvoice(invoice);

    await useCase.execute({ invoiceId: invoice.id, projectId: undefined });

    const stored = await invoiceRepo.getInvoice(invoice.id);
    expect(stored?.projectId ?? null).toBeNull();
  });

  it('throws InvoiceNotEditableError for a cancelled invoice', async () => {
    const invoice = InvoiceEntity.create({
      total: 1000,
      status: 'cancelled',
      paymentStatus: 'unpaid',
    }).data();
    await invoiceRepo.createInvoice(invoice);

    await expect(
      useCase.execute({ invoiceId: invoice.id, projectId: 'proj_xyz' }),
    ).rejects.toThrow(InvoiceNotEditableError);

    // projectId must remain unchanged
    const stored = await invoiceRepo.getInvoice(invoice.id);
    expect(stored?.projectId ?? null).toBeNull();
  });

  it('throws InvoiceNotEditableError when invoice paymentStatus is paid', async () => {
    const invoice = InvoiceEntity.create({
      total: 1000,
      status: 'paid',
      paymentStatus: 'paid',
    }).data();
    await invoiceRepo.createInvoice(invoice);

    await expect(
      useCase.execute({ invoiceId: invoice.id, projectId: 'proj_xyz' }),
    ).rejects.toThrow(InvoiceNotEditableError);
  });
});
