// Integration tests for DrizzleTaskRepository — dependencies, delay reasons & subcontractor

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
          } catch (e) {
            // fallthrough to exec
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

describe('DrizzleTaskRepository — task detail extensions (better-sqlite3 :memory:)', () => {
  let repo: DrizzleTaskRepository;

  beforeAll(async () => {
    await initDatabase();
    repo = new DrizzleTaskRepository();
  });

  // ── Dependencies ───────────────────────────────────────────────────────────

  describe('dependencies', () => {
    const taskA = TaskEntity.create({ title: 'Task A', status: 'pending' });
    const taskB = TaskEntity.create({ title: 'Task B', status: 'pending' });
    const taskC = TaskEntity.create({ title: 'Task C', status: 'completed' });

    beforeAll(async () => {
      await repo.save(taskA.data());
      await repo.save(taskB.data());
      await repo.save(taskC.data());
    });

    it('adds a dependency', async () => {
      await repo.addDependency(taskA.data().id, taskB.data().id);
      const deps = await repo.findDependencies(taskA.data().id);
      expect(deps).toHaveLength(1);
      expect(deps[0].id).toBe(taskB.data().id);
    });

    it('ignores duplicate dependency (unique index)', async () => {
      // Should not throw — idempotent
      await repo.addDependency(taskA.data().id, taskB.data().id);
      const deps = await repo.findDependencies(taskA.data().id);
      expect(deps).toHaveLength(1);
    });

    it('adds a second dependency', async () => {
      await repo.addDependency(taskA.data().id, taskC.data().id);
      const deps = await repo.findDependencies(taskA.data().id);
      expect(deps).toHaveLength(2);
    });

    it('finds dependents (reverse lookup)', async () => {
      const dependents = await repo.findDependents(taskB.data().id);
      expect(dependents).toHaveLength(1);
      expect(dependents[0].id).toBe(taskA.data().id);
    });

    it('removes a dependency', async () => {
      await repo.removeDependency(taskA.data().id, taskB.data().id);
      const deps = await repo.findDependencies(taskA.data().id);
      expect(deps).toHaveLength(1);
      expect(deps[0].id).toBe(taskC.data().id);
    });
  });

  // ── Delay Reasons ──────────────────────────────────────────────────────────

  describe('delay reasons', () => {
    const taskD = TaskEntity.create({ title: 'Task D', status: 'pending' });

    beforeAll(async () => {
      await repo.save(taskD.data());
    });

    it('adds a delay reason', async () => {
      const result = await repo.addDelayReason({
        taskId: taskD.data().id,
        reasonTypeId: 'WEATHER',
        notes: 'Heavy rain',
        delayDurationDays: 3,
        actor: 'builder-1',
      });

      expect(result.id).toBeTruthy();
      expect(result.taskId).toBe(taskD.data().id);
      expect(result.reasonTypeId).toBe('WEATHER');
      expect(result.notes).toBe('Heavy rain');
      expect(result.createdAt).toBeTruthy();
    });

    it('finds delay reasons for a task', async () => {
      const reasons = await repo.findDelayReasons(taskD.data().id);
      expect(reasons).toHaveLength(1);
      expect(reasons[0].reasonTypeId).toBe('WEATHER');
      expect(reasons[0].reasonTypeLabel).toBe('Bad weather');
    });

    it('adds a second delay reason', async () => {
      await repo.addDelayReason({
        taskId: taskD.data().id,
        reasonTypeId: 'MATERIAL_DELAY',
        notes: 'Tiles backordered',
      });
      const reasons = await repo.findDelayReasons(taskD.data().id);
      expect(reasons).toHaveLength(2);
    });

    it('removes a delay reason', async () => {
      const reasons = await repo.findDelayReasons(taskD.data().id);
      await repo.removeDelayReason(reasons[0].id);
      const remaining = await repo.findDelayReasons(taskD.data().id);
      expect(remaining).toHaveLength(1);
    });
  });

  // ── Subcontractor ─────────────────────────────────────────────────────────

  describe('subcontractor', () => {
    it('saves and retrieves subcontractorId', async () => {
      const task = TaskEntity.create({
        title: 'Task with subcontractor',
        status: 'pending',
        subcontractorId: 'contact-xyz',
      });
      await repo.save(task.data());

      const loaded = await repo.findById(task.data().id);
      expect(loaded).not.toBeNull();
      expect(loaded!.subcontractorId).toBe('contact-xyz');
    });

    it('updates subcontractorId', async () => {
      const task = TaskEntity.create({ title: 'Sub update test', status: 'pending' });
      await repo.save(task.data());

      await repo.update({ ...task.data(), subcontractorId: 'contact-new' });
      const loaded = await repo.findById(task.data().id);
      expect(loaded!.subcontractorId).toBe('contact-new');
    });
  });

  // ── Delay Reason Types (seeded) ───────────────────────────────────────────

  describe('delay reason types (seeded)', () => {
    it('has seeded delay reason types accessible via raw query', async () => {
      // Directly verify migration seeded the lookup table
      const { db } = require('../../../../infrastructure/database/connection').getDatabase();
      const [result] = await db.executeSql('SELECT * FROM delay_reason_types ORDER BY display_order');
      expect(result.rows.length).toBe(10);
      expect(result.rows.item(0).id).toBe('WEATHER');
      expect(result.rows.item(9).id).toBe('OTHER');
    });
  });
});
