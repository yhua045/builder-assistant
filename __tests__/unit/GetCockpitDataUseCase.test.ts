/**
 * Unit tests for GetCockpitDataUseCase.
 * Uses a mock TaskRepository — no database involved.
 * TDD: written BEFORE the implementation (red phase).
 * Run: npx jest GetCockpitDataUseCase
 */

import { GetCockpitDataUseCase } from '../../src/application/usecases/task/GetCockpitDataUseCase';
import { Task } from '../../src/domain/entities/Task';
import { TaskRepository } from '../../src/domain/repositories/TaskRepository';

// ─── Mock Repository Factory ──────────────────────────────────────────────────

type DependencyEdge = { taskId: string; dependsOnTaskId: string };

function makeMockRepo(tasks: Task[], edges: DependencyEdge[] = []): TaskRepository {
  return {
    save: jest.fn(),
    findById: jest.fn(async (id) => tasks.find(t => t.id === id) ?? null),
    findAll: jest.fn(async () => tasks),
    findByProjectId: jest.fn(async (projectId) =>
      tasks.filter(t => t.projectId === projectId)
    ),
    findAdHoc: jest.fn(async () => tasks.filter(t => !t.projectId)),
    findUpcoming: jest.fn(async () => []),
    update: jest.fn(),
    delete: jest.fn(),
    addDependency: jest.fn(),
    removeDependency: jest.fn(),
    findDependencies: jest.fn(async (taskId) => {
      const depIds = edges.filter(e => e.taskId === taskId).map(e => e.dependsOnTaskId);
      return tasks.filter(t => depIds.includes(t.id));
    }),
    findDependents: jest.fn(async (taskId) => {
      const depIds = edges.filter(e => e.dependsOnTaskId === taskId).map(e => e.taskId);
      return tasks.filter(t => depIds.includes(t.id));
    }),
    findAllDependencies: jest.fn(async (_projectId) => edges),
    addDelayReason: jest.fn(),
    removeDelayReason: jest.fn(),
    resolveDelayReason: jest.fn(),
    findDelayReasons: jest.fn(async () => []),
    summarizeDelayReasons: jest.fn(async () => []),
    deleteDependenciesByTaskId: jest.fn(),
    deleteDelayReasonsByTaskId: jest.fn(),
  } as unknown as TaskRepository;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PROJECT_ID = 'proj_test';
const NOW = new Date('2026-03-05T10:00:00.000Z');

function daysFromNow(n: number, base = NOW): string {
  return new Date(base.getTime() + n * 24 * 60 * 60 * 1000).toISOString();
}

let idCounter = 0;
function makeTask(overrides: Partial<Task>): Task {
  idCounter++;
  return {
    id: `task_${idCounter}`,
    title: `Task ${idCounter}`,
    status: 'pending',
    projectId: PROJECT_ID,
    ...overrides,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GetCockpitDataUseCase', () => {
  beforeEach(() => { idCounter = 0; });

  it('returns empty cockpit when project has no tasks', async () => {
    const repo = makeMockRepo([]);
    const uc = new GetCockpitDataUseCase(repo);
    const result = await uc.execute(PROJECT_ID, NOW);
    expect(result.blockers).toHaveLength(0);
    expect(result.focus3).toHaveLength(0);
  });

  it('returns empty cockpit when all tasks are completed', async () => {
    const tasks = [
      makeTask({ status: 'completed' }),
      makeTask({ status: 'completed' }),
    ];
    const repo = makeMockRepo(tasks);
    const uc = new GetCockpitDataUseCase(repo);
    const result = await uc.execute(PROJECT_ID, NOW);
    expect(result.blockers).toHaveLength(0);
    expect(result.focus3).toHaveLength(0);
  });

  // ── Blocker Bar ──────────────────────────────────────────────────────────────

  describe('blockers', () => {
    it('includes a manually blocked task (status=blocked)', async () => {
      const blocked = makeTask({ status: 'blocked', priority: 'high' });
      const normal = makeTask({ status: 'pending', priority: 'low' });
      const repo = makeMockRepo([blocked, normal]);
      const uc = new GetCockpitDataUseCase(repo);
      const { blockers } = await uc.execute(PROJECT_ID, NOW);
      expect(blockers.map(b => b.task.id)).toContain(blocked.id);
    });

    it('excludes a completed or cancelled task from blockers', async () => {
      const done = makeTask({ status: 'completed' });
      const gone = makeTask({ status: 'cancelled' });
      const repo = makeMockRepo([done, gone]);
      const uc = new GetCockpitDataUseCase(repo);
      const { blockers } = await uc.execute(PROJECT_ID, NOW);
      expect(blockers).toHaveLength(0);
    });

    it('auto-blocks a task whose prerequisite is overdue', async () => {
      const prereq = makeTask({ id: 'prereq', status: 'in_progress', dueDate: daysFromNow(-5) });
      const dependent = makeTask({ id: 'dep', status: 'pending' });
      const edges: DependencyEdge[] = [{ taskId: dependent.id, dependsOnTaskId: prereq.id }];
      const repo = makeMockRepo([prereq, dependent], edges);
      const uc = new GetCockpitDataUseCase(repo);
      const { blockers } = await uc.execute(PROJECT_ID, NOW);
      const item = blockers.find(b => b.task.id === dependent.id);
      expect(item).toBeDefined();
      expect(item!.severity).toBe('red');
      expect(item!.blockedPrereqs.map(p => p.id)).toContain(prereq.id);
    });

    it('does NOT auto-block when prerequisite is completed', async () => {
      const prereq = makeTask({ status: 'completed', dueDate: daysFromNow(-5) });
      const dependent = makeTask({ id: 'dep2', status: 'pending' });
      const edges: DependencyEdge[] = [{ taskId: dependent.id, dependsOnTaskId: prereq.id }];
      const repo = makeMockRepo([prereq, dependent], edges);
      const uc = new GetCockpitDataUseCase(repo);
      const { blockers } = await uc.execute(PROJECT_ID, NOW);
      expect(blockers.map(b => b.task.id)).not.toContain(dependent.id);
    });

    it('blocker items include nextInLine tasks', async () => {
      const blocked = makeTask({ id: 'blocked', status: 'blocked' });
      const waitingOn = makeTask({ id: 'waiting', status: 'pending' });
      const edges: DependencyEdge[] = [{ taskId: waitingOn.id, dependsOnTaskId: blocked.id }];
      const repo = makeMockRepo([blocked, waitingOn], edges);
      const uc = new GetCockpitDataUseCase(repo);
      const { blockers } = await uc.execute(PROJECT_ID, NOW);
      const item = blockers.find(b => b.task.id === blocked.id);
      expect(item).toBeDefined();
      expect(item!.nextInLine.map(t => t.id)).toContain(waitingOn.id);
    });

    it('uses findAllDependencies (batch query, not per-task)', async () => {
      const t = makeTask({ status: 'blocked' });
      const repo = makeMockRepo([t]);
      const uc = new GetCockpitDataUseCase(repo);
      await uc.execute(PROJECT_ID, NOW);
      // findAllDependencies should be called once; findDependencies (per-task) should NOT
      expect(repo.findAllDependencies).toHaveBeenCalledTimes(1);
      expect(repo.findDependencies).not.toHaveBeenCalled();
    });
  });

  // ── Focus-3 ──────────────────────────────────────────────────────────────────

  describe('focus3', () => {
    it('returns at most 3 items', async () => {
      const tasks = Array.from({ length: 8 }, () =>
        makeTask({ priority: 'medium', dueDate: daysFromNow(3) })
      );
      const repo = makeMockRepo(tasks);
      const uc = new GetCockpitDataUseCase(repo);
      const { focus3 } = await uc.execute(PROJECT_ID, NOW);
      expect(focus3.length).toBeLessThanOrEqual(3);
    });

    it('excludes completed and cancelled from focus3', async () => {
      const active = makeTask({ status: 'pending', priority: 'urgent' });
      const done = makeTask({ status: 'completed', priority: 'urgent' });
      const tasks = [active, done];
      const repo = makeMockRepo(tasks);
      const uc = new GetCockpitDataUseCase(repo);
      const { focus3 } = await uc.execute(PROJECT_ID, NOW);
      expect(focus3.map(f => f.task.id)).toContain(active.id);
      expect(focus3.map(f => f.task.id)).not.toContain(done.id);
    });

    it('ranks urgent + overdue task above low + future task', async () => {
      const topTask = makeTask({ id: 'top', priority: 'urgent', dueDate: daysFromNow(-3) });
      const bottomTask = makeTask({ id: 'bottom', priority: 'low', dueDate: daysFromNow(14) });
      const repo = makeMockRepo([bottomTask, topTask]); // reversed insert order
      const uc = new GetCockpitDataUseCase(repo);
      const { focus3 } = await uc.execute(PROJECT_ID, NOW);
      expect(focus3[0].task.id).toBe('top');
    });

    it('isCriticalPath task outranks a high-priority task without the flag', async () => {
      const critical = makeTask({ id: 'crit', priority: 'low', isCriticalPath: true });
      const highPri = makeTask({ id: 'high', priority: 'high', dueDate: daysFromNow(1) });
      const repo = makeMockRepo([highPri, critical]);
      const uc = new GetCockpitDataUseCase(repo);
      const { focus3 } = await uc.execute(PROJECT_ID, NOW);
      expect(focus3[0].task.id).toBe('crit');
    });

    it('each focus item has a populated urgencyLabel', async () => {
      const t = makeTask({ priority: 'high', dueDate: daysFromNow(-2) });
      const repo = makeMockRepo([t]);
      const uc = new GetCockpitDataUseCase(repo);
      const { focus3 } = await uc.execute(PROJECT_ID, NOW);
      expect(focus3[0].urgencyLabel).toBe('🔴 2d overdue');
    });

    it('focus item urgencyLabel is empty string when no dueDate', async () => {
      const t = makeTask({ priority: 'high' }); // no dueDate
      const repo = makeMockRepo([t]);
      const uc = new GetCockpitDataUseCase(repo);
      const { focus3 } = await uc.execute(PROJECT_ID, NOW);
      expect(focus3[0].urgencyLabel).toBe('');
    });
  });

  // ── Project Scoping ───────────────────────────────────────────────────────────

  describe('project scoping', () => {
    it('only processes tasks for the requested projectId', async () => {
      const inProject = makeTask({ status: 'blocked', projectId: PROJECT_ID });
      const otherProject = makeTask({ status: 'blocked', projectId: 'other_proj' });
      const repo = makeMockRepo([inProject, otherProject]);

      // findByProjectId already filters by project; this verifies the use case
      // passes projectId down correctly
      const uc = new GetCockpitDataUseCase(repo);
      await uc.execute(PROJECT_ID, NOW);

      expect(repo.findByProjectId).toHaveBeenCalledWith(PROJECT_ID);
    });

    it('passes projectId to findAllDependencies', async () => {
      const t = makeTask({ status: 'pending' });
      const repo = makeMockRepo([t]);
      const uc = new GetCockpitDataUseCase(repo);
      await uc.execute(PROJECT_ID, NOW);
      expect(repo.findAllDependencies).toHaveBeenCalledWith(PROJECT_ID);
    });
  });
});
