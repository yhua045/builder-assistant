import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { container } from 'tsyringe';
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

// Mock useCriticalPath so CriticalPathStep doesn't try to load native modules
jest.mock('../../src/hooks/useCriticalPath', () => ({
  useCriticalPath: jest.fn().mockReturnValue({
    suggestions: [],
    isLoading: false,
    error: null,
    suggest: jest.fn(),
    selectedIds: new Set(),
    toggleSelection: jest.fn(),
    selectAll: jest.fn(),
    clearAll: jest.fn(),
    isCreating: false,
    creationProgress: null,
    creationError: null,
    confirmSelected: jest.fn().mockResolvedValue(undefined),
  }),
}));

// Stub DI registration (avoids native module resolution)
jest.mock('../../src/infrastructure/di/registerServices', () => ({}));

// Stub heavy native-code repositories used inside CriticalPathStep
jest.mock('../../src/infrastructure/repositories/DrizzleTaskRepository', () => ({
  DrizzleTaskRepository: jest.fn().mockImplementation(() => ({})),
}));

// Stub ContactSelector and other heavy sub-components of the form
jest.mock('../../src/components/inputs/ContactSelector', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function ContactSelector() { return React.createElement(View, { testID: 'contact-selector' }); };
});
jest.mock('../../src/components/inputs/TeamSelector', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function TeamSelector() { return React.createElement(View, { testID: 'team-selector' }); };
});
jest.mock('../../src/components/inputs/DatePickerInput', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function DatePickerInput() { return React.createElement(View, { testID: 'date-picker' }); };
});

describe('ManualProjectEntry', () => {
  beforeEach(() => {
    mockedUseProjects.mockReset();
    // Register a mock TaskRepository in the DI container
    container.register('TaskRepository', {
      useValue: {
        create: jest.fn().mockResolvedValue({ id: 'task-1' }),
        list: jest.fn().mockResolvedValue([]),
        listDetails: jest.fn().mockResolvedValue([]),
        findAll: jest.fn().mockResolvedValue([]),
      },
    });
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

  it('transitions to CriticalPathPreview after successful createProject', async () => {
    const createProject = jest.fn(async () => ({
      success: true,
      projectId: 'proj-new-1',
    }));

    mockedUseProjects.mockReturnValue({
      projects: [],
      loading: false,
      error: null,
      createProject,
      getProjectAnalysis: async () => ({} as any),
      refreshProjects: async () => {},
    } as any);

    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(<ManualProjectEntry initialVisible={true} />);
    });

    const root = testRenderer!.root;
    const form = root.findByType(
      require('../../src/components/ManualProjectEntryForm').default,
    );

    await act(async () => {
      await form.props.onSave({
        name: 'New Project',
        address: '1 Test Rd',
        projectType: 'complete_rebuild',
      });
    });

    // Step 2: CriticalPathPreview should now be rendered
    const { CriticalPathPreview } = require('../../src/components/CriticalPathPreview');
    const preview = root.findByType(CriticalPathPreview);
    expect(preview).toBeTruthy();
    expect(preview.props.projectId).toBe('proj-new-1');
  });

  it('skip closes the modal and resets to form step', async () => {
    const createProject = jest.fn(async () => ({
      success: true,
      projectId: 'proj-skip-1',
    }));

    mockedUseProjects.mockReturnValue({
      projects: [],
      loading: false,
      error: null,
      createProject,
      getProjectAnalysis: async () => ({} as any),
      refreshProjects: async () => {},
    } as any);

    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(<ManualProjectEntry initialVisible={true} />);
    });

    const root = testRenderer!.root;
    const form = root.findByType(
      require('../../src/components/ManualProjectEntryForm').default,
    );

    // Verify form is visible
    expect(form.props.visible).toBe(true);

    // Transition to step 2
    await act(async () => {
      await form.props.onSave({
        name: 'New Project',
        address: '1 Test Rd',
        projectType: 'complete_rebuild',
      });
    });

    // Simulate closing the modal by calling onCancel
    await act(async () => {
      form.props.onCancel();
    });

    // After cancel, the form's visible prop should be false
    const formAfterCancel = root.findByType(
      require('../../src/components/ManualProjectEntryForm').default,
    );
    expect(formAfterCancel.props.visible).toBe(false);
  });
});
