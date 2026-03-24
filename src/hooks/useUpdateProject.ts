/**
 * useUpdateProject
 *
 * Mutation hook that delegates to UpdateProjectUseCase and invalidates
 * all query keys affected by a project edit (projects list, overview, detail).
 *
 * Issue #176 — Track D
 */

import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { container } from 'tsyringe';
import { ProjectRepository } from '../domain/repositories/ProjectRepository';
import {
  UpdateProjectUseCase,
  UpdateProjectRequest,
  UpdateProjectResponse,
} from '../application/usecases/project/UpdateProjectUseCase';
import { invalidations } from './queryKeys';
import '../infrastructure/di/registerServices';

export interface UseUpdateProjectReturn {
  updateProject: (request: UpdateProjectRequest) => Promise<UpdateProjectResponse>;
  loading: boolean;
}

export function useUpdateProject(): UseUpdateProjectReturn {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);

  const repository = useMemo(
    () => container.resolve<ProjectRepository>('ProjectRepository'),
    [],
  );

  const useCase = useMemo(() => new UpdateProjectUseCase(repository), [repository]);

  const updateProject = useCallback(
    async (request: UpdateProjectRequest): Promise<UpdateProjectResponse> => {
      setLoading(true);
      try {
        const result = await useCase.execute(request);

        if (result.success) {
          await Promise.all(
            invalidations
              .projectEdited({ projectId: request.projectId })
              .map(key => queryClient.invalidateQueries({ queryKey: key })),
          );
        }

        return result;
      } finally {
        setLoading(false);
      }
    },
    [useCase, queryClient],
  );

  return { updateProject, loading };
}
