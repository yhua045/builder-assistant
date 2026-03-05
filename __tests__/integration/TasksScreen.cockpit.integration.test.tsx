/**
 * Integration smoke test: TasksScreen + cockpit components
 *
 * Verifies:
 *   1. TasksScreen renders BlockerCarousel when useCockpitData returns blockers.
 *   2. TasksScreen renders FocusList when useCockpitData returns focus items.
 *   3. Tapping a blocker card opens the TaskBottomSheet with the correct task title.
 *   4. Tapping "See Full Details" in the sheet navigates to TaskDetails.
 *
 * Mocking strategy:
 *   - useCockpitData, useTasks, useProjects → jest mocks (avoid DI container)
 *   - BlockerCarousel, FocusList, TaskBottomSheet → real components (integration value)
 *   - TasksList, ThemeToggle, lucide-react-native, nativewind → lightweight mocks
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import TasksScreen from '../../src/pages/tasks/index';
import type { Task } from '../../src/domain/entities/Task';
import type { CockpitData } from '../../src/domain/entities/CockpitData';

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
});

// ---------------------------------------------------------------------------
// IT-1: BlockerCarousel renders when cockpit has blockers
// ---------------------------------------------------------------------------
describe('IT-1: BlockerCarousel is visible when cockpit has blockers', () => {
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
// IT-5: No cockpit sections when cockpit is null
// ---------------------------------------------------------------------------
describe('IT-5: cockpit sections hidden when cockpit is null', () => {
  it('does not render blocker-carousel or focus-list when cockpit is null', async () => {
    mockCockpitData = null;

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TasksScreen />);
    });

    const carousels = tree!.root.findAll((n) => n.props.testID === 'blocker-carousel');
    const focusList = tree!.root.findAll((n) => n.props.testID === 'focus-list');
    expect(carousels).toHaveLength(0);
    expect(focusList).toHaveLength(0);
  });
});
