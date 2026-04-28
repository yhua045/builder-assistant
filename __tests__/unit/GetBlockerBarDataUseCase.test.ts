/**
 * Unit tests for GetBlockerBarDataUseCase (TDD — written before implementation).
 *
 * Strategy:
 *   - Mock TaskRepository to control per-project task/dependency data.
 *   - Assert BlockerBarResult discriminated union output.
 *
 * Run: npx jest GetBlockerBarDataUseCase
 */

import { GetBlockerBarDataUseCase } from '../../src/features/tasks/application/GetBlockerBarDataUseCase';
import { TaskRepository } from '../../src/domain/repositories/TaskRepository';
import { Task } from '../../src/domain/entities/Task';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NOW = new Date('2026-03-05T10:00:00.000Z');

// taskIdCounter not needed
function makeTask(overrides: Partial<Task> & Pick<Task, 'id'>): Task {
  return {
    title: `Task ${overrides.id}`,
    status: 'pending',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeBlockedTask(id: string): Task {
  return makeTask({ id, status: 'blocked' });
}

function makePendingTask(id: string): Task {
  return makeTask({ id, status: 'pending' });
}

type ProjectSummary = { id: string; name: string };

// ─── Mock factory ─────────────────────────────────────────────────────────────

/**
 * Builds a mock TaskRepository that serves per-project task data.
 *
 * projectTaskMap: Record<projectId, Task[]>
 * No dependency edges are needed for manually-blocked tasks.
 */
function makeMockRepo(
  projectTaskMap: Record<string, Task[]>,
): jest.Mocked<Pick<TaskRepository, 'findByProjectId' | 'findAllDependencies'>> {
  return {
    findByProjectId: jest.fn().mockImplementation((projectId: string) => {
      return Promise.resolve(projectTaskMap[projectId] ?? []);
    }),
    findAllDependencies: jest.fn().mockResolvedValue([]),
  } as unknown as jest.Mocked<Pick<TaskRepository, 'findByProjectId' | 'findAllDependencies'>>;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GetBlockerBarDataUseCase', () => {
  // ── UC-1 ──
  describe('UC-1: single project with active blockers', () => {
    it('returns kind=blockers with projectId and blocker items', async () => {
      const blockedTask = makeBlockedTask('t1');
      const repo = makeMockRepo({ 'p1': [blockedTask] });
      const useCase = new GetBlockerBarDataUseCase(repo as unknown as TaskRepository);

      const result = await useCase.execute([{ id: 'p1', name: 'Reno A' }], NOW);

      expect(result.kind).toBe('blockers');
      if (result.kind === 'blockers') {
        expect(result.projectId).toBe('p1');
        expect(result.projectName).toBe('Reno A');
        expect(result.blockers).toHaveLength(1);
        expect(result.blockers[0].task.id).toBe('t1');
      }
    });
  });

  // ── UC-2 ──
  describe('UC-2: first project healthy, second has blockers', () => {
    it('falls back to second project and returns its blockers', async () => {
      const healthyTask = makePendingTask('t-healthy');
      const blockedTask = makeBlockedTask('t-blocked');
      const repo = makeMockRepo({
        'p1': [healthyTask],
        'p2': [blockedTask],
      });
      const useCase = new GetBlockerBarDataUseCase(repo as unknown as TaskRepository);

      const projects: ProjectSummary[] = [
        { id: 'p1', name: 'Project A' },
        { id: 'p2', name: 'Project B' },
      ];
      const result = await useCase.execute(projects, NOW);

      expect(result.kind).toBe('blockers');
      if (result.kind === 'blockers') {
        expect(result.projectId).toBe('p2');
        expect(result.projectName).toBe('Project B');
        expect(result.blockers[0].task.id).toBe('t-blocked');
      }
    });
  });

  // ── UC-3 ──
  describe('UC-3: all projects healthy — no blockers anywhere', () => {
    it('returns kind=winning', async () => {
      const repo = makeMockRepo({
        'p1': [makePendingTask('t1')],
        'p2': [makePendingTask('t2')],
      });
      const useCase = new GetBlockerBarDataUseCase(repo as unknown as TaskRepository);

      const result = await useCase.execute(
        [{ id: 'p1', name: 'A' }, { id: 'p2', name: 'B' }],
        NOW,
      );

      expect(result).toEqual({ kind: 'winning' });
    });
  });

  // ── UC-4 ──
  describe('UC-4: empty project list', () => {
    it('returns kind=winning when no projects', async () => {
      const repo = makeMockRepo({});
      const useCase = new GetBlockerBarDataUseCase(repo as unknown as TaskRepository);

      const result = await useCase.execute([], NOW);

      expect(result).toEqual({ kind: 'winning' });
    });
  });

  // ── UC-5 ──
  describe('UC-5: first project has blockers — short-circuits, does not query p2', () => {
    it('stops iterating after the first project with blockers', async () => {
      const blockedTask = makeBlockedTask('t-p1');
      const repo = makeMockRepo({
        'p1': [blockedTask],
        'p2': [makeBlockedTask('t-p2')],
      });
      const useCase = new GetBlockerBarDataUseCase(repo as unknown as TaskRepository);

      const result = await useCase.execute(
        [{ id: 'p1', name: 'First' }, { id: 'p2', name: 'Second' }],
        NOW,
      );

      expect(result.kind).toBe('blockers');
      if (result.kind === 'blockers') {
        expect(result.projectId).toBe('p1');
      }
      // p2 should not have been queried
      const findCalls = (repo.findByProjectId as jest.Mock).mock.calls.map(c => c[0]);
      expect(findCalls).toContain('p1');
      expect(findCalls).not.toContain('p2');
    });
  });

  // ── UC-6 ──
  describe('UC-6: project with only completed/cancelled tasks is skipped', () => {
    it('treats completed/cancelled tasks as no blockers and falls through', async () => {
      const completedTask = makeTask({ id: 't-done', status: 'completed' });
      const cancelledTask = makeTask({ id: 't-cancel', status: 'cancelled' });
      const blockedTask = makeBlockedTask('t-blocked');

      const repo = makeMockRepo({
        'p1': [completedTask, cancelledTask],
        'p2': [blockedTask],
      });
      const useCase = new GetBlockerBarDataUseCase(repo as unknown as TaskRepository);

      const result = await useCase.execute(
        [{ id: 'p1', name: 'Done Project' }, { id: 'p2', name: 'Active Project' }],
        NOW,
      );

      expect(result.kind).toBe('blockers');
      if (result.kind === 'blockers') {
        expect(result.projectId).toBe('p2');
      }
    });
  });

  // ── UC-7 ──
  describe('UC-7: project with auto-derived blocker via overdue prerequisite', () => {
    it('detects blockers derived from overdue dependencies', async () => {
      // t-downstream depends on t-prereq which is overdue by 5 days
      const overduePrereq = makeTask({
        id: 't-prereq',
        status: 'in_progress',
        dueDate: new Date(NOW.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString(),
      });
      const downstream = makeTask({ id: 't-downstream', status: 'in_progress' });

      const repo = {
        findByProjectId: jest.fn().mockResolvedValue([overduePrereq, downstream]),
        findAllDependencies: jest.fn().mockResolvedValue([
          { taskId: 't-downstream', dependsOnTaskId: 't-prereq' },
        ]),
      } as unknown as TaskRepository;

      const useCase = new GetBlockerBarDataUseCase(repo);

      const result = await useCase.execute([{ id: 'p1', name: 'Build' }], NOW);

      expect(result.kind).toBe('blockers');
      if (result.kind === 'blockers') {
        expect(result.blockers.some(b => b.task.id === 't-downstream')).toBe(true);
      }
    });
  });
});
