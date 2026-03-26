/**
 * Custom hook for managing project data and operations
 */

import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Project } from '../domain/entities/Project';
import { ProjectDetails } from '../domain/entities/ProjectDetails';
import { ProjectRepository } from '../domain/repositories/ProjectRepository';
import { container } from 'tsyringe';
import '../infrastructure/di/registerServices';
import { CreateProjectUseCase, CreateProjectRequest } from '../application/usecases/project/CreateProjectUseCase';
import { GetProjectAnalysisUseCase } from '../application/usecases/project/GetProjectAnalysisUseCase';
import { queryKeys, invalidations } from './queryKeys';

interface UseProjectsReturn {
  projects: ProjectDetails[];
  loading: boolean;
  error: string | null;
  createProject: (request: CreateProjectRequest) => Promise<{ success: boolean; errors?: string[], projectId?: string }>;
  getProjectAnalysis: (projectId: string) => Promise<any>;
  refreshProjects: () => Promise<void>;
}

export const useProjects = (): UseProjectsReturn => {
  const queryClient = useQueryClient();

  // Resolve repository via DI container and construct use cases
  const repository = useMemo(() => container.resolve<ProjectRepository>('ProjectRepository'), []);
  const createProjectUseCase = useMemo(() => new CreateProjectUseCase(repository), [repository]);
  const getProjectAnalysisUseCase = useMemo(() => new GetProjectAnalysisUseCase(repository), [repository]);

  const {
    data: projects = [],
    isLoading: loading,
    error: queryError,
  } = useQuery<ProjectDetails[]>({
    queryKey: queryKeys.projects(),
    queryFn: async () => {
      const output = await repository.listDetails();
      return output.items;
    },
  });

  const error = queryError instanceof Error ? queryError.message : null;

  const createProject = useCallback(async (request: CreateProjectRequest) => {
    try {
      const result = await createProjectUseCase.execute(request);

      if (result.success) {
        await Promise.all(
          invalidations.projectCreated().map(key =>
            queryClient.invalidateQueries({ queryKey: key }),
          ),
        );
      }

      return {
        success: result.success,
        errors: result.errors,
        projectId: result.projectId,
      };
    } catch (err) {
      return {
        success: false,
        errors: [err instanceof Error ? err.message : 'Unknown error'],
      };
    }
  }, [createProjectUseCase, queryClient]);

  const getProjectAnalysis = useCallback(async (projectId: string) => {
    try {
      const result = await getProjectAnalysisUseCase.execute({ projectId });
      return result;
    } catch (err) {
      return {
        success: false,
        errors: [err instanceof Error ? err.message : 'Failed to analyze project'],
      };
    }
  }, [getProjectAnalysisUseCase]);

  const refreshProjects = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.projects() });
  }, [queryClient]);

  return {
    projects,
    loading,
    error,
    createProject,
    getProjectAnalysis,
    refreshProjects,
  };
};