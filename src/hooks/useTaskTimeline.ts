/**
 * useTaskTimeline
 *
 * Fetches tasks for a project, groups them into day buckets (DayGroup[]),
 * and exposes a markComplete mutation that follows the established
 * invalidations.taskEdited() pattern from queryKeys.ts.
 *
 * Cache strategy: reuses queryKeys.tasks(projectId) so any mutation in
 * useTasks (create/update/delete) automatically refreshes this hook.
 */

import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { container } from 'tsyringe';
import { Task } from '../domain/entities/Task';
import { TaskRepository } from '../domain/repositories/TaskRepository';
import { ListTasksUseCase } from '../application/usecases/task/ListTasksUseCase';
import { UpdateTaskUseCase } from '../application/usecases/task/UpdateTaskUseCase';
import { queryKeys, invalidations } from './queryKeys';
import '../infrastructure/di/registerServices';

// ─── Public types ─────────────────────────────────────────────────────────────

/** A single day bucket with its tasks sorted by scheduledAt / dueDate asc. */
export interface DayGroup {
  /** ISO date string YYYY-MM-DD */
  date: string;
  /** Human-readable label, e.g. "Thu 20 Dec" */
  label: string;
  tasks: Task[];
}

export interface UseTaskTimelineReturn {
  dayGroups: DayGroup[];
  loading: boolean;
  error: string | null;
  markComplete: (task: Task) => Promise<void>;
  invalidate: () => Promise<void>;
}

// ─── Pure grouping helpers (exported for unit testing) ───────────────────────

/** Extract a YYYY-MM-DD bucket key from a task using scheduledAt ?? dueDate. */
export function getTaskDateKey(task: Task): string | null {
  const raw = task.scheduledAt ?? task.dueDate;
  if (!raw) return null;
  return raw.slice(0, 10); // ISO date prefix
}

/** Format a YYYY-MM-DD string as "Thu 20 Dec". */
export function formatDayLabel(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  const weekday = d.toLocaleDateString('en-AU', { weekday: 'short', timeZone: 'UTC' });
  const day = d.getUTCDate();
  const month = d.toLocaleDateString('en-AU', { month: 'short', timeZone: 'UTC' });
  return `${weekday} ${day} ${month}`;
}

/** Group and sort tasks into DayGroup[]. Tasks with no date go to a trailing "No Date" bucket. */
export function groupTasksByDay(tasks: Task[]): DayGroup[] {
  const buckets = new Map<string, Task[]>();

  for (const task of tasks) {
    const key = getTaskDateKey(task) ?? '__nodate__';
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(task);
  }

  const sortKey = (task: Task): number => {
    const raw = task.scheduledAt ?? task.dueDate;
    return raw ? new Date(raw).getTime() : 0;
  };

  const groups: DayGroup[] = [];

  const dateBuckets = [...buckets.entries()]
    .filter(([k]) => k !== '__nodate__')
    .sort(([a], [b]) => a.localeCompare(b));

  for (const [date, tasksInBucket] of dateBuckets) {
    groups.push({
      date,
      label: formatDayLabel(date),
      tasks: [...tasksInBucket].sort((a, b) => sortKey(a) - sortKey(b)),
    });
  }

  const undated = buckets.get('__nodate__');
  if (undated?.length) {
    groups.push({ date: '__nodate__', label: 'No Date', tasks: undated });
  }

  return groups;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useTaskTimeline(projectId: string): UseTaskTimelineReturn {
  const queryClient = useQueryClient();

  const taskRepository = useMemo(
    () => container.resolve<TaskRepository>('TaskRepository'),
    [],
  );

  const listUseCase = useMemo(
    () => new ListTasksUseCase(taskRepository),
    [taskRepository],
  );
  const updateUseCase = useMemo(
    () => new UpdateTaskUseCase(taskRepository),
    [taskRepository],
  );

  const {
    data: tasks = [],
    isLoading,
    error: queryError,
  } = useQuery<Task[]>({
    queryKey: queryKeys.tasks(projectId),
    queryFn: () => listUseCase.execute(projectId),
    staleTime: 30_000,
    enabled: Boolean(projectId),
  });

  const dayGroups = useMemo(() => groupTasksByDay(tasks), [tasks]);

  const markComplete = useCallback(
    async (task: Task) => {
      const updated: Task = { ...task, status: 'completed', completedAt: new Date().toISOString() };
      await updateUseCase.execute(updated);
      await Promise.all(
        invalidations
          .taskEdited({ projectId, taskId: task.id })
          .map((key) => queryClient.invalidateQueries({ queryKey: key })),
      );
    },
    [updateUseCase, queryClient, projectId],
  );

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.tasks(projectId) });
  }, [queryClient, projectId]);

  const error = queryError instanceof Error
    ? queryError.message
    : queryError ? String(queryError) : null;

  return useMemo(
    () => ({ dayGroups, loading: isLoading, error, markComplete, invalidate }),
    [dayGroups, isLoading, error, markComplete, invalidate],
  );
}
