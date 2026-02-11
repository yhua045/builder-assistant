import React from 'react';
import renderer, { act } from 'react-test-renderer';
import ProjectsPage from '../../src/pages/projects/ProjectsPage';
import { useProjects } from '../../src/hooks/useProjects';
import { ProjectStatus } from '../../src/domain/entities/Project';

jest.mock('../../src/hooks/useProjects');

const mockedUseProjects = useProjects as jest.MockedFunction<typeof useProjects>;

describe('ProjectsPage', () => {
  beforeEach(() => {
    mockedUseProjects.mockReset();
  });

  it('renders loading state', async () => {
    mockedUseProjects.mockReturnValue({
      projects: [],
      loading: true,
      error: null,
      createProject: async () => ({ success: true }),
      getProjectAnalysis: async () => ({} as any),
      refreshProjects: async () => {},
    } as any);

    let testRenderer: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      testRenderer = renderer.create(<ProjectsPage />);
    });

    const tree = testRenderer!.toJSON();
    act(() => {
      testRenderer!.unmount();
    });
    expect(tree).toMatchSnapshot();
  });

  it('renders list of projects', async () => {
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

    let testRenderer: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      testRenderer = renderer.create(<ProjectsPage />);
    });

    const tree = testRenderer!.toJSON();
    act(() => {
      testRenderer!.unmount();
    });
    expect(tree).toMatchSnapshot();
  });
});
