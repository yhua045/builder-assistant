// Integration test: cascade delete — no orphan rows remain after task deletion

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
          } catch {
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
import { DeleteTaskUseCase } from '../../application/DeleteTaskUseCase';
import { TaskEntity } from '../../../../domain/entities/Task';
import { initDatabase } from '../../../../infrastructure/database/connection';

describe('DeleteTaskUseCase — cascade delete (integration)', () => {
  let repo: DrizzleTaskRepository;
  let useCase: DeleteTaskUseCase;

  beforeAll(async () => {
    await initDatabase();
    repo = new DrizzleTaskRepository();
    useCase = new DeleteTaskUseCase(repo);
  });

  it('removes task_dependencies rows when task is deleted', async () => {
    const taskA = TaskEntity.create({ title: 'Task A', status: 'pending', projectId: 'proj-cascade' });
    const taskB = TaskEntity.create({ title: 'Task B', status: 'pending', projectId: 'proj-cascade' });
    await repo.save(taskA.data());
    await repo.save(taskB.data());
    await repo.addDependency(taskA.data().id, taskB.data().id);

    // Verify dependency exists
    const depsBefore = await repo.findDependencies(taskA.data().id);
    expect(depsBefore).toHaveLength(1);

    // Delete taskA — should cascade
    await useCase.execute(taskA.data().id);

    // taskA is deleted
    const deleted = await repo.findById(taskA.data().id);
    expect(deleted).toBeNull();

    // No orphan dependency rows: taskB still exists, no deps pointing from/to taskA
    const depsAfter = await repo.findDependencies(taskA.data().id);
    expect(depsAfter).toHaveLength(0);

    // Also check reverse: taskA no longer appears in dependents of taskB
    const dependentsAfter = await repo.findDependents(taskB.data().id);
    expect(dependentsAfter.find(t => t.id === taskA.data().id)).toBeUndefined();
  });

  it('removes task_delay_reasons rows when task is deleted', async () => {
    const task = TaskEntity.create({ title: 'Delayed Task', status: 'blocked', projectId: 'proj-cascade' });
    await repo.save(task.data());
    await repo.addDelayReason({
      taskId: task.data().id,
      reasonTypeId: 'OTHER',
      reasonTypeLabel: 'Other',
      notes: 'Some delay',
    });

    const reasonsBefore = await repo.findDelayReasons(task.data().id);
    expect(reasonsBefore).toHaveLength(1);

    await useCase.execute(task.data().id);

    const reasonsAfter = await repo.findDelayReasons(task.data().id);
    expect(reasonsAfter).toHaveLength(0);
  });

  it('also removes reverse dependency rows (depends_on_task_id)', async () => {
    const taskX = TaskEntity.create({ title: 'Task X', status: 'pending', projectId: 'proj-cascade' });
    const taskY = TaskEntity.create({ title: 'Task Y', status: 'pending', projectId: 'proj-cascade' });
    await repo.save(taskX.data());
    await repo.save(taskY.data());
    // taskY depends on taskX
    await repo.addDependency(taskY.data().id, taskX.data().id);

    // Delete taskX — should clean up the dependency where it appears as depends_on_task_id
    await useCase.execute(taskX.data().id);

    // taskY's dependencies list should now be empty
    const depsOfY = await repo.findDependencies(taskY.data().id);
    expect(depsOfY.find(t => t.id === taskX.data().id)).toBeUndefined();
  });
});
