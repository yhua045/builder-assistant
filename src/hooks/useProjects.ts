/**
 * Custom hook for managing project data and operations
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Project } from '../domain/entities/Project';
import { DrizzleProjectRepository } from '../infrastructure/repositories/DrizzleProjectRepository';
import { CreateProjectUseCase, CreateProjectRequest } from '../application/usecases/CreateProjectUseCase';
import { GetProjectAnalysisUseCase } from '../application/usecases/GetProjectAnalysisUseCase';

interface UseProjectsReturn {
  projects: Project[];
  loading: boolean;
  error: string | null;
  createProject: (request: CreateProjectRequest) => Promise<{ success: boolean; errors?: string[] }>;
  getProjectAnalysis: (projectId: string) => Promise<any>;
  refreshProjects: () => Promise<void>;
}

export const useProjects = (): UseProjectsReturn => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize Drizzle repository (with automatic migrations) and use cases
  const repository = useMemo(() => new DrizzleProjectRepository(), []);
  const createProjectUseCase = useMemo(() => new CreateProjectUseCase(repository), [repository]);
  const getProjectAnalysisUseCase = useMemo(() => new GetProjectAnalysisUseCase(repository), [repository]);

  const loadProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const projectList = await repository.findAll();
      setProjects(projectList);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects');
    } finally {
      setLoading(false);
    }
  }, [repository]);

  const createProject = useCallback(async (request: CreateProjectRequest) => {
    try {
      const result = await createProjectUseCase.execute(request);
      
      if (result.success) {
        // Refresh projects list
        await loadProjects();
      }
      
      return {
        success: result.success,
        errors: result.errors
      };
    } catch (err) {
      return {
        success: false,
        errors: [err instanceof Error ? err.message : 'Unknown error']
      };
    }
  }, [createProjectUseCase, loadProjects]);

  const getProjectAnalysis = useCallback(async (projectId: string) => {
    try {
      const result = await getProjectAnalysisUseCase.execute({ projectId });
      return result;
    } catch (err) {
      return {
        success: false,
        errors: [err instanceof Error ? err.message : 'Failed to analyze project']
      };
    }
  }, [getProjectAnalysisUseCase]);

  const refreshProjects = useCallback(async () => {
    await loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  return {
    projects,
    loading,
    error,
    createProject,
    getProjectAnalysis,
    refreshProjects
  };
};