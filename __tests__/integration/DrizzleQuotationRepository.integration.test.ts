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
          return [{ rows: { length: rows.length, item: (i: number) => rows[i] } }];
        }

        // If params are provided, use a prepared statement (handles placeholders)
        if (params && params.length > 0) {
          try {
            const prepared = db.prepare(stmt);
            prepared.run(...params);
            return [{ rows: { length: 0, item: (_: number) => undefined } }];
          } catch (e) {
            // fallthrough to exec
          }
        }

        // No params or prepared failed: try exec (for DDL or simple statements)
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
      // require inside factory to satisfy Jest's mock factory constraints
      const BetterSqlite3 = require('better-sqlite3');
      const db = new BetterSqlite3(':memory:');
      return createAdapter(db);
    },
  };
});

import { DrizzleQuotationRepository } from '../../src/infrastructure/repositories/DrizzleQuotationRepository';
import { QuotationEntity } from '../../src/domain/entities/Quotation';
import { closeDatabase } from '../../src/infrastructure/database/connection';

describe('DrizzleQuotationRepository integration (better-sqlite3 :memory:)', () => {
  let repo: DrizzleQuotationRepository;

  beforeEach(() => {
    repo = new DrizzleQuotationRepository();
  });

  afterEach(async () => {
    await closeDatabase();
  });

  it('creates and retrieves a quotation', async () => {
    const quotationEntity = QuotationEntity.create({
      reference: 'QT-2026-001',
      date: '2026-01-15',
      total: 1500.0,
      currency: 'USD',
      vendorName: 'ABC Supplies',
      notes: 'Test quotation',
    });

    const quotation = quotationEntity.data();
    await repo.createQuotation(quotation);

    const retrieved = await repo.getQuotation(quotation.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.reference).toBe('QT-2026-001');
    expect(retrieved!.total).toBe(1500.0);
    expect(retrieved!.vendorName).toBe('ABC Supplies');
    expect(retrieved!.status).toBe('draft');
  });

  it('creates quotation with line items', async () => {
    const quotationEntity = QuotationEntity.create({
      reference: 'QT-2026-002',
      date: '2026-01-15',
      total: 850,
      subtotal: 850,
      lineItems: [
        { description: 'Item A', quantity: 10, unitPrice: 50, total: 500 },
        { description: 'Item B', quantity: 7, unitPrice: 50, total: 350 },
      ],
    });

    const quotation = quotationEntity.data();
    await repo.createQuotation(quotation);

    const retrieved = await repo.getQuotation(quotation.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.lineItems).toBeDefined();
    expect(retrieved!.lineItems!.length).toBe(2);
    expect(retrieved!.lineItems![0].description).toBe('Item A');
    expect(retrieved!.lineItems![1].description).toBe('Item B');
  });

  it('updates a quotation', async () => {
    const quotationEntity = QuotationEntity.create({
      reference: 'QT-2026-003',
      date: '2026-01-15',
      total: 1000,
    });

    const quotation = quotationEntity.data();
    await repo.createQuotation(quotation);

    // Update status and add vendor information
    await repo.updateQuotation(quotation.id, {
      status: 'sent',
      vendorName: 'XYZ Corp',
      vendorEmail: 'contact@xyzcorp.com',
      notes: 'Updated quotation',
    });

    const updated = await repo.getQuotation(quotation.id);
    expect(updated).not.toBeNull();
    expect(updated!.status).toBe('sent');
    expect(updated!.vendorName).toBe('XYZ Corp');
    expect(updated!.vendorEmail).toBe('contact@xyzcorp.com');
    expect(updated!.notes).toBe('Updated quotation');
  });

  it('soft-deletes a quotation', async () => {
    const quotationEntity = QuotationEntity.create({
      reference: 'QT-2026-004',
      date: '2026-01-15',
      total: 500,
    });

    const quotation = quotationEntity.data();
    await repo.createQuotation(quotation);

    // Soft delete
    await repo.deleteQuotation(quotation.id);

    // Should still exist in DB but have deletedAt set
    const deleted = await repo.getQuotation(quotation.id);
    expect(deleted).not.toBeNull();
    expect(deleted!.deletedAt).toBeDefined();
  });

  it('finds quotation by reference', async () => {
    const quotationEntity = QuotationEntity.create({
      reference: 'QT-2026-UNIQUE',
      date: '2026-01-15',
      total: 750,
    });

    const quotation = quotationEntity.data();
    await repo.createQuotation(quotation);

    const found = await repo.findByReference('QT-2026-UNIQUE');
    expect(found).not.toBeNull();
    expect(found!.id).toBe(quotation.id);
    expect(found!.total).toBe(750);
  });

  it('lists quotations with filtering', async () => {
    // Create multiple quotations
    const q1 = QuotationEntity.create({
      reference: 'QT-2026-101',
      date: '2026-01-15',
      projectId: 'proj-1',
      vendorId: 'vendor-1',
      total: 1000,
      status: 'draft',
    }).data();

    const q2 = QuotationEntity.create({
      reference: 'QT-2026-102',
      date: '2026-01-16',
      projectId: 'proj-1',
      vendorId: 'vendor-2',
      total: 2000,
      status: 'sent',
    }).data();

    const q3 = QuotationEntity.create({
      reference: 'QT-2026-103',
      date: '2026-01-17',
      projectId: 'proj-2',
      vendorId: 'vendor-1',
      total: 1500,
      status: 'accepted',
    }).data();

    await repo.createQuotation(q1);
    await repo.createQuotation(q2);
    await repo.createQuotation(q3);

    // List all
    const allResult = await repo.listQuotations();
    expect(allResult.total).toBeGreaterThanOrEqual(3);
    expect(allResult.items.length).toBeGreaterThanOrEqual(3);

    // Filter by project
    const proj1Result = await repo.listQuotations({ projectId: 'proj-1' });
    expect(proj1Result.items.length).toBe(2);

    // Filter by vendor
    const vendor1Result = await repo.listQuotations({ vendorId: 'vendor-1' });
    expect(vendor1Result.items.length).toBe(2);

    // Filter by status
    const draftResult = await repo.listQuotations({ status: ['draft'] });
    expect(draftResult.items.length).toBeGreaterThanOrEqual(1);
    expect(draftResult.items.some((q) => q.reference === 'QT-2026-101')).toBe(true);

    // Filter by date range
    const dateRangeResult = await repo.listQuotations({
      dateRange: { start: '2026-01-16', end: '2026-01-17' },
    });
    expect(dateRangeResult.items.length).toBeGreaterThanOrEqual(2);
  });

  it('does not return soft-deleted quotations in list', async () => {
    const q1 = QuotationEntity.create({
      reference: 'QT-2026-201',
      date: '2026-01-15',
      total: 1000,
    }).data();

    const q2 = QuotationEntity.create({
      reference: 'QT-2026-202',
      date: '2026-01-15',
      total: 2000,
    }).data();

    await repo.createQuotation(q1);
    await repo.createQuotation(q2);

    // Soft delete q1
    await repo.deleteQuotation(q1.id);

    // List should not include deleted quotation
    const result = await repo.listQuotations();
    const refs = result.items.map((q) => q.reference);
    expect(refs).toContain('QT-2026-202');
    expect(refs).not.toContain('QT-2026-201');
  });

  it('handles pagination', async () => {
    // Create 5 quotations
    for (let i = 1; i <= 5; i++) {
      const q = QuotationEntity.create({
        reference: `QT-2026-30${i}`,
        date: '2026-01-15',
        total: i * 100,
      }).data();
      await repo.createQuotation(q);
    }

    // Get first page (2 items)
    const page1 = await repo.listQuotations({ limit: 2, offset: 0 });
    expect(page1.items.length).toBe(2);
    expect(page1.total).toBeGreaterThanOrEqual(5);

    // Get second page (2 items)
    const page2 = await repo.listQuotations({ limit: 2, offset: 2 });
    expect(page2.items.length).toBe(2);

    // Ensure no overlap
    const page1Ids = page1.items.map((q) => q.id);
    const page2Ids = page2.items.map((q) => q.id);
    page1Ids.forEach((id) => {
      expect(page2Ids).not.toContain(id);
    });
  });

  it('handles quotation with expiry date', async () => {
    const quotationEntity = QuotationEntity.create({
      reference: 'QT-2026-400',
      date: '2026-01-15',
      expiryDate: '2026-02-15',
      total: 1000,
    });

    const quotation = quotationEntity.data();
    await repo.createQuotation(quotation);

    const retrieved = await repo.getQuotation(quotation.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.expiryDate).toBeDefined();
    // Should be a valid ISO date string
    expect(new Date(retrieved!.expiryDate!).getTime()).toBeGreaterThan(0);
  });

  it('supports contactId as alias for vendorId', async () => {
    const quotationEntity = QuotationEntity.create({
      reference: 'QT-2026-500',
      date: '2026-01-15',
      total: 1000,
      contactId: 'contact-123',
    });

    const quotation = quotationEntity.data();
    await repo.createQuotation(quotation);

    const retrieved = await repo.getQuotation(quotation.id);
    expect(retrieved).not.toBeNull();
    // contactId should map to vendorId
    expect(retrieved!.vendorId).toBe('contact-123');
    expect(retrieved!.contactId).toBe('contact-123');
  });
});
