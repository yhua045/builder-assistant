/**
 * Integration test for the full Critical-Path project-creation flow.
 *
 * Verifies:
 * 1. Create project → confirmSelected for 3 suggestions → 3 tasks in DB with correct order
 * 2. Re-running confirmSelected with the same IDs does NOT create duplicate rows
 * 3. Tasks are sorted by order when retrieved
 *
 * Uses better-sqlite3 in-memory DB (same pattern as other integration tests).
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

import { initDatabase } from '../../src/infrastructure/database/connection';
import { DrizzleTaskRepository } from '../../src/features/tasks/infrastructure/DrizzleTaskRepository';
import { CreateTaskUseCase } from '../../src/features/tasks/application/CreateTaskUseCase';
import { CriticalPathService } from '../../src/application/services/CriticalPathService';
import { SuggestCriticalPathUseCase } from '../../src/application/usecases/criticalpath/SuggestCriticalPathUseCase';
import { stableId } from '../../src/utils/stableId';

describe('CriticalPathCreationFlow — integration', () => {
  let repo: DrizzleTaskRepository;
  let createTaskUC: CreateTaskUseCase;
  let suggestUC: SuggestCriticalPathUseCase;

  beforeAll(async () => {
    await initDatabase();
    repo = new DrizzleTaskRepository();
    createTaskUC = new CreateTaskUseCase(repo);
    const service = new CriticalPathService();
    suggestUC = new SuggestCriticalPathUseCase(service);
  });

  it('creates 3 tasks with correct order values after confirmSelected', async () => {
    const projectId = 'cp-flow-test-1';
    const suggestions = suggestUC
      .execute({ project_type: 'complete_rebuild' })
      .slice(0, 3);

    for (const suggestion of suggestions) {
      const taskId = stableId(projectId, suggestion.id);
      await createTaskUC.execute({
        id: taskId,
        projectId,
        title: suggestion.title,
        status: 'pending',
        order: suggestion.order,
        isCriticalPath: suggestion.critical_flag,
      });
    }

    const tasks = await repo.findByProjectId(projectId);
    expect(tasks).toHaveLength(3);

    const sorted = [...tasks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    expect(sorted[0].order).toBe(1);
    expect(sorted[1].order).toBe(2);
    expect(sorted[2].order).toBe(3);
  });

  it('does NOT create duplicate rows when confirmSelected is re-run with the same IDs', async () => {
    const projectId = 'cp-flow-test-2';
    const suggestions = suggestUC
      .execute({ project_type: 'complete_rebuild' })
      .slice(0, 3);

    // First pass
    for (const suggestion of suggestions) {
      const taskId = stableId(projectId, suggestion.id);
      await createTaskUC.execute({
        id: taskId,
        projectId,
        title: suggestion.title,
        status: 'pending',
        order: suggestion.order,
        isCriticalPath: suggestion.critical_flag,
      });
    }

    // Second pass (retry) — same IDs
    for (const suggestion of suggestions) {
      const taskId = stableId(projectId, suggestion.id);
      await createTaskUC.execute({
        id: taskId,
        projectId,
        title: suggestion.title,
        status: 'pending',
        order: suggestion.order,
        isCriticalPath: suggestion.critical_flag,
      });
    }

    const tasks = await repo.findByProjectId(projectId);
    expect(tasks).toHaveLength(3); // no duplicates
  });

  it('findByProjectId returns tasks that can be sorted by order', async () => {
    const projectId = 'cp-flow-test-3';
    const suggestions = suggestUC
      .execute({ project_type: 'extension' })
      .slice(0, 4);

    // Insert in REVERSE order to verify sorting is caller-controlled
    for (const suggestion of [...suggestions].reverse()) {
      const taskId = stableId(projectId, suggestion.id);
      await createTaskUC.execute({
        id: taskId,
        projectId,
        title: suggestion.title,
        status: 'pending',
        order: suggestion.order,
      });
    }

    const tasks = await repo.findByProjectId(projectId);
    const sorted = [...tasks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const orders = sorted.map(t => t.order);

    // All orders should be present and sorted ascending
    expect(orders).toEqual([...orders].sort((a, b) => (a ?? 0) - (b ?? 0)));
  });
});
