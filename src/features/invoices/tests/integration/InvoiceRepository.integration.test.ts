
// Mock react-native-sqlite-storage with a small adapter backed by better-sqlite3 (:memory:)
jest.mock('react-native-sqlite-storage', () => {
  function createAdapter(db: any) {
    return {
      executeSql: async (sql: string, params: any[] = []) => {
        const stmt = sql.trim();
        const upper = stmt.toUpperCase();

        // Run SELECT queries and return rows
        if (upper.startsWith('SELECT')) {
          const rows = db.prepare(stmt).all(...params);
          return [ { rows: { length: rows.length, item: (i: number) => rows[i] } } ];
        }

        // If params are provided, use a prepared statement
        if (params && params.length > 0) {
          try {
            const prepared = db.prepare(stmt);
            prepared.run(...params);
            return [ { rows: { length: 0, item: (_: number) => undefined } } ];
          } catch (e: any) {
            // If it's a constraint error, rethrow it so we can test validations
            if (e.code === 'SQLITE_CONSTRAINT_UNIQUE' || e.message?.includes('UNIQUE constraint failed')) {
               throw e;
            }
            // fallthrough to exec for other cases (maybe DDL with params?)
          }
        }

        // No params or prepared failed: try exec (for DDL or simple statements)
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

import { DrizzleInvoiceRepository } from '../../infrastructure/DrizzleInvoiceRepository';
import { InvoiceEntity } from '../../../../domain/entities/Invoice';
import { closeDatabase } from '../../../../infrastructure/database/connection';

describe('DrizzleInvoiceRepository', () => {
  let repo: DrizzleInvoiceRepository;

  beforeEach(async () => {
    await closeDatabase(); // ensure fresh mock db
    repo = new DrizzleInvoiceRepository();
  });

  afterEach(async () => {
    await closeDatabase();
  });

  it('creates and retrieves an invoice', async () => {
    const invoice = InvoiceEntity.create({
      externalId: 'ext-1',
      externalReference: 'ref-1',
      total: 100,
      projectId: 'proj-1'
    }).data();

    await repo.createInvoice(invoice);
    
    const retrieved = await repo.getInvoice(invoice.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(invoice.id);
    expect(retrieved?.externalId).toBe('ext-1');
    expect(retrieved?.total).toBe(100);
  });

  it('allows invoices without external keys', async () => {
    const invoice = InvoiceEntity.create({
      total: 120,
      projectId: 'proj-optional'
    }).data();

    await expect(repo.createInvoice(invoice)).resolves.toBeDefined();

    const retrieved = await repo.getInvoice(invoice.id);
    expect(retrieved).toBeDefined();
    expect(retrieved?.externalId).toBeUndefined();
    // externalReference is now auto-generated if left blank by InvoiceEntity.create
    expect(retrieved?.externalReference).toMatch(/^INV-/);
  });

  it('does not enforce uniqueness when external keys are missing', async () => {
    const inv1 = InvoiceEntity.create({
      externalId: 'ext-only',
      total: 110
    }).data();

    const inv2 = InvoiceEntity.create({
      externalId: 'ext-only',
      total: 210
    }).data();

    await repo.createInvoice(inv1);
    await expect(repo.createInvoice(inv2)).resolves.toBeDefined();
  });

  it('does not enforce uniqueness when external keys are empty strings', async () => {
    const inv1 = InvoiceEntity.create({
      externalId: '',
      externalReference: '',
      total: 130
    }).data();

    const inv2 = InvoiceEntity.create({
      externalId: '',
      externalReference: '',
      total: 230
    }).data();

    await repo.createInvoice(inv1);
    await expect(repo.createInvoice(inv2)).resolves.toBeDefined();
  });

  it('enforces uniqueness on externalId + externalReference', async () => {
    const inv1 = InvoiceEntity.create({
      externalId: 'ext-unique',
      externalReference: 'ref-unique',
      total: 100
    }).data();

    const inv2 = InvoiceEntity.create({
      externalId: 'ext-unique',
      externalReference: 'ref-unique',
      total: 200
    }).data();

    await repo.createInvoice(inv1);

    // Expect failure on second insert
    await expect(repo.createInvoice(inv2)).rejects.toThrow();
  });

  it('finds by external key', async () => {
    const inv = InvoiceEntity.create({
      externalId: 'ext-find',
      externalReference: 'ref-find',
      total: 300
    }).data();
    
    await repo.createInvoice(inv);

    const found = await repo.findByExternalKey('ext-find', 'ref-find');
    expect(found).toBeDefined();
    expect(found?.id).toBe(inv.id);

    const notFound = await repo.findByExternalKey('ext-find', 'ref-other');
    expect(notFound).toBeNull();
  });

  it('lists invoices with filters', async () => {
    const inv1 = InvoiceEntity.create({ externalId: 'A', externalReference: '1', status: 'draft', total: 10 }).data();
    const inv2 = InvoiceEntity.create({ externalId: 'A', externalReference: '2', status: 'paid', total: 20 }).data();
    const inv3 = InvoiceEntity.create({ externalId: 'B', externalReference: '1', status: 'draft', total: 30 }).data(); // soft deleted later

    await repo.createInvoice(inv1);
    await repo.createInvoice(inv2);
    await repo.createInvoice(inv3);

    // Test status filter
    const drafts = await repo.listInvoices({ status: ['draft'] });
    expect(drafts.items.length).toBe(2);
    expect(drafts.total).toBe(2);

    // Test multiple status filter
    const draftsAndPaid = await repo.listInvoices({ status: ['draft', 'paid'] });
    expect(draftsAndPaid.items.length).toBe(3);
    expect(draftsAndPaid.total).toBe(3);

    // Test non-matching status filter
    const overdue = await repo.listInvoices({ status: ['overdue'] });
    expect(overdue.items.length).toBe(0);
    expect(overdue.total).toBe(0);

    // Soft delete inv3
    await repo.deleteInvoice(inv3.id);

    // Test listing excludes deleted
    const draftsAfterDelete = await repo.listInvoices({ status: ['draft'] });
    expect(draftsAfterDelete.items.length).toBe(1);
    expect(draftsAfterDelete.items[0].id).toBe(inv1.id);

    // Test total count decreased or handled correctly
    expect(draftsAfterDelete.total).toBe(1);
  });

  it('assigns project', async () => {
    const inv = InvoiceEntity.create({ externalId: 'C', externalReference: '1', total: 50 }).data();
    await repo.createInvoice(inv);
    expect(inv.projectId).toBeUndefined(); // or check DB

    await repo.assignProject(inv.id, 'proj-new');
    
    const updated = await repo.getInvoice(inv.id);
    expect(updated?.projectId).toBe('proj-new');
  });

  it('updates invoice fields', async () => {
    const inv = InvoiceEntity.create({ externalId: 'D', externalReference: '1', total: 50, status: 'draft' }).data();
    await repo.createInvoice(inv);

    await repo.updateInvoice(inv.id, { 
      status: 'paid', 
      paymentDate: new Date().toISOString() 
    });

    const updated = await repo.getInvoice(inv.id);
    expect(updated?.status).toBe('paid');
    expect(updated?.paymentDate).toBeDefined();
  });
});
