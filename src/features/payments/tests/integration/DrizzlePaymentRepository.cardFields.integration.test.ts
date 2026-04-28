// Integration tests for DrizzlePaymentRepository: global list, search, grouping, sum
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
            db.prepare(stmt).run(...params);
          } catch (e: any) {
            if (e.code === 'SQLITE_CONSTRAINT_UNIQUE' || e.message?.includes('UNIQUE constraint failed')) throw e;
          }
        } else if (stmt) {
          db.exec(stmt);
        }
        return [{ rows: { length: 0, item: (_: number) => undefined } }];
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
import { closeDatabase, initDatabase } from '../../../../infrastructure/database/connection';

async function createPaymentsTable() {
  const { db } = await initDatabase();
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      project_id TEXT,
      invoice_id TEXT,
      amount REAL NOT NULL,
      currency TEXT,
      payment_date INTEGER,
      due_date INTEGER,
      status TEXT,
      payment_method TEXT,
      reference TEXT,
      notes TEXT,
      contact_id TEXT,
      contractor_name TEXT,
      payment_category TEXT NOT NULL DEFAULT 'other',
      stage_label TEXT,
      created_at INTEGER,
      updated_at INTEGER
    )
  `);
}

describe('DrizzlePaymentRepository — global & search', () => {
  let repo: DrizzlePaymentRepository;

  beforeEach(async () => {
    await closeDatabase();
    repo = new DrizzlePaymentRepository();
    await createPaymentsTable();
  });

  afterEach(async () => {
    await closeDatabase();
  });

  it('list({ allProjects: true }) returns payments from multiple projects', async () => {
    const p1 = PaymentEntity.create({ amount: 100, projectId: 'proj-A', status: 'pending' }).data();
    const p2 = PaymentEntity.create({ amount: 200, projectId: 'proj-B', status: 'pending' }).data();
    await repo.save(p1);
    await repo.save(p2);

    const result = await repo.list({ allProjects: true, status: 'pending' });
    expect(result.items).toHaveLength(2);
    const ids = result.items.map((p) => p.id);
    expect(ids).toContain(p1.id);
    expect(ids).toContain(p2.id);
  });

  it('list({ allProjects: true }) omits settled payments when status=pending', async () => {
    const pending = PaymentEntity.create({ amount: 100, projectId: 'proj-A', status: 'pending' }).data();
    const settled = PaymentEntity.create({ amount: 200, projectId: 'proj-B', status: 'settled' }).data();
    await repo.save(pending);
    await repo.save(settled);

    const result = await repo.list({ allProjects: true, status: 'pending' });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe(pending.id);
  });

  it('contractorSearch does a case-insensitive partial match', async () => {
    const p1 = PaymentEntity.create({ amount: 100, projectId: 'proj-A', status: 'pending', contractorName: 'Smith Framing' }).data();
    const p2 = PaymentEntity.create({ amount: 200, projectId: 'proj-B', status: 'pending', contractorName: 'Jones Plumbing' }).data();
    await repo.save(p1);
    await repo.save(p2);

    const result = await repo.list({ allProjects: true, status: 'pending', contractorSearch: 'smith' });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].contractorName).toBe('Smith Framing');
  });

  it('contractorSearch with partial upper-case still matches', async () => {
    const p = PaymentEntity.create({ amount: 500, projectId: 'proj-A', status: 'pending', contractorName: 'ACE Electrical' }).data();
    await repo.save(p);

    const result = await repo.list({ allProjects: true, contractorSearch: 'ACE' });
    expect(result.items).toHaveLength(1);
  });

  it('list({ projectId, paymentCategory: contract }) returns only contract payments', async () => {
    const contract = PaymentEntity.create({ amount: 1000, projectId: 'proj-X', status: 'pending', paymentCategory: 'contract' }).data();
    const variation = PaymentEntity.create({ amount: 200, projectId: 'proj-X', status: 'pending', paymentCategory: 'variation' }).data();
    await repo.save(contract);
    await repo.save(variation);

    const result = await repo.list({ projectId: 'proj-X', paymentCategory: 'contract' });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].paymentCategory).toBe('contract');
  });

  it('list({ projectId, paymentCategory: variation }) returns only variation payments', async () => {
    const contract = PaymentEntity.create({ amount: 1000, projectId: 'proj-X', status: 'pending', paymentCategory: 'contract' }).data();
    const variation = PaymentEntity.create({ amount: 200, projectId: 'proj-X', status: 'pending', paymentCategory: 'variation' }).data();
    await repo.save(contract);
    await repo.save(variation);

    const result = await repo.list({ projectId: 'proj-X', paymentCategory: 'variation' });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].paymentCategory).toBe('variation');
  });

  it('getGlobalAmountPayable sums all pending payments', async () => {
    const p1 = PaymentEntity.create({ amount: 1000, projectId: 'proj-A', status: 'pending' }).data();
    const p2 = PaymentEntity.create({ amount: 500, projectId: 'proj-B', status: 'pending' }).data();
    const settled = PaymentEntity.create({ amount: 999, projectId: 'proj-C', status: 'settled' }).data();
    await repo.save(p1);
    await repo.save(p2);
    await repo.save(settled);

    const total = await repo.getGlobalAmountPayable();
    expect(total).toBe(1500);
  });

  it('getGlobalAmountPayable returns 0 when no pending payments', async () => {
    const total = await repo.getGlobalAmountPayable();
    expect(total).toBe(0);
  });

  it('getGlobalAmountPayable filters by contractorSearch', async () => {
    const p1 = PaymentEntity.create({ amount: 1000, projectId: 'proj-A', status: 'pending', contractorName: 'Smith Framing' }).data();
    const p2 = PaymentEntity.create({ amount: 500, projectId: 'proj-B', status: 'pending', contractorName: 'Jones Plumbing' }).data();
    await repo.save(p1);
    await repo.save(p2);

    const total = await repo.getGlobalAmountPayable('smith');
    expect(total).toBe(1000);
  });

  it('new fields round-trip through save/findById', async () => {
    const p = PaymentEntity.create({
      amount: 750,
      projectId: 'proj-Z',
      status: 'pending',
      contactId: 'contact-1',
      contractorName: 'Ace Framing',
      paymentCategory: 'contract',
      stageLabel: 'Frame Stage',
    }).data();
    await repo.save(p);

    const found = await repo.findById(p.id);
    expect(found).not.toBeNull();
    expect(found!.contactId).toBe('contact-1');
    expect(found!.contractorName).toBe('Ace Framing');
    expect(found!.paymentCategory).toBe('contract');
    expect(found!.stageLabel).toBe('Frame Stage');
  });
});
