/**
 * Integration smoke test: TasksScreen + cockpit components
 *
 * Verifies:
 *   1. TasksScreen renders BlockerCarousel when useBlockerBar returns kind=blockers.
 *   2. TasksScreen renders FocusList when useCockpitData returns focus items.
 *   3. Tapping a blocker card opens the TaskBottomSheet with the correct task title.
 *   4. Tapping "See Full Details" in the sheet navigates to TaskDetails.
 *   5. No blocker-carousel when blockerBarResult is null (loading state).
 *   6. Winning card is shown when useBlockerBar returns kind=winning.
 *   7. Fallback sanity: blocker bar shows project B's tasks when project A has none.
 *
 * Mocking strategy:
 *   - useBlockerBar, useCockpitData, useTasks, useProjects → jest mocks (avoid DI container)
 *   - BlockerCarousel, FocusList, TaskBottomSheet → real components (integration value)
 *   - TasksList, ThemeToggle, lucide-react-native, nativewind → lightweight mocks
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import TasksScreen from '../../src/pages/tasks/index';
import type { Task } from '../../src/domain/entities/Task';
import type { CockpitData, BlockerBarResult } from '../../src/domain/entities/CockpitData';

// ─── Global mocks ─────────────────────────────────────────────────────────────

jest.mock('nativewind', () => ({
  cssInterop: jest.fn(),
  useColorScheme: () => ({ colorScheme: 'light' }),
}));

jest.mock('lucide-react-native', () => ({
  Calendar: 'Calendar',
  Clock: 'Clock',
  Plus: 'Plus',
}));

jest.mock('../../src/components/ThemeToggle', () => ({
  ThemeToggle: () => 'ThemeToggle',
}));

jest.mock('../../src/components/tasks/TasksList', () => ({
  TasksList: () => null,
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));

// ─── Hook mocks ───────────────────────────────────────────────────────────────

const mockUpdateTask = jest.fn().mockResolvedValue(undefined);
jest.mock('../../src/hooks/useTasks', () => ({
  useTasks: () => ({
    tasks: [],
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
    resolveDelayReason: jest.fn(),
  }),
}));

const mockRefreshCockpit = jest.fn().mockResolvedValue(undefined);
let mockCockpitData: CockpitData | null = null;

jest.mock('../../src/hooks/useCockpitData', () => ({
  useCockpitData: () => ({
    cockpit: mockCockpitData,
    loading: false,
    refresh: mockRefreshCockpit,
  }),
}));

const mockRefreshBlockerBar = jest.fn().mockResolvedValue(undefined);
let mockBlockerBarResult: BlockerBarResult | null = null;

jest.mock('../../src/hooks/useBlockerBar', () => ({
  useBlockerBar: () => ({
    result: mockBlockerBarResult,
    loading: false,
    refresh: mockRefreshBlockerBar,
  }),
}));

jest.mock('../../src/hooks/useProjects', () => ({
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
  mockBlockerBarResult = {
    kind: 'blockers',
    projectId: 'proj-1',
    projectName: 'My Build',
    blockers: FIXTURE_COCKPIT.blockers,
  };
});

// ---------------------------------------------------------------------------
// IT-1: BlockerCarousel renders when useBlockerBar returns blockers
// ---------------------------------------------------------------------------
describe('IT-1: BlockerCarousel is visible when useBlockerBar returns kind=blockers', () => {
  it('renders the blocker card for Scaffold Assembly', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TasksScreen />);
    });

    // The carousel testID is on the ScrollView inside BlockerCarousel
    const carousel = tree!.root.find((n) => n.props.testID === 'blocker-carousel');
    expect(carousel).toBeTruthy();

    // The blocker card is present
    const card = tree!.root.find((n) => n.props.testID === 'blocker-card-t-blocker');
    expect(card).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// IT-2: FocusList renders when cockpit has focus items
// ---------------------------------------------------------------------------
describe('IT-2: FocusList is visible when cockpit has focus items', () => {
  it('renders the focus row for Frame Roof Plates', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TasksScreen />);
    });

    const row = tree!.root.find((n) => n.props.testID === 'focus-item-t-focus');
    expect(row).toBeTruthy();

    // The task title and urgency label appear in the rendered text
    const allText = tree!.root
      .findAll((n) => String(n.type) === 'Text')
      .map((n) => String(n.props.children))
      .join(' ');
    expect(allText).toContain('Frame Roof Plates');
    expect(allText).toContain('🔴 3d overdue');
  });
});

// ---------------------------------------------------------------------------
// IT-3: Tapping a blocker card opens the TaskBottomSheet
// ---------------------------------------------------------------------------
describe('IT-3: tapping a blocker card opens the bottom sheet', () => {
  it('shows the task title in the sheet after card tap', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TasksScreen />);
    });

    // Tap the blocker card
    const card = tree!.root.find((n) => n.props.testID === 'blocker-card-t-blocker');
    await act(async () => { card.props.onPress(); });

    // Sheet content: task title should now appear
    const allText = tree!.root
      .findAll((n) => String(n.type) === 'Text')
      .map((n) => String(n.props.children))
      .join(' ');
    expect(allText).toContain('Scaffold Assembly');

    // Status pills should be visible
    expect(tree!.root.find((n) => n.props.testID === 'status-pill-pending')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// IT-4: "See Full Details" in the sheet navigates to TaskDetails
// ---------------------------------------------------------------------------
describe('IT-4: "See Full Details" button navigates to TaskDetails', () => {
  it('navigates to TaskDetails with the correct taskId', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TasksScreen />);
    });

    // Open sheet via blocker card
    const card = tree!.root.find((n) => n.props.testID === 'blocker-card-t-blocker');
    await act(async () => { card.props.onPress(); });

    // Tap "See Full Details"
    const detailsBtn = tree!.root.find((n) => n.props.testID === 'action-full-details');
    await act(async () => { detailsBtn.props.onPress(); });

    expect(mockNavigate).toHaveBeenCalledWith('TaskDetails', { taskId: 't-blocker' });
  });
});

// ---------------------------------------------------------------------------
// IT-5: No blocker sections rendered when blockerBarResult is null (loading)
// ---------------------------------------------------------------------------
describe('IT-5: blocker sections hidden when blockerBarResult is null', () => {
  it('does not render blocker-carousel when blockerBarResult is null', async () => {
    mockBlockerBarResult = null;
    mockCockpitData = null;

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TasksScreen />);
    });

    const carousels = tree!.root.findAll((n) => n.props.testID === 'blocker-carousel');
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
      (n) => typeof n.props.testID === 'string' && n.props.testID.startsWith('blocker-card-'),
    );
    expect(blockerCards).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// IT-7: Fallback — blocker bar shows project B's task when project A has none
// ---------------------------------------------------------------------------
describe('IT-7: fallback sanity — blocker bar shows the blocking project', () => {
  it('renders the fallback project\'s blocker card when first project is healthy', async () => {
    const p2BlockerTask = makeTask('t-p2-blocker', 'P2 Blocked Task', 'blocked');
    mockBlockerBarResult = {
      kind: 'blockers',
      projectId: 'proj-2',
      projectName: 'Reno Project B',
      blockers: [{
        task: p2BlockerTask,
        severity: 'red',
        blockedPrereqs: [],
        nextInLine: [],
      }],
    };

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TasksScreen />);
    });

    // Carousel is visible
    const carousel = tree!.root.find((n) => n.props.testID === 'blocker-carousel');
    expect(carousel).toBeTruthy();

    // The blocker card for the fallback project's task is shown
    const card = tree!.root.find((n) => n.props.testID === 'blocker-card-t-p2-blocker');
    expect(card).toBeTruthy();

    // Project name label is visible
    const allText = tree!.root
      .findAll((n) => String(n.type) === 'Text')
      .map((n) => String(n.props.children))
      .join(' ');
    expect(allText).toContain('Reno Project B');
  });
});
