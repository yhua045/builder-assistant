import { useCallback, useMemo, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useProjects } from './useProjects';
import { ProjectCardDto } from '../application/dtos/ProjectCardDto';
import { ProjectDetails } from '../domain/entities/ProjectDetails';

// ── Private mapping function ─────────────────────────────────────────────────

function toProjectCardDto(project: ProjectDetails): ProjectCardDto {
  return {
    id: project.id,
    owner: project.owner?.name || project.name,
    address: project.property?.address || project.location || 'No Address',
    status: project.status,
    contact: project.owner?.phone || project.owner?.email || 'No contact',
    lastCompletedTask: {
      title: 'Initial Setup',
      completedDate: project.createdAt
        ? new Date(project.createdAt).toLocaleDateString()
        : '-',
    },
    upcomingTasks: project.upcomingTasks,
  };
}

// ── Public interface ─────────────────────────────────────────────────────────

export interface ProjectsPageViewModel {
  // Data
  projectDtos: ProjectCardDto[];
  loading: boolean;
  error: string | null;
  hasProjects: boolean;

  // UI State
  createKey: number;

  // Actions
  openCreate: () => void;
  navigateToProject: (projectId: string) => void;
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useProjectsPage(): ProjectsPageViewModel {
  const { projects, loading, error } = useProjects();
  const navigation = useNavigation<any>();
  const [createKey, setCreateKey] = useState(0);

  const projectDtos = useMemo(
    () => (projects ?? []).map(toProjectCardDto),
    [projects],
  );

  const hasProjects = projectDtos.length > 0;

  const openCreate = useCallback(() => setCreateKey(k => k + 1), []);

  const navigateToProject = useCallback(
    (projectId: string) => navigation.navigate('ProjectDetail', { projectId }),
    [navigation],
  );

  return {
    projectDtos,
    loading,
    error,
    hasProjects,
    createKey,
    openCreate,
    navigateToProject,
  };
}
