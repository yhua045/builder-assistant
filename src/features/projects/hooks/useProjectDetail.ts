/**
 * useProjectDetail
 *
 * Fetches the hydrated ProjectDetails for a single project.
 * Cache key: queryKeys.projectDetail(projectId)
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { container } from 'tsyringe';
import { ProjectDetails } from '../../../domain/entities/ProjectDetails';
import { ProjectRepository } from '../../../domain/repositories/ProjectRepository';
import { queryKeys } from '../../../hooks/queryKeys';
import '../../../infrastructure/di/registerServices';

export interface UseProjectDetailReturn {
  project: ProjectDetails | null;
  loading: boolean;
  error: string | null;
}

export function useProjectDetail(projectId: string): UseProjectDetailReturn {
  const projectRepository = useMemo(
    () => container.resolve<ProjectRepository>('ProjectRepository'),
    [],
  );

  const {
    data: project = null,
    isLoading,
    error: queryError,
  } = useQuery<ProjectDetails | null>({
    queryKey: queryKeys.projectDetail(projectId),
    queryFn: () => projectRepository.findDetailsById(projectId),
    staleTime: 60_000,
    enabled: Boolean(projectId),
  });

  const error = queryError instanceof Error
    ? queryError.message
    : queryError ? String(queryError) : null;

  return useMemo(
    () => ({ project, loading: isLoading, error }),
    [project, isLoading, error],
  );
}
