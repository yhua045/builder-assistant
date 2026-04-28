/**
 * Unit tests for useProjectTimeline hook.
 *
 * Covers:
 *  - groupTasksByDay: buckets, ordering, undated tasks
 *  - formatDayLabel: correct human label
 *  - markComplete: calls update use-case and triggers correct invalidations
 */

import { act } from '@testing-library/react-native';
import { container } from 'tsyringe';
import {
  groupTasksByDay,
  formatDayLabel,
  getTaskDateKey,
  useProjectTimeline,
} from '../../hooks/useProjectTimeline';
import { Task } from '../../../../domain/entities/Task';
import { renderHookWithQuery, createTestQueryClient } from '../../../../../__tests__/utils/queryClientWrapper';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeTask(overrides: Partial<Task> & { id: string; title: string }): Task {
  return {
    status: 'pending',
    ...overrides,
  };
}

function makeTaskRepo(overrides: Record<string, jest.Mock> = {}) {
  return {
    findByProjectId: jest.fn().mockResolvedValue([]),
    findAll: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue(undefined),
    save: jest.fn().mockResolvedValue(undefined),
    findById: jest.fn().mockResolvedValue(null),
    findAdHoc: jest.fn().mockResolvedValue([]),
    findUpcoming: jest.fn().mockResolvedValue([]),
    delete: jest.fn().mockResolvedValue(undefined),
    addDependency: jest.fn().mockResolvedValue(undefined),
    removeDependency: jest.fn().mockResolvedValue(undefined),
    findDependencies: jest.fn().mockResolvedValue([]),
    findDependents: jest.fn().mockResolvedValue([]),
    findAllDependencies: jest.fn().mockResolvedValue([]),
    addDelayReason: jest.fn().mockResolvedValue({ id: 'dr-1' }),
    removeDelayReason: jest.fn().mockResolvedValue(undefined),
    resolveDelayReason: jest.fn().mockResolvedValue(undefined),
    findDelayReasons: jest.fn().mockResolvedValue([]),
    summarizeDelayReasons: jest.fn().mockResolvedValue([]),
    deleteDependenciesByTaskId: jest.fn().mockResolvedValue(undefined),
    deleteDelayReasonsByTaskId: jest.fn().mockResolvedValue(undefined),
    findProgressLogs: jest.fn().mockResolvedValue([]),
    addProgressLog: jest.fn().mockResolvedValue({ id: 'pl-1' }),
    updateProgressLog: jest.fn().mockResolvedValue(undefined),
    deleteProgressLog: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeProjectRepo(overrides: Record<string, jest.Mock> = {}) {
  return {
    findDetailsById: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockResolvedValue(undefined),
    findById: jest.fn().mockResolvedValue(null),
    findByExternalId: jest.fn().mockResolvedValue(null),
    list: jest.fn().mockResolvedValue({ items: [], meta: { total: 0 } }),
    count: jest.fn().mockResolvedValue(0),
    findByStatus: jest.fn().mockResolvedValue([]),
    findByPropertyId: jest.fn().mockResolvedValue([]),
    findByOwnerId: jest.fn().mockResolvedValue([]),
    findByPhaseDateRange: jest.fn().mockResolvedValue([]),
    findWithUpcomingPhases: jest.fn().mockResolvedValue([]),
    delete: jest.fn().mockResolvedValue(undefined),
    listDetails: jest.fn().mockResolvedValue({ items: [], meta: { total: 0 } }),
    withTransaction: jest.fn().mockImplementation((work: any) => work()),
    ...overrides,
  };
}

// ─── Pure function tests ──────────────────────────────────────────────────────

describe('getTaskDateKey', () => {
  it('returns ISO date from scheduledAt', () => {
    const task = makeTask({ id: 't1', title: 'T', scheduledAt: '2024-12-20T10:00:00.000Z' });
    expect(getTaskDateKey(task)).toBe('2024-12-20');
  });

  it('falls back to dueDate when scheduledAt is absent', () => {
    const task = makeTask({ id: 't1', title: 'T', dueDate: '2024-12-25T00:00:00.000Z' });
    expect(getTaskDateKey(task)).toBe('2024-12-25');
  });

  it('returns null when neither field is set', () => {
    const task = makeTask({ id: 't1', title: 'T' });
    expect(getTaskDateKey(task)).toBeNull();
  });
});

describe('formatDayLabel', () => {
  it('formats a date key', () => {
    // 2024-12-20 is a Friday
    const label = formatDayLabel('2024-12-20');
    expect(label).toMatch(/20/);
    expect(label).toMatch(/Dec/);
    expect(label).toMatch(/Fri/);
  });
});

describe('groupTasksByDay', () => {
  it('groups tasks into separate day buckets', () => {
    const tasks = [
      makeTask({ id: 't1', title: 'A', scheduledAt: '2024-12-20T09:00:00Z' }),
      makeTask({ id: 't2', title: 'B', scheduledAt: '2024-12-20T14:00:00Z' }),
      makeTask({ id: 't3', title: 'C', scheduledAt: '2024-12-28T09:00:00Z' }),
    ];
    const groups = groupTasksByDay(tasks);
    expect(groups).toHaveLength(2);
    expect(groups[0].date).toBe('2024-12-20');
    expect(groups[0].tasks).toHaveLength(2);
    expect(groups[1].date).toBe('2024-12-28');
    expect(groups[1].tasks).toHaveLength(1);
  });

  it('sorts tasks within a day bucket by scheduledAt ascending', () => {
    const tasks = [
      makeTask({ id: 't1', title: 'Late',  scheduledAt: '2024-12-20T14:00:00Z' }),
      makeTask({ id: 't2', title: 'Early', scheduledAt: '2024-12-20T09:00:00Z' }),
    ];
    const groups = groupTasksByDay(tasks);
    expect(groups[0].tasks[0].title).toBe('Early');
    expect(groups[0].tasks[1].title).toBe('Late');
  });

  it('sorts day buckets ascending by date', () => {
    const tasks = [
      makeTask({ id: 't1', title: 'B', scheduledAt: '2025-01-05T08:00:00Z' }),
      makeTask({ id: 't2', title: 'A', scheduledAt: '2024-12-20T09:00:00Z' }),
    ];
    const groups = groupTasksByDay(tasks);
    expect(groups[0].date).toBe('2024-12-20');
    expect(groups[1].date).toBe('2025-01-05');
  });

  it('appends undated tasks in a trailing bucket', () => {
    const tasks = [
      makeTask({ id: 't1', title: 'Dated',   scheduledAt: '2024-12-20T09:00:00Z' }),
      makeTask({ id: 't2', title: 'Undated' }),
    ];
    const groups = groupTasksByDay(tasks);
    expect(groups).toHaveLength(2);
    expect(groups[groups.length - 1].date).toBe('__nodate__');
    expect(groups[groups.length - 1].label).toBe('No Date');
  });

  it('returns empty array for empty input', () => {
    expect(groupTasksByDay([])).toEqual([]);
  });

  it('handles tasks using dueDate bucket when scheduledAt is absent', () => {
    const task = makeTask({ id: 't1', title: 'Due', dueDate: '2024-12-25T00:00:00Z' });
    const groups = groupTasksByDay([task]);
    expect(groups[0].date).toBe('2024-12-25');
  });
});

// ─── Hook tests ───────────────────────────────────────────────────────────────

describe('useProjectTimeline', () => {
  let taskRepo: ReturnType<typeof makeTaskRepo>;
  let projectRepo: ReturnType<typeof makeProjectRepo>;

  beforeEach(() => {
    jest.resetAllMocks();
    taskRepo = makeTaskRepo();
    projectRepo = makeProjectRepo();
    jest.spyOn(container, 'resolve').mockImplementation((token: any) => {
      if (token === 'TaskRepository') return taskRepo;
      if (token === 'ProjectRepository') return projectRepo;
      throw new Error(`Unexpected token: ${String(token)}`);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('derives dayGroups from fetched tasks', async () => {
    const tasks: Task[] = [
      makeTask({ id: 't1', title: 'T1', scheduledAt: '2024-12-20T09:00:00Z' }),
      makeTask({ id: 't2', title: 'T2', scheduledAt: '2024-12-20T14:00:00Z' }),
      makeTask({ id: 't3', title: 'T3', scheduledAt: '2024-12-28T09:00:00Z' }),
    ];
    taskRepo.findByProjectId.mockResolvedValue(tasks);

    const qc = createTestQueryClient();
    const { result } = renderHookWithQuery(() => useProjectTimeline('proj-1'), qc);

    await act(async () => {
      await new Promise<void>((r) => setTimeout(r, 100));
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.dayGroups).toHaveLength(2);
    expect(result.current.dayGroups[0].tasks).toHaveLength(2);
  });

  it('markComplete calls update and invalidates tasks + taskDetail', async () => {
    const task = makeTask({ id: 'task-99', title: 'Test', projectId: 'proj-1' });
    taskRepo.findByProjectId.mockResolvedValue([task]);
    taskRepo.findById.mockResolvedValue(task);

    const qc = createTestQueryClient();
    const invalidateSpy = jest.spyOn(qc, 'invalidateQueries');

    const { result } = renderHookWithQuery(() => useProjectTimeline('proj-1'), qc);

    await act(async () => {
      await new Promise<void>((r) => setTimeout(r, 100));
    });

    await act(async () => {
      await result.current.markComplete(task);
    });

    expect(taskRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'task-99', status: 'completed' }),
    );

    // Should have invalidated ['tasks', 'proj-1'] and ['taskDetail', 'task-99']
    const invalidatedKeys = invalidateSpy.mock.calls.map((c) => c[0]?.queryKey);
    expect(invalidatedKeys).toContainEqual(['tasks', 'proj-1']);
    expect(invalidatedKeys).toContainEqual(['taskDetail', 'task-99']);
  });
});
