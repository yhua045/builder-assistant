// Integration test: DrizzleTaskRepository — resolveDelayReason & summarizeDelayReasons

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
import { TaskEntity } from '../../../../domain/entities/Task';
import { initDatabase } from '../../../../infrastructure/database/connection';

describe('DrizzleTaskRepository — resolveDelayReason & summarizeDelayReasons (integration)', () => {
  let repo: DrizzleTaskRepository;

  // Create two tasks with several delay entries
  const taskA = TaskEntity.create({ title: 'Task for resolve', status: 'pending' });
  const taskB = TaskEntity.create({ title: 'Task for stats', status: 'pending' });

  beforeAll(async () => {
    await initDatabase();
    repo = new DrizzleTaskRepository();

    await repo.save(taskA.data());
    await repo.save(taskB.data());

    // Add 2 WEATHER + 1 MATERIAL_DELAY to taskA
    await repo.addDelayReason({ taskId: taskA.data().id, reasonTypeId: 'WEATHER' });
    await repo.addDelayReason({ taskId: taskA.data().id, reasonTypeId: 'WEATHER' });
    await repo.addDelayReason({ taskId: taskA.data().id, reasonTypeId: 'MATERIAL_DELAY' });

    // Add 1 OTHER to taskB
    await repo.addDelayReason({ taskId: taskB.data().id, reasonTypeId: 'OTHER' });
  });

  describe('resolveDelayReason', () => {
    it('sets resolvedAt on the delay record', async () => {
      const reasons = await repo.findDelayReasons(taskA.data().id);
      const first = reasons[0];
      expect(first.resolvedAt).toBeUndefined();

      const ts = new Date().toISOString();
      await repo.resolveDelayReason(first.id, ts, 'Rain stopped');

      const updated = await repo.findDelayReasons(taskA.data().id);
      const resolved = updated.find((r) => r.id === first.id);
      expect(resolved).toBeDefined();
      expect(resolved!.resolvedAt).toBeTruthy();
      expect(resolved!.mitigationNotes).toBe('Rain stopped');
    });

    it('does not affect other delay records on the same task', async () => {
      const reasons = await repo.findDelayReasons(taskA.data().id);
      const unresolvedCount = reasons.filter((r) => !r.resolvedAt).length;
      expect(unresolvedCount).toBe(2); // two remaining unresolved
    });
  });

  describe('summarizeDelayReasons', () => {
    it('returns counts grouped by reason type, sorted descending by count', async () => {
      const summary = await repo.summarizeDelayReasons(taskA.data().id);

      expect(summary).toHaveLength(2);
      // WEATHER appears twice; MATERIAL_DELAY once
      expect(summary[0].reasonTypeId).toBe('WEATHER');
      expect(summary[0].count).toBe(2);
      expect(summary[1].reasonTypeId).toBe('MATERIAL_DELAY');
      expect(summary[1].count).toBe(1);
    });

    it('returns global summary when taskId is omitted', async () => {
      const summary = await repo.summarizeDelayReasons();

      // Across both tasks: WEATHER×2, MATERIAL_DELAY×1, OTHER×1
      expect(summary.length).toBeGreaterThanOrEqual(3);
      const weatherRow = summary.find((r) => r.reasonTypeId === 'WEATHER');
      expect(weatherRow).toBeDefined();
      expect(weatherRow!.count).toBe(2);
    });

    it('returns empty array for a task with no delay reasons', async () => {
      const emptyTask = TaskEntity.create({ title: 'No delays', status: 'pending' });
      await repo.save(emptyTask.data());

      const summary = await repo.summarizeDelayReasons(emptyTask.data().id);
      expect(summary).toEqual([]);
    });
  });
});
