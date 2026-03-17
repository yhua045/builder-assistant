import React from 'react';
import renderer, { act } from 'react-test-renderer';
import ManualProjectEntry from '../../src/components/ManualProjectEntry';
import { useProjects } from '../../src/hooks/useProjects';

jest.mock('../../src/hooks/useContacts', () => {
  const mockSearch = jest.fn().mockResolvedValue([]);
  return {
    __esModule: true,
    default: () => ({ contacts: [], loading: false, search: mockSearch, refresh: jest.fn() }),
    useContacts: () => ({ contacts: [], loading: false, search: mockSearch, refresh: jest.fn() }),
  };
});

jest.mock('../../src/hooks/useProjects');
const mockedUseProjects = useProjects as jest.MockedFunction<typeof useProjects>;

describe('ManualProjectEntry', () => {
  beforeEach(() => {
    mockedUseProjects.mockReset();
  });

  it('opens form and calls createProject on save', async () => {
    const createProject = jest.fn(async () => ({ success: true }));

    mockedUseProjects.mockReturnValue({
      projects: [],
      loading: false,
      error: null,
      createProject,
      getProjectAnalysis: async () => ({} as any),
      refreshProjects: async () => {}
    } as any);

    let testRenderer: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      testRenderer = renderer.create(<ManualProjectEntry initialVisible={true} />);
    });

    const root = testRenderer!.root;

    // find the form and call onSave directly
    const form = root.findByType(require('../../src/components/ManualProjectEntryForm').default);
    await act(async () => {
      await form.props.onSave({ name: 'New Project' });
    });

    expect(createProject).toHaveBeenCalledWith(expect.objectContaining({ name: 'New Project' }));
  });
});
