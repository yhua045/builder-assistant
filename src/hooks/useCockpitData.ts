import { useState, useEffect, useCallback, useMemo } from 'react';
import { container } from 'tsyringe';
import '../infrastructure/di/registerServices';
import { TaskRepository } from '../domain/repositories/TaskRepository';
import { CockpitData } from '../domain/entities/CockpitData';
import { GetCockpitDataUseCase } from '../application/usecases/task/GetCockpitDataUseCase';

export interface UseCockpitDataReturn {
  cockpit: CockpitData | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * Provides blockers + focus3 for a given project.
 * Delegates to GetCockpitDataUseCase which does the score computation in-process.
 */
export function useCockpitData(projectId: string): UseCockpitDataReturn {
  const [cockpit, setCockpit] = useState<CockpitData | null>(null);
  const [loading, setLoading] = useState(true);

  const taskRepository = useMemo(
    () => container.resolve<TaskRepository>('TaskRepository'),
    [],
  );

  const useCase = useMemo(
    () => new GetCockpitDataUseCase(taskRepository),
    [taskRepository],
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const result = await useCase.execute(projectId);
      setCockpit(result);
    } catch (error) {
      console.error('[useCockpitData] Failed to load cockpit data', error);
    } finally {
      setLoading(false);
    }
  }, [useCase, projectId]);

  useEffect(() => {
    if (projectId) {
      refresh();
    }
  }, [projectId, refresh]);

  return { cockpit, loading, refresh };
}
