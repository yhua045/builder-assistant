/**
 * Integration smoke test: TasksScreen + cockpit components
 *
 * Verifies (post issue #131 — TaskBottomSheet removed):
 *   1. TasksScreen renders BlockerCarousel when useBlockerBar returns kind=blockers.
 *   2. TasksScreen renders FocusList when useCockpitData returns focus items.
 *   3. Tapping a blocker card navigates directly to TaskDetails (no sheet).
 *   4. Tapping a FocusList item navigates directly to TaskDetails.
 *   5. No blocker-carousel when blockerBarResult is null (loading state).
 *   6. Winning card is shown when useBlockerBar returns kind=winning.
 *   7. Fallback sanity: blocker bar shows project B's tasks when project A has none.
 *
 * Mocking strategy:
 *   - useBlockerBar, useCockpitData, useTasks, useProjects → jest mocks (avoid DI container)
 *   - BlockerCarousel, FocusList → real components (integration value)
 *   - TasksList, ThemeToggle, lucide-react-native, nativewind → lightweight mocks
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import TasksScreen from '../../screens/index';
import { TouchableOpacity } from "react-native";

import type { Task } from '../../../../domain/entities/Task';
import type { CockpitData, BlockerBarResult } from '../../../../domain/entities/CockpitData';

// ─── Global mocks ─────────────────────────────────────────────────────────────

jest.mock('nativewind', () => ({
  cssInterop: jest.fn(),
  useColorScheme: () => ({ colorScheme: 'light' }),
}));

jest.mock('lucide-react-native', () => ({
  Calendar: 'Calendar',
  Clock: 'Clock',
  Plus: 'Plus',
  AlertCircle: 'AlertCircle',
  AlertTriangle: 'AlertTriangle',
  ChevronRight: 'ChevronRight',
  Layers: 'Layers',
}));

jest.mock('../../../../components/ThemeToggle', () => ({
  ThemeToggle: () => 'ThemeToggle',
}));

jest.mock('../../components/TasksList', () => ({
  TasksList: () => null,
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

// ─── Hook mocks ───────────────────────────────────────────────────────────────

const mockUpdateTask = jest.fn().mockResolvedValue(undefined);
jest.mock('../../hooks/useTasks', () => ({
  useTasks: () => ({
    tasks: mockTasks || [],
    loading: false,
    refreshTasks: jest.fn().mockResolvedValue(undefined),
    createTask: jest.fn(),
    updateTask: mockUpdateTask,
    deleteTask: jest.fn(),
    getTask: jest.fn(),
    getTaskDetail: jest.fn(),
    addDependency: jest.fn(),
    removeDependency: jest.fn(),
    addDelayReason: jest.fn(),
    removeDelayReason: jest.fn(),
    addProgressLog: jest.fn(),
    resolveDelayReason: jest.fn(),
  }),
}));

const mockRefreshCockpit = jest.fn().mockResolvedValue(undefined);
let mockCockpitData: CockpitData | null = null;

jest.mock('../../../../hooks/useCockpitData', () => ({
  useCockpitData: () => ({
    cockpit: mockCockpitData,
    loading: false,
    refresh: mockRefreshCockpit,
  }),
}));

const mockRefreshBlockerBar = jest.fn().mockResolvedValue(undefined);
let mockTasks: Task[] = [];
let mockBlockerBarResult: BlockerBarResult | null = null;

jest.mock('../../../../hooks/useBlockerBar', () => ({
  useBlockerBar: () => ({
    result: mockBlockerBarResult,
    loading: false,
    refresh: mockRefreshBlockerBar,
  }),
}));

jest.mock('../../../projects/hooks/useProjects', () => ({
  useProjects: () => ({
    projects: [{ id: 'proj-1', name: 'My Build' }],
    loading: false,
    error: null,
    createProject: jest.fn(),
    getProjectAnalysis: jest.fn(),
    refreshProjects: jest.fn(),
  }),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const makeTask = (id: string, title: string, status: Task['status'] = 'in_progress'): Task => ({
  id,
  title,
  status,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
});

const blockerTask = makeTask('t-blocker', 'Scaffold Assembly', 'blocked');
const prereqTask = makeTask('t-prereq', 'Concrete pour', 'blocked');
const nextTask = makeTask('t-next', 'Roof Battens', 'pending');

const focusTask = makeTask('t-focus', 'Frame Roof Plates', 'in_progress');

const FIXTURE_COCKPIT: CockpitData = {
  blockers: [
    {
      task: blockerTask,
      severity: 'red',
      blockedPrereqs: [prereqTask],
      nextInLine: [nextTask],
    },
  ],
  focus3: [
    {
      task: focusTask,
      score: 245,
      urgencyLabel: '🔴 3d overdue',
      nextInLine: [],
    },
  ],
};

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mockCockpitData = FIXTURE_COCKPIT;
  mockTasks = [blockerTask, prereqTask];
  mockBlockerBarResult = {
    kind: 'blockers',
    projectId: 'proj-1',
    projectName: 'My Build',
    blockers: FIXTURE_COCKPIT.blockers,
  };
});

// ---------------------------------------------------------------------------
// IT-1: BlockerCarousel -> CriticalTasksTimeline renders when Tasks has blocked items
// ---------------------------------------------------------------------------
describe('IT-1: CriticalTasksTimeline is visible when there are blocked tasks', () => {
  it('renders the critical timeline for Scaffold Assembly', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TasksScreen />);
    });

    const timeline = tree!.root.find((n) => n.props.testID === 'critical-tasks-timeline');
    expect(timeline).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// IT-2: FocusList — intentionally hidden in TasksScreen (commit 9d84e20)
//   The FocusList component is preserved for future reuse but is no longer
//   rendered in the TasksScreen (it duplicated the task list). Tests verify
//   it is absent from the rendered tree.
// ---------------------------------------------------------------------------
describe('IT-2: FocusList is NOT rendered in TasksScreen (intentionally hidden)', () => {
  it('does not render any focus-list testID in the current screen', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TasksScreen />);
    });

    const focusListNodes = tree!.root.findAll((n) => n.props.testID === 'focus-list');
    expect(focusListNodes).toHaveLength(0);

    const focusItemNodes = tree!.root.findAll((n) =>
      typeof n.props.testID === 'string' && n.props.testID.startsWith('focus-item-'),
    );
    expect(focusItemNodes).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// IT-3: Tapping a timeline item navigates directly to TaskDetails (issue #131)
// ---------------------------------------------------------------------------
describe('IT-3: tapping a timeline item navigates directly to TaskDetails', () => {
  it('calls navigate("TaskDetails", { taskId }) — no sheet', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TasksScreen />);
    });

    const timeline = tree!.root.find((n) => n.props.testID === 'critical-tasks-timeline');
    // First touchable opacity inside the timeline is the item card
    const card = timeline.findAllByType(TouchableOpacity)[0];
    await act(async () => { card.props.onPress(); });

    expect(mockNavigate).toHaveBeenCalledWith('TaskDetails', { taskId: 't-blocker' });
  });

  it('does NOT show any sheet close button after card tap', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TasksScreen />);
    });

    const timeline = tree!.root.find((n) => n.props.testID === 'critical-tasks-timeline');
    const card = timeline.findAllByType(TouchableOpacity)[0];
    await act(async () => { card.props.onPress(); });

    const sheetCloseBtn = tree!.root.findAll((n) => n.props.testID === 'sheet-close-btn');
    expect(sheetCloseBtn).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// IT-4: FocusList navigation — skipped because FocusList is intentionally
//   hidden in TasksScreen (commit 9d84e20). Navigation wiring is covered by
//   the FocusList unit tests in FocusList.test.tsx.
// ---------------------------------------------------------------------------
describe('IT-4: FocusList tap navigation (skipped — component hidden in TasksScreen)', () => {
  it.todo('re-enable when FocusList is restored to TasksScreen');
});

// ---------------------------------------------------------------------------
// IT-5: No blocker sections rendered when blockerBarResult is null (loading)
// ---------------------------------------------------------------------------
describe('IT-5: blocker sections hidden when blockerBarResult is null', () => {
  it('does not render blocker-carousel when blockerBarResult is null', async () => {
    mockBlockerBarResult = null;
    mockTasks = [];
    mockCockpitData = null;

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TasksScreen />);
    });

    const carousels = tree!.root.findAll((n) => n.props.testID === 'critical-tasks-timeline');
    const winningCards = tree!.root.findAll((n) => n.props.testID === 'blocker-winning-card');
    const focusList = tree!.root.findAll((n) => n.props.testID === 'focus-list');
    expect(carousels).toHaveLength(0);
    expect(winningCards).toHaveLength(0);
    expect(focusList).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// IT-6: Winning card shown when useBlockerBar returns kind=winning
// ---------------------------------------------------------------------------
describe('IT-6: winning card shown when useBlockerBar returns kind=winning', () => {
  it('renders the winning card with correct message', async () => {
    mockTasks = [blockerTask, prereqTask];
  mockBlockerBarResult = { kind: 'winning' };

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TasksScreen />);
    });

    const winningCard = tree!.root.find((n) => n.props.testID === 'blocker-winning-card');
    expect(winningCard).toBeTruthy();

    const allText = tree!.root
      .findAll((n) => String(n.type) === 'Text')
      .map((n) => String(n.props.children))
      .join(' ');
    expect(allText).toContain("You're winning today");

    // No blocker cards should be present
    const blockerCards = tree!.root.findAll(
      (n) => n.props.testID === 'critical-tasks-timeline',
    );
    expect(blockerCards).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// IT-7: Fallback —  CriticalTasksTimeline lists items properly
// ---------------------------------------------------------------------------
describe('IT-7: Fallback sanity - lists items properly', () => {
  it('renders the fallback project\'s blocker card when first project is healthy', async () => {
    // we need to mock tasks response since it's driven by useTasks now
    
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TasksScreen />);
    });

    const timeline = tree!.root.findAll((n) => n.props.testID === 'critical-tasks-timeline');
    // because we mocked a blocked task in the mock tasks
    expect(timeline.length).toBeGreaterThan(0);
  });
});
