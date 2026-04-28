import React from 'react';
import renderer, { act } from 'react-test-renderer';
import ProjectsPage from '../../../screens/ProjectsPage';
import { useProjectsPage } from '../../../hooks/useProjectsPage';
import { ProjectStatus } from '../../../../../domain/entities/Project';

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  useRoute: () => ({ params: {} }),
}));

jest.mock('../../../hooks/useProjectsPage');

jest.mock('../../../components/ManualProjectEntry', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: () => React.createElement('View'), // Mock as empty View component
  };
});

const mockedUseProjectsPage = useProjectsPage as jest.MockedFunction<typeof useProjectsPage>;

const BASE_VM = {
  projectDtos: [],
  loading: false,
  error: null,
  hasProjects: false,
  createKey: 0,
  openCreate: jest.fn(),
  navigateToProject: jest.fn(),
};

describe('ProjectsPage', () => {
  beforeEach(() => {
    mockedUseProjectsPage.mockReset();
  });

  it('renders loading state', async () => {
    mockedUseProjectsPage.mockReturnValue({
      ...BASE_VM,
      loading: true,
    });

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
    mockedUseProjectsPage.mockReturnValue({
      ...BASE_VM,
      hasProjects: true,
      projectDtos: [
        {
          id: 'proj1',
          owner: 'Test Project',
          address: 'No Address',
          status: ProjectStatus.IN_PROGRESS,
          contact: 'No contact',
          lastCompletedTask: { title: 'Initial Setup', completedDate: '-' },
          upcomingTasks: [],
        },
      ],
    });

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

  it('renders empty state', async () => {
    mockedUseProjectsPage.mockReturnValue({
      ...BASE_VM,
      hasProjects: false,
      loading: false,
    });

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
