/**
 * useProjectTimeline (deprecated shim)
 *
 * Re-exports from the new focused hooks to preserve backward compatibility
 * for any code that still imports from this path.
 * New code should import directly from useTaskTimeline, useProjectDetail,
 * usePaymentsTimeline, or useQuotationsTimeline.
 */

export type {
  DayGroup,
  UseTaskTimelineReturn,
} from './useTaskTimeline';

export {
  getTaskDateKey,
  formatDayLabel,
  groupTasksByDay,
  useTaskTimeline,
} from './useTaskTimeline';

import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from './queryKeys';
import { useTaskTimeline } from './useTaskTimeline';
import { useProjectDetail } from './useProjectDetail';
import { ProjectDetails } from '../domain/entities/ProjectDetails';
import { Task } from '../domain/entities/Task';

export interface UseProjectTimelineReturn {
  project: ProjectDetails | null;
  dayGroups: import('./useTaskTimeline').DayGroup[];
  loading: boolean;
  error: string | null;
  markComplete: (task: Task) => Promise<void>;
  invalidateTimeline: () => Promise<void>;
}

/** @deprecated Use useTaskTimeline + useProjectDetail instead. */
export function useProjectTimeline(projectId: string): UseProjectTimelineReturn {
  const queryClient = useQueryClient();
  const { project, loading: projectLoading, error: projectError } = useProjectDetail(projectId);
  const { dayGroups, loading: tasksLoading, error: tasksError, markComplete } =
    useTaskTimeline(projectId);

  const invalidateTimeline = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.tasks(projectId) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.projectDetail(projectId) }),
    ]);
  }, [queryClient, projectId]);

  const error = tasksError ?? projectError;

  return useMemo(
    () => ({
      project,
      dayGroups,
      loading: tasksLoading || projectLoading,
      error,
      markComplete,
      invalidateTimeline,
    }),
    [project, dayGroups, tasksLoading, projectLoading, error, markComplete, invalidateTimeline],
  );
}

