// Mock react-native-sqlite-storage with a small adapter backed by better-sqlite3 (:memory:)
// (Same shim as the other Drizzle integration tests in this folder)

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

import { DrizzleTaskRepository } from '../../src/infrastructure/repositories/DrizzleTaskRepository';
import { TaskEntity } from '../../src/domain/entities/Task';
import { initDatabase } from '../../src/infrastructure/database/connection';

describe('DrizzleTaskRepository — quote fields (issue #141)', () => {
  let repo: DrizzleTaskRepository;

  beforeAll(async () => {
    await initDatabase();
    repo = new DrizzleTaskRepository();
  });

  it('saves and reads back taskType, workType, quoteAmount, quoteStatus, quoteInvoiceId', async () => {
    const task = TaskEntity.create({
      title: 'Concrete slab quote',
      status: 'pending',
      taskType: 'contract_work',
      workType: 'Concrete',
      quoteAmount: 12500,
      quoteStatus: 'issued',
      quoteInvoiceId: undefined,
      projectId: 'proj-qt-1',
    }).data();

    await repo.save(task);
    const loaded = await repo.findById(task.id);

    expect(loaded).not.toBeNull();
    expect(loaded!.taskType).toBe('contract_work');
    expect(loaded!.workType).toBe('Concrete');
    expect(loaded!.quoteAmount).toBe(12500);
    expect(loaded!.quoteStatus).toBe('issued');
    expect(loaded!.quoteInvoiceId).toBeUndefined();
  });

  it('updates quote fields correctly', async () => {
    const task = TaskEntity.create({
      title: 'Framing job',
      status: 'pending',
      taskType: 'contract_work',
      workType: 'Framing',
      quoteAmount: 8000,
      quoteStatus: 'issued',
    }).data();

    await repo.save(task);

    const withInvoice = {
      ...task,
      quoteStatus: 'accepted' as const,
      quoteInvoiceId: 'inv-abc-123',
      updatedAt: new Date().toISOString(),
    };
    await repo.update(withInvoice);

    const reloaded = await repo.findById(task.id);
    expect(reloaded!.quoteStatus).toBe('accepted');
    expect(reloaded!.quoteInvoiceId).toBe('inv-abc-123');
  });

  it('defaults taskType to variation for tasks without taskType set', async () => {
    const task = TaskEntity.create({
      title: 'Legacy task',
      status: 'pending',
    }).data();

    await repo.save(task);
    const loaded = await repo.findById(task.id);

    // task_type column DEFAULT 'variation' should be applied
    expect(loaded!.taskType).toBe('variation');
  });

  it('handles null workType and quoteAmount gracefully', async () => {
    const task = TaskEntity.create({
      title: 'Standard task',
      status: 'pending',
      taskType: 'standard',
    }).data();

    await repo.save(task);
    const loaded = await repo.findById(task.id);

    expect(loaded!.taskType).toBe('standard');
    expect(loaded!.workType).toBeUndefined();
    expect(loaded!.quoteAmount).toBeUndefined();
    expect(loaded!.quoteStatus).toBeUndefined();
  });
});
