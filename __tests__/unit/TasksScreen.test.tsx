/**
 * Unit tests for consolidated TasksScreen (src/pages/tasks/index.tsx)
 * TDD — these tests are written against the **intended** interface before
 * the implementation is complete. They must be red before the rewrite and
 * green after.
 *
 * Mocking strategy mirrors InvoiceListPage.test.tsx / InvoiceDetailPage.test.tsx.
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import TasksScreen from '../../src/pages/tasks/index';
import { useTasks } from '../../src/hooks/useTasks';
import type { Task } from '../../src/domain/entities/Task';

// --- Global mocks (nativewind, safe-area-context) already applied in jest.setup.js ---

jest.mock('../../src/hooks/useTasks');

jest.mock('lucide-react-native', () => ({
  Calendar: 'Calendar',
  Clock: 'Clock',
  AlertCircle: 'AlertCircle',
  CheckCircle: 'CheckCircle',
  Plus: 'Plus',
  User: 'User',
}));

jest.mock('../../src/components/ThemeToggle', () => ({
  ThemeToggle: () => 'ThemeToggle',
}));

// Lightweight mock for TasksList — renders each task as a touchable Text so we
// can assert titles and tap events without pulling in TasksList's own sub-deps.
jest.mock('../../src/components/tasks/TasksList', () => ({
  TasksList: ({ tasks, onPress }: { tasks: Task[]; onPress: (id: string) => void }) => {
    const { Text, TouchableOpacity, View } = require('react-native');
    if (tasks.length === 0) {
      return <Text>No tasks found.</Text>;
    }
    return (
      <View>
        {tasks.map((t: Task) => (
          <TouchableOpacity key={t.id} testID={`task-item-${t.id}`} onPress={() => onPress(t.id)}>
            <Text>{t.title}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  },
}));

const mockNavigate = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeTask = (
  overrides: Partial<Task> & { id: string; title: string; status: Task['status'] },
): Task => ({
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

const mockUseTasks = useTasks as jest.MockedFunction<typeof useTasks>;

function buildHookReturn(
  tasks: Task[],
  loading = false,
  refreshTasks?: jest.Mock,
): ReturnType<typeof useTasks> {
  return {
    tasks,
    loading,
    refreshTasks: refreshTasks ?? jest.fn(),
    createTask: jest.fn(),
    updateTask: jest.fn(),
    deleteTask: jest.fn(),
    getTask: jest.fn(),
    getTaskDetail: jest.fn(),
    addDependency: jest.fn(),
    removeDependency: jest.fn(),
    addDelayReason: jest.fn(),
    removeDelayReason: jest.fn(),
    addProgressLog: jest.fn(),
    resolveDelayReason: jest.fn(),
  };
}

// ---------------------------------------------------------------------------
// TC-1: Renders task titles from useTasks
// ---------------------------------------------------------------------------
describe('TC-1: renders task titles from useTasks', () => {
  it('displays both task titles', async () => {
    const tasks = [
      makeTask({ id: '1', title: 'Fix roof', status: 'pending' }),
      makeTask({ id: '2', title: 'Paint walls', status: 'in_progress' }),
    ];
    mockUseTasks.mockReturnValue(buildHookReturn(tasks));

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TasksScreen />);
    });

    const allTextNodes = tree!.root.findAll((n) => String(n.type) === 'Text');
    const allText = allTextNodes.map((n) => String(n.props.children)).join(' ');
    expect(allText).toContain('Fix roof');
    expect(allText).toContain('Paint walls');
  });
});

// ---------------------------------------------------------------------------
// TC-2: Empty state when no tasks
// ---------------------------------------------------------------------------
describe('TC-2: empty state when no tasks', () => {
  it('shows "No tasks found" copy when task list is empty', async () => {
    mockUseTasks.mockReturnValue(buildHookReturn([]));

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TasksScreen />);
    });

    const allTextNodes = tree!.root.findAll((n) => String(n.type) === 'Text');
    const allText = allTextNodes.map((n) => String(n.props.children)).join(' ');
    expect(allText).toContain('No tasks found');
  });
});

// ---------------------------------------------------------------------------
// TC-3: Filter pills filter the list
// ---------------------------------------------------------------------------
describe('TC-3: filter pills filter the list', () => {
  it('shows only pending tasks after pressing the Pending pill', async () => {
    const tasks = [
      makeTask({ id: '1', title: 'Pending task', status: 'pending' }),
      makeTask({ id: '2', title: 'Completed task', status: 'completed' }),
    ];
    mockUseTasks.mockReturnValue(buildHookReturn(tasks));

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TasksScreen />);
    });

    // Find and press the "Pending" filter pill by testID
    const pendingPill = tree!.root.findByProps({ testID: 'filter-pill-pending' });
    expect(pendingPill).toBeDefined();

    await act(async () => {
      pendingPill.props.onPress();
    });

    const allTextNodes = tree!.root.findAll((n) => String(n.type) === 'Text');
    const allText = allTextNodes.map((n) => String(n.props.children)).join(' ');
    expect(allText).toContain('Pending task');
    expect(allText).not.toContain('Completed task');
  });
});

// ---------------------------------------------------------------------------
// TC-4: Tapping a task navigates to TaskDetails
// ---------------------------------------------------------------------------
describe('TC-4: tapping a task navigates to TaskDetails', () => {
  beforeEach(() => mockNavigate.mockClear());

  it('calls navigate("TaskDetails", { taskId }) when a task is pressed', async () => {
    const tasks = [makeTask({ id: 'task-abc', title: 'Inspect site', status: 'pending' })];
    mockUseTasks.mockReturnValue(buildHookReturn(tasks));

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TasksScreen />);
    });

    const taskItem = tree!.root.findByProps({ testID: 'task-item-task-abc' });
    await act(async () => {
      taskItem.props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('TaskDetails', { taskId: 'task-abc' });
  });
});

// ---------------------------------------------------------------------------
// TC-5: Tapping "+" navigates to CreateTask
// ---------------------------------------------------------------------------
describe('TC-5: tapping "+" navigates to CreateTask', () => {
  beforeEach(() => mockNavigate.mockClear());

  it('calls navigate("CreateTask") when the create button is pressed', async () => {
    mockUseTasks.mockReturnValue(buildHookReturn([]));

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TasksScreen />);
    });

    const createBtn = tree!.root.findByProps({ testID: 'create-task-btn' });
    await act(async () => {
      createBtn.props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('CreateTask');
  });
});

// ---------------------------------------------------------------------------
// TC-6: Pull-to-refresh calls refreshTasks
// ---------------------------------------------------------------------------
describe('TC-6: pull-to-refresh calls refreshTasks', () => {
  it('invokes refreshTasks when RefreshControl onRefresh fires', async () => {
    const refreshTasks = jest.fn().mockResolvedValue(undefined);
    mockUseTasks.mockReturnValue(buildHookReturn([], false, refreshTasks));

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TasksScreen />);
    });

    // Find the RefreshControl and trigger its onRefresh
    const refreshControl = tree!.root.findByProps({ testID: 'tasks-refresh-control' });
    await act(async () => {
      refreshControl.props.onRefresh();
    });

    expect(refreshTasks).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// TC-7: Summary count cards removed (issue #125 — Blocker Hero)
// ---------------------------------------------------------------------------
describe('TC-7: summary count cards are no longer rendered', () => {
  it('does NOT render summary-pending-count or summary-in-progress-count testIDs', async () => {
    const tasks = [
      makeTask({ id: '1', title: 'A', status: 'pending' }),
      makeTask({ id: '2', title: 'B', status: 'pending' }),
      makeTask({ id: '3', title: 'C', status: 'in_progress' }),
    ];
    mockUseTasks.mockReturnValue(buildHookReturn(tasks));

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TasksScreen />);
    });

    // Issue #125: numeric summary cards (pending/in-progress count) have been removed.
    const pendingEls = tree!.root.findAll((n) => n.props.testID === 'summary-pending-count');
    const inProgressEls = tree!.root.findAll((n) => n.props.testID === 'summary-in-progress-count');

    expect(pendingEls).toHaveLength(0);
    expect(inProgressEls).toHaveLength(0);
  });
});
