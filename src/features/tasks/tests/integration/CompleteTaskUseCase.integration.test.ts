// Mock react-native-sqlite-storage with a small adapter backed by better-sqlite3 (:memory:)

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

import { CompleteTaskUseCase } from '../../application/CompleteTaskUseCase';
import { TaskCompletionValidationError } from '../../application/TaskCompletionErrors';
import { DrizzleTaskRepository } from '../../infrastructure/DrizzleTaskRepository';
import { DrizzleQuotationRepository } from '../../../quotations/infrastructure/DrizzleQuotationRepository';
import { TaskEntity } from '../../../../domain/entities/Task';
import { QuotationEntity } from '../../../../domain/entities/Quotation';
import { closeDatabase } from '../../../../infrastructure/database/connection';

describe('CompleteTaskUseCase integration (better-sqlite3 :memory:)', () => {
  let taskRepo: DrizzleTaskRepository;
  let quotationRepo: DrizzleQuotationRepository;
  let useCase: CompleteTaskUseCase;

  beforeEach(() => {
    taskRepo = new DrizzleTaskRepository();
    quotationRepo = new DrizzleQuotationRepository();
    useCase = new CompleteTaskUseCase(taskRepo, quotationRepo);
  });

  afterEach(async () => {
    await closeDatabase();
  });

  function makeTask(overrides: Record<string, unknown> = {}) {
    return TaskEntity.create({
      title: 'Test Task',
      status: 'pending',
      projectId: 'proj-1',
      ...overrides,
    } as any).data();
  }

  function makeQuotation(taskId: string, overrides: Record<string, unknown> = {}) {
    return QuotationEntity.create({
      reference: `QT-2026-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      date: '2026-01-15',
      total: 1000,
      currency: 'USD',
      taskId,
      ...overrides,
    } as any).data();
  }

  // T-16: No quotations linked to task → completes successfully
  it('completes a task with no linked quotations', async () => {
    const task = makeTask();
    await taskRepo.save(task);

    await useCase.execute(task.id);

    const updated = await taskRepo.findById(task.id);
    expect(updated?.status).toBe('completed');
    expect(updated?.completedAt).toBeDefined();
  });

  // T-17: All quotations accepted → completes successfully
  it('completes a task when all linked quotations are accepted', async () => {
    const task = makeTask();
    await taskRepo.save(task);

    const q1 = makeQuotation(task.id, { status: 'accepted' });
    const q2 = makeQuotation(task.id, { status: 'accepted' });
    await quotationRepo.createQuotation(q1);
    await quotationRepo.createQuotation(q2);

    await useCase.execute(task.id);

    const updated = await taskRepo.findById(task.id);
    expect(updated?.status).toBe('completed');
  });

  // T-18: One draft quotation → throws TaskCompletionValidationError, task unchanged
  it('throws TaskCompletionValidationError and leaves task unchanged when a draft quotation exists', async () => {
    const task = makeTask();
    await taskRepo.save(task);

    const q = makeQuotation(task.id, { status: 'draft' });
    await quotationRepo.createQuotation(q);

    await expect(useCase.execute(task.id)).rejects.toThrow(TaskCompletionValidationError);

    const unchanged = await taskRepo.findById(task.id);
    expect(unchanged?.status).toBe('pending');
  });

  // T-19: One sent quotation → throws TaskCompletionValidationError, task unchanged
  it('throws TaskCompletionValidationError and leaves task unchanged when a sent quotation exists', async () => {
    const task = makeTask();
    await taskRepo.save(task);

    const q = makeQuotation(task.id, { status: 'sent' });
    await quotationRepo.createQuotation(q);

    await expect(useCase.execute(task.id)).rejects.toThrow(TaskCompletionValidationError);

    const unchanged = await taskRepo.findById(task.id);
    expect(unchanged?.status).toBe('pending');
  });

  // T-20: Soft-deleted draft quotation is ignored → completes
  it('completes a task when the only draft quotation is soft-deleted', async () => {
    const task = makeTask();
    await taskRepo.save(task);

    const q = makeQuotation(task.id, { status: 'draft' });
    await quotationRepo.createQuotation(q);
    // Soft-delete the quotation
    await quotationRepo.deleteQuotation(q.id);

    await useCase.execute(task.id);

    const updated = await taskRepo.findById(task.id);
    expect(updated?.status).toBe('completed');
  });
});
