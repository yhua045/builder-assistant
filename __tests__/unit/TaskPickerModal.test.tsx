import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { TaskPickerModal } from '../../src/features/tasks/screens/TaskPickerModal';
import { Task } from '../../src/domain/entities/Task';

// Mock useTasks hook
const mockUseTasks = jest.fn();
jest.mock('../../src/features/tasks/hooks/useTasks', () => ({
  useTasks: (...args: any[]) => mockUseTasks(...args),
}));

function makeTask(id: string, title: string, overrides: Partial<Task> = {}): Task {
  return {
    id,
    title,
    status: 'pending',
    projectId: 'proj-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

const taskA = makeTask('task-a', 'Task Alpha');
const taskB = makeTask('task-b', 'Task Beta');
const taskC = makeTask('task-c', 'Task Gamma');

describe('TaskPickerModal', () => {
  beforeEach(() => {
    mockUseTasks.mockReturnValue({
      tasks: [taskA, taskB, taskC],
      loading: false,
      refreshTasks: jest.fn(),
      createTask: jest.fn(),
      updateTask: jest.fn(),
      deleteTask: jest.fn(),
      getTask: jest.fn(),
      getTaskDetail: jest.fn(),
      addDependency: jest.fn(),
      removeDependency: jest.fn(),
      addDelayReason: jest.fn(),
      removeDelayReason: jest.fn(),
    });
  });

  afterEach(() => jest.clearAllMocks());

  it('renders a list of tasks from the project', async () => {
    const { getByText } = render(
      <TaskPickerModal
        visible={true}
        projectId="proj-1"
        excludeTaskId="task-z" 
        existingDependencyIds={[]}
        onSelect={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    await waitFor(() => {
      expect(getByText('Task Alpha')).toBeTruthy();
      expect(getByText('Task Beta')).toBeTruthy();
      expect(getByText('Task Gamma')).toBeTruthy();
    });
  });

  it('excludes the task being viewed (self)', async () => {
    const { queryByText } = render(
      <TaskPickerModal
        visible={true}
        projectId="proj-1"
        excludeTaskId="task-a"
        existingDependencyIds={[]}
        onSelect={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    await waitFor(() => {
      expect(queryByText('Task Alpha')).toBeNull();
      expect(queryByText('Task Beta')).toBeTruthy();
    });
  });

  it('excludes already-added dependencies', async () => {
    const { queryByText } = render(
      <TaskPickerModal
        visible={true}
        projectId="proj-1"
        excludeTaskId="task-z"
        existingDependencyIds={['task-b']}
        onSelect={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    await waitFor(() => {
      expect(queryByText('Task Beta')).toBeNull();
      expect(queryByText('Task Alpha')).toBeTruthy();
    });
  });

  it('calls onSelect with the task id when a task is pressed', async () => {
    const onSelect = jest.fn();
    const { getByText } = render(
      <TaskPickerModal
        visible={true}
        projectId="proj-1"
        excludeTaskId="task-z"
        existingDependencyIds={[]}
        onSelect={onSelect}
        onClose={jest.fn()}
      />,
    );
    await waitFor(() => getByText('Task Alpha'));
    fireEvent.press(getByText('Task Alpha'));
    expect(onSelect).toHaveBeenCalledWith('task-a');
  });

  it('calls onClose when close button is pressed', async () => {
    const onClose = jest.fn();
    const { getByTestId } = render(
      <TaskPickerModal
        visible={true}
        projectId="proj-1"
        excludeTaskId="task-z"
        existingDependencyIds={[]}
        onSelect={jest.fn()}
        onClose={onClose}
      />,
    );
    await waitFor(() => getByTestId('task-picker-close'));
    fireEvent.press(getByTestId('task-picker-close'));
    expect(onClose).toHaveBeenCalled();
  });

  it('filters tasks by search query', async () => {
    const { getByPlaceholderText, queryByText, getByText } = render(
      <TaskPickerModal
        visible={true}
        projectId="proj-1"
        excludeTaskId="task-z"
        existingDependencyIds={[]}
        onSelect={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    await waitFor(() => getByText('Task Alpha'));
    const searchInput = getByPlaceholderText(/search/i);
    fireEvent.changeText(searchInput, 'Beta');
    await waitFor(() => {
      expect(queryByText('Task Alpha')).toBeNull();
      expect(queryByText('Task Gamma')).toBeNull();
      expect(getByText('Task Beta')).toBeTruthy();
    });
  });
});
