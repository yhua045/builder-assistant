/**
 * Integration tests for the `order` field on DrizzleTaskRepository.
 * Verifies that order is persisted and round-tripped correctly.
 *
 * RED phase: will fail until DrizzleTaskRepository maps `order` and the
 * DB schema migration includes the `order` column.
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
            db.prepare(stmt).run(...params);
            return [{ rows: { length: 0, item: (_: number) => undefined } }];
          } catch (_) {
            // fallthrough
          }
        }
        if (stmt) db.exec(stmt);
        return [{ rows: { length: 0, item: (_: number) => undefined } }];
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
    },
  };
});

import { DrizzleTaskRepository } from '../../infrastructure/DrizzleTaskRepository';
import { TaskEntity } from '../../../../domain/entities/Task';
import { initDatabase } from '../../../../infrastructure/database/connection';

describe('DrizzleTaskRepository — order field', () => {
  let repo: DrizzleTaskRepository;

  beforeAll(async () => {
    await initDatabase();
    repo = new DrizzleTaskRepository();
  });

  it('save with order: 3 → findById returns order === 3', async () => {
    const task = TaskEntity.create({
      title: 'Ordered Task',
      projectId: 'proj-order-1',
      status: 'pending',
      order: 3,
    });
    await repo.save(task.data());

    const loaded = await repo.findById(task.data().id);
    expect(loaded).not.toBeNull();
    expect(loaded!.order).toBe(3);
  });

  it('save with order: undefined → findById returns order === undefined', async () => {
    const task = TaskEntity.create({
      title: 'Unordered Task',
      projectId: 'proj-order-1',
      status: 'pending',
      // no order
    });
    await repo.save(task.data());

    const loaded = await repo.findById(task.data().id);
    expect(loaded).not.toBeNull();
    expect(loaded!.order).toBeUndefined();
  });

  it('update sets order: 7 → findById returns order === 7', async () => {
    const task = TaskEntity.create({
      title: 'Task to Update',
      projectId: 'proj-order-2',
      status: 'pending',
      order: 1,
    });
    await repo.save(task.data());

    const loaded = await repo.findById(task.data().id);
    await repo.update({ ...loaded!, order: 7 });

    const reloaded = await repo.findById(task.data().id);
    expect(reloaded!.order).toBe(7);
  });
});
