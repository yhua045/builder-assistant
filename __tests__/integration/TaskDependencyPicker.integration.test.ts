// Integration test: Task dependency add + remove flow via use cases

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

import { DrizzleTaskRepository } from '../../src/infrastructure/repositories/DrizzleTaskRepository';
import { AddTaskDependencyUseCase } from '../../src/application/usecases/task/AddTaskDependencyUseCase';
import { RemoveTaskDependencyUseCase } from '../../src/application/usecases/task/RemoveTaskDependencyUseCase';
import { GetTaskDetailUseCase } from '../../src/application/usecases/task/GetTaskDetailUseCase';
import { TaskEntity } from '../../src/domain/entities/Task';
import { initDatabase } from '../../src/infrastructure/database/connection';

describe('Task dependency picker — add + remove flow (integration)', () => {
  let repo: DrizzleTaskRepository;
  let addUseCase: AddTaskDependencyUseCase;
  let removeUseCase: RemoveTaskDependencyUseCase;
  let getDetailUseCase: GetTaskDetailUseCase;

  const taskMain = TaskEntity.create({ title: 'Main Task', status: 'pending', projectId: 'proj-dep' });
  const taskDep1 = TaskEntity.create({ title: 'Dependency One', status: 'pending', projectId: 'proj-dep' });
  const taskDep2 = TaskEntity.create({ title: 'Dependency Two', status: 'completed', projectId: 'proj-dep' });

  beforeAll(async () => {
    await initDatabase();
    repo = new DrizzleTaskRepository();
    addUseCase = new AddTaskDependencyUseCase(repo);
    removeUseCase = new RemoveTaskDependencyUseCase(repo);
    getDetailUseCase = new GetTaskDetailUseCase(repo);

    await repo.save(taskMain.data());
    await repo.save(taskDep1.data());
    await repo.save(taskDep2.data());
  });

  it('adds a dependency and it appears in task detail', async () => {
    await addUseCase.execute({ taskId: taskMain.data().id, dependsOnTaskId: taskDep1.data().id });

    const detail = await getDetailUseCase.execute(taskMain.data().id);
    expect(detail?.dependencyTasks).toHaveLength(1);
    expect(detail?.dependencyTasks[0].id).toBe(taskDep1.data().id);
  });

  it('adds a second dependency', async () => {
    await addUseCase.execute({ taskId: taskMain.data().id, dependsOnTaskId: taskDep2.data().id });

    const detail = await getDetailUseCase.execute(taskMain.data().id);
    expect(detail?.dependencyTasks).toHaveLength(2);
  });

  it('removes a dependency and it no longer appears in task detail', async () => {
    await removeUseCase.execute({ taskId: taskMain.data().id, dependsOnTaskId: taskDep1.data().id });

    const detail = await getDetailUseCase.execute(taskMain.data().id);
    expect(detail?.dependencyTasks).toHaveLength(1);
    expect(detail?.dependencyTasks[0].id).toBe(taskDep2.data().id);
  });

  it('rejects adding a self-dependency', async () => {
    await expect(
      addUseCase.execute({ taskId: taskMain.data().id, dependsOnTaskId: taskMain.data().id }),
    ).rejects.toThrow(/self-dependency/i);
  });

  it('no phantom rows remain after all removes', async () => {
    await removeUseCase.execute({ taskId: taskMain.data().id, dependsOnTaskId: taskDep2.data().id });

    const detail = await getDetailUseCase.execute(taskMain.data().id);
    expect(detail?.dependencyTasks).toHaveLength(0);
  });
});
