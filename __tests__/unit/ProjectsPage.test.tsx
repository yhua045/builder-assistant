import React from 'react';
import renderer from 'react-test-renderer';
import ProjectsPage from '../../src/pages/projects/ProjectsPage';
import { useProjects } from '../../src/hooks/useProjects';
import { ProjectStatus } from '../../src/domain/entities/Project';

jest.mock('../../src/hooks/useProjects');

const mockedUseProjects = useProjects as jest.MockedFunction<typeof useProjects>;

describe('ProjectsPage', () => {
  beforeEach(() => {
    mockedUseProjects.mockReset();
  });

  it('renders loading state', () => {
    mockedUseProjects.mockReturnValue({
      projects: [],
      loading: true,
      error: null,
      createProject: async () => ({ success: true }),
      getProjectAnalysis: async () => ({} as any),
      refreshProjects: async () => {},
    } as any);

    const tree = renderer.create(<ProjectsPage />).toJSON();
    expect(tree).toMatchSnapshot();
  });

  it('renders list of projects', () => {
    mockedUseProjects.mockReturnValue({
      projects: [
        {
          id: 'proj1',
          name: 'Test Project',
          description: 'A test',
          status: ProjectStatus.IN_PROGRESS,
          materials: [],
          phases: [],
        },
      ],
      loading: false,
      error: null,
      createProject: async () => ({ success: true }),
      getProjectAnalysis: async () => ({} as any),
      refreshProjects: async () => {},
    } as any);

    const tree = renderer.create(<ProjectsPage />).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
