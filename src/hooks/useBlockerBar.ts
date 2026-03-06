import { useState, useEffect, useCallback, useMemo } from 'react';
import { container } from 'tsyringe';
import '../infrastructure/di/registerServices';
import { TaskRepository } from '../domain/repositories/TaskRepository';
import { BlockerBarResult } from '../domain/entities/CockpitData';
import { Project } from '../domain/entities/Project';
import {
  GetBlockerBarDataUseCase,
  ProjectSummary,
} from '../application/usecases/task/GetBlockerBarDataUseCase';

export interface UseBlockerBarReturn {
  result: BlockerBarResult | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Computes the Blocker Bar data across all supplied projects.
 *
 * Iterates `projects` in order, returning the first project that has active
 * blockers. If no project has blockers, returns `{ kind: 'winning' }`.
 *
 * The result is read-only — no persistent default project is modified.
 */
export function useBlockerBar(projects: Project[]): UseBlockerBarReturn {
  const [result, setResult] = useState<BlockerBarResult | null>(null);
  const [loading, setLoading] = useState(true);

  const taskRepository = useMemo(
    () => container.resolve<TaskRepository>('TaskRepository'),
    [],
  );

  const useCase = useMemo(
    () => new GetBlockerBarDataUseCase(taskRepository),
    [taskRepository],
  );

  // Stable key: re-run only when the ordered project id-list changes
  const projectIdList = useMemo(
    () => projects.map(p => p.id).join(','),
    [projects],
  );

  const orderedProjects = useMemo(
    (): ProjectSummary[] => projects.map(p => ({ id: p.id, name: p.name })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [projectIdList],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await useCase.execute(orderedProjects);
      setResult(data);
    } catch (error) {
      console.error('[useBlockerBar] Failed to compute blocker bar data', error);
    } finally {
      setLoading(false);
    }
  }, [useCase, orderedProjects]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { result, loading, refresh };
}
