/**
 * Integration test: GetCockpitDataUseCase + DrizzleTaskRepository
 *
 * Uses an in-memory better-sqlite3 instance as the SQLite backend.
 * Exercises the full stack: repo → use-case → CockpitScorer.
 *
 * Run: npx jest GetCockpitData.integration
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
          const tx = { executeSql: (sql: string, p?: any[]) => createAdapter(db).executeSql(sql, p) };
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

import { DrizzleTaskRepository } from '../../src/features/tasks/infrastructure/DrizzleTaskRepository';
import { GetCockpitDataUseCase } from '../../src/features/tasks/application/GetCockpitDataUseCase';
import { TaskEntity } from '../../src/domain/entities/Task';
import { initDatabase } from '../../src/infrastructure/database/connection';

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Each test uses its own project ID to prevent cross-test task accumulation
// skewing focus3 scores (max-3 cap).
let _nextProjectId = 1;
function freshProjectId() {
  return `project_${_nextProjectId++}`;
}

const NOW = new Date('2026-03-05T10:00:00.000Z');

function daysFromNow(n: number, base = NOW): string {
  return new Date(base.getTime() + n * 24 * 60 * 60 * 1000).toISOString();
}

// ─── Setup ────────────────────────────────────────────────────────────────────

describe('GetCockpitDataUseCase — integration (better-sqlite3 :memory:)', () => {
  let repo: DrizzleTaskRepository;
  let useCase: GetCockpitDataUseCase;

  beforeAll(async () => {
    await initDatabase();
    repo = new DrizzleTaskRepository();
    useCase = new GetCockpitDataUseCase(repo);
  });

  // ── Empty project ──────────────────────────────────────────────────────────

  it('returns empty cockpit for a project with no tasks', async () => {
    const result = await useCase.execute('empty_project', NOW);
    expect(result.blockers).toHaveLength(0);
    expect(result.focus3).toHaveLength(0);
  });

  // ── Manual blockers ────────────────────────────────────────────────────────

  it('surfaces a manually blocked task in the blocker bar', async () => {
    const projectId = freshProjectId();
    const blocked = TaskEntity.create({
      title: 'Scaffold Assembly',
      status: 'blocked',
      priority: 'high',
      projectId,
    });
    const active = TaskEntity.create({
      title: 'Frame Erection',
      status: 'pending',
      priority: 'medium',
      projectId,
    });

    await repo.save(blocked.data());
    await repo.save(active.data());

    const result = await useCase.execute(projectId, NOW);

    const blockerIds = result.blockers.map(b => b.task.id);
    expect(blockerIds).toContain(blocked.data().id);
    expect(result.blockers.find(b => b.task.id === blocked.data().id)?.severity).toBe('red');
  });

  // ── Auto-blocked via overdue prereq ────────────────────────────────────────

  it('auto-blocks a task whose prerequisite is overdue', async () => {
    const projectId = freshProjectId();
    const prereq = TaskEntity.create({
      title: 'Site Inspection',
      status: 'in_progress',
      priority: 'high',
      dueDate: daysFromNow(-4), // 4 days overdue → red
      projectId,
    });
    const dependent = TaskEntity.create({
      title: 'Foundation Pour',
      status: 'pending',
      priority: 'urgent',
      projectId,
    });

    await repo.save(prereq.data());
    await repo.save(dependent.data());
    await repo.addDependency(dependent.data().id, prereq.data().id);

    const result = await useCase.execute(projectId, NOW);

    const blockerItem = result.blockers.find(b => b.task.id === dependent.data().id);
    expect(blockerItem).toBeDefined();
    expect(blockerItem!.severity).toBe('red');
    expect(blockerItem!.blockedPrereqs.map(p => p.id)).toContain(prereq.data().id);
  });

  // ── No auto-block when prereq is completed ────────────────────────────────

  it('does NOT auto-block when the prerequisite is completed', async () => {
    const projectId = freshProjectId();
    const completedPrereq = TaskEntity.create({
      title: 'Council Approval',
      status: 'completed',
      dueDate: daysFromNow(-5),
      projectId,
    });
    const nextTask = TaskEntity.create({
      title: 'Slab Pour',
      status: 'pending',
      priority: 'urgent',
      projectId,
    });

    await repo.save(completedPrereq.data());
    await repo.save(nextTask.data());
    await repo.addDependency(nextTask.data().id, completedPrereq.data().id);

    const result = await useCase.execute(projectId, NOW);

    const blockerIds = result.blockers.map(b => b.task.id);
    expect(blockerIds).not.toContain(nextTask.data().id);
  });

  // ── Focus-3 ordering ───────────────────────────────────────────────────────

  it('orders focus3 by score: urgent+overdue > low+future', async () => {
    const projectId = freshProjectId();
    const topTask = TaskEntity.create({
      title: 'Critical Frame',
      status: 'pending',
      priority: 'urgent',
      dueDate: daysFromNow(-2),
      projectId,
    });
    const bottomTask = TaskEntity.create({
      title: 'Paint Selection',
      status: 'pending',
      priority: 'low',
      dueDate: daysFromNow(20),
      projectId,
    });

    await repo.save(topTask.data());
    await repo.save(bottomTask.data());

    const result = await useCase.execute(projectId, NOW);

    const focusIds = result.focus3.map(f => f.task.id);
    const topIdx = focusIds.indexOf(topTask.data().id);
    const bottomIdx = focusIds.indexOf(bottomTask.data().id);

    // topTask should rank before bottomTask if both are in focus3
    if (topIdx !== -1 && bottomIdx !== -1) {
      expect(topIdx).toBeLessThan(bottomIdx);
    } else {
      // At minimum, topTask must be in the list
      expect(topIdx).toBeGreaterThanOrEqual(0);
    }
  });

  // ── isCriticalPath persisted and surfaced ──────────────────────────────────

  it('persists isCriticalPath and boosts score in focus3', async () => {
    const projectId = freshProjectId();
    const criticalTask = TaskEntity.create({
      title: 'Roof Inspection (Critical)',
      status: 'pending',
      priority: 'low',      // low base priority
      isCriticalPath: true,  // +200 boost
      dueDate: daysFromNow(10),
      projectId,
    });
    const highPriNonCritical = TaskEntity.create({
      title: 'Plumbing Rough-In',
      status: 'pending',
      priority: 'high',
      dueDate: daysFromNow(2),
      projectId,
    });

    await repo.save(criticalTask.data());
    await repo.save(highPriNonCritical.data());

    // Persist check: reload from DB
    const loaded = await repo.findById(criticalTask.data().id);
    expect(loaded?.isCriticalPath).toBe(true);

    const result = await useCase.execute(projectId, NOW);

    const focusIds = result.focus3.map(f => f.task.id);
    const critIdx = focusIds.indexOf(criticalTask.data().id);
    const highIdx = focusIds.indexOf(highPriNonCritical.data().id);

    // Critical task should beat high-priority non-critical (200 boost > 70-10 = 60 diff)
    if (critIdx !== -1 && highIdx !== -1) {
      expect(critIdx).toBeLessThan(highIdx);
    }
  });

  // ── Focus-3 count ─────────────────────────────────────────────────────────

  it('never returns more than 3 focus items', async () => {
    const projectId = freshProjectId();
    // Save a batch of tasks so the project has more than 3 active tasks
    for (let i = 0; i < 5; i++) {
      const t = TaskEntity.create({
        title: `Extra Task ${i}`,
        status: 'pending',
        priority: 'medium',
        dueDate: daysFromNow(i + 1),
        projectId,
      });
      await repo.save(t.data());
    }

    const result = await useCase.execute(projectId, NOW);
    expect(result.focus3.length).toBeLessThanOrEqual(3);
  });

  // ── Focus-3 urgency labels ────────────────────────────────────────────────

  it('populates urgencyLabel on each focus item', async () => {
    const projectId = freshProjectId();
    const t = TaskEntity.create({
      title: 'Overdue Task Label Check',
      status: 'pending',
      priority: 'urgent',
      dueDate: daysFromNow(-3),
      projectId,
    });
    await repo.save(t.data());

    const result = await useCase.execute(projectId, NOW);
    const item = result.focus3.find(f => f.task.id === t.data().id);
    expect(item?.urgencyLabel).toBe('🔴 3d overdue');
  });

  // ── nextInLine in blocker item ────────────────────────────────────────────

  it('populates nextInLine in a blocker item', async () => {
    const projectId = freshProjectId();
    const blockingTask = TaskEntity.create({
      title: 'Frame Delivery (blocked)',
      status: 'blocked',
      priority: 'high',
      projectId,
    });
    const waitingTask = TaskEntity.create({
      title: 'Wall Construction (waiting)',
      status: 'pending',
      priority: 'medium',
      projectId,
    });

    await repo.save(blockingTask.data());
    await repo.save(waitingTask.data());
    await repo.addDependency(waitingTask.data().id, blockingTask.data().id);

    const result = await useCase.execute(projectId, NOW);
    const blocker = result.blockers.find(b => b.task.id === blockingTask.data().id);

    expect(blocker).toBeDefined();
    expect(blocker!.nextInLine.map(t => t.id)).toContain(waitingTask.data().id);
  });

  // ── findAllDependencies is scoped to the project ─────────────────────────

  it('does not leak tasks from other projects into cockpit', async () => {
    const projectId = freshProjectId();
    const otherProjectTask = TaskEntity.create({
      title: 'External Project Task',
      status: 'blocked',
      priority: 'urgent',
      projectId: 'OTHER_PROJECT_ISOLATION',
    });
    await repo.save(otherProjectTask.data());

    const result = await useCase.execute(projectId, NOW);
    const allTaskIds = [
      ...result.blockers.map(b => b.task.id),
      ...result.focus3.map(f => f.task.id),
    ];
    expect(allTaskIds).not.toContain(otherProjectTask.data().id);
  });
});
