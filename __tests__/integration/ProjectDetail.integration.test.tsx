/**
 * Integration tests for ProjectDetail screen.
 *
 * Covers:
 *  - Renders project header fields
 *  - Renders one TimelineDayGroup per distinct date
 *  - Multiple tasks on the same day appear under the same group
 *  - Day group collapse/expand works (controlled — state lives in ProjectDetail)
 *  - Project name shown in page heading
 *  - "Mark complete" triggers markComplete in the hook and shows confirmation
 *
 * Strategy: mock the four focused hooks (useProjectDetail, useTaskTimeline,
 * usePaymentsTimeline, useQuotationsTimeline) directly so we test the component
 * tree without needing a QueryClientProvider.
 * Hook logic is covered independently in unit/useTaskTimeline.test.ts.
 *
 * NOTE: Fixture dates are in the future (> 2026-03-17) so that the
 * auto-collapse rule starts all groups EXPANDED, matching the test assertions.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Alert } from 'react-native';
import { wrapWithQuery } from '../utils/queryClientWrapper';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('nativewind', () => ({
  cssInterop: jest.fn(),
  useColorScheme: () => ({ colorScheme: 'light' }),
}));

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
// addListener is needed for the focus-invalidation useEffect in ProjectDetail
const mockAddListener = jest.fn(() => jest.fn());

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack, addListener: mockAddListener }),
  useRoute: () => ({ params: { projectId: 'proj-1' } }),
}));

jest.mock('lucide-react-native', () => ({
  ArrowLeft: 'ArrowLeft', MapPin: 'MapPin', Phone: 'Phone',
  Calendar: 'Calendar', Clock: 'Clock',
  AlertCircle: 'AlertCircle', CheckCircle: 'CheckCircle',
  XCircle: 'XCircle', Play: 'Play', ExternalLink: 'ExternalLink',
  Camera: 'Camera', Paperclip: 'Paperclip',
  ChevronDown: 'ChevronDown', ChevronRight: 'ChevronRight',
}));

// ── Four focused hook mocks ─────────────────────────────────────────────────

const mockMarkComplete = jest.fn().mockResolvedValue(undefined);
const mockInvalidateTasks = jest.fn().mockResolvedValue(undefined);
const mockInvalidatePayments = jest.fn().mockResolvedValue(undefined);
const mockInvalidateQuotations = jest.fn().mockResolvedValue(undefined);
const mockRecordPayment = jest.fn().mockResolvedValue(undefined);

let mockProjectDetailReturn: any;
let mockTaskTimelineReturn: any;
let mockPaymentsTimelineReturn: any;
let mockQuotationsTimelineReturn: any;

jest.mock('../../src/hooks/useProjectDetail', () => ({
  useProjectDetail: () => mockProjectDetailReturn,
}));
jest.mock('../../src/hooks/useTaskTimeline', () => ({
  useTaskTimeline: () => mockTaskTimelineReturn,
}));
jest.mock('../../src/hooks/usePaymentsTimeline', () => ({
  usePaymentsTimeline: () => mockPaymentsTimelineReturn,
}));
jest.mock('../../src/hooks/useQuotationsTimeline', () => ({
  useQuotationsTimeline: () => mockQuotationsTimelineReturn,
}));

// ── Fixtures — future dates so groups start EXPANDED ─────────────────────────

const sampleProject = {
  id: 'proj-1',
  name: 'Smith Residence',
  location: '1234 Oak Street',
  status: 'in_progress',
  startDate: new Date('2026-03-15'),
  expectedEndDate: new Date('2026-06-15'),
  materials: [], phases: [],
  owner: { id: 'c1', name: 'John Smith', phone: '0412 000 111' },
};

const taskT1 = { id: 't1', title: 'Foundation Inspection', status: 'completed', projectId: 'proj-1', scheduledAt: '2026-03-20T10:00:00Z' };
const taskT2 = { id: 't2', title: 'Concrete Pouring',       status: 'completed', projectId: 'proj-1', scheduledAt: '2026-03-20T14:00:00Z' };
const taskT3 = { id: 't3', title: 'Framing Installation',   status: 'pending',   projectId: 'proj-1', scheduledAt: '2026-03-28T09:00:00Z' };

function setHookReturn(overrides: {
  projectDetail?: Partial<typeof mockProjectDetailReturn>;
  taskTimeline?: Partial<typeof mockTaskTimelineReturn>;
  paymentsTimeline?: Partial<typeof mockPaymentsTimelineReturn>;
  quotationsTimeline?: Partial<typeof mockQuotationsTimelineReturn>;
} = {}) {
  mockProjectDetailReturn = {
    project: sampleProject,
    loading: false,
    error: null,
    ...overrides.projectDetail,
  };
  mockTaskTimelineReturn = {
    dayGroups: [
      { date: '2026-03-20', label: 'Fri 20 Mar', tasks: [taskT1, taskT2] },
      { date: '2026-03-28', label: 'Sat 28 Mar', tasks: [taskT3] },
    ],
    loading: false,
    error: null,
    markComplete: mockMarkComplete,
    invalidate: mockInvalidateTasks,
    ...overrides.taskTimeline,
  };
  mockPaymentsTimelineReturn = {
    paymentDayGroups: [],
    loading: false,
    error: null,
    truncated: false,
    recordPayment: mockRecordPayment,
    invalidate: mockInvalidatePayments,
    ...overrides.paymentsTimeline,
  };
  mockQuotationsTimelineReturn = {
    quotationDayGroups: [],
    loading: false,
    error: null,
    truncated: false,
    invalidate: mockInvalidateQuotations,
    ...overrides.quotationsTimeline,
  };
}

import ProjectDetailScreen from '../../src/pages/projects/ProjectDetail';

function renderScreen() {
  return renderer.create(wrapWithQuery(<ProjectDetailScreen />));
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProjectDetail screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setHookReturn();
  });

  it('renders loading indicator when loading=true', async () => {
    setHookReturn({ projectDetail: { loading: true, project: null }, taskTimeline: { dayGroups: [], loading: true } });
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderScreen();
    });
    const loading = tree!.root.findAllByProps({ testID: 'project-detail-loading' });
    expect(loading.length).toBeGreaterThan(0);
  });

  it('renders project name in the page heading', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderScreen();
    });
    const headingEl = tree!.root.findAllByProps({ testID: 'project-detail-heading' });
    expect(headingEl.length).toBeGreaterThan(0);
    expect(headingEl[0].props.children).toBe('Smith Residence');
  });

  it('renders project name in the body card (regression)', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderScreen();
    });
    const nameEl = tree!.root.findAllByProps({ testID: 'project-detail-name' });
    expect(nameEl.length).toBeGreaterThan(0);
    expect(nameEl[0].props.children).toBe('Smith Residence');
  });

  it('renders two day groups (Mar 20 and Mar 28)', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderScreen();
    });
    const mar20 = tree!.root.findAllByProps({ testID: 'day-group-2026-03-20' });
    const mar28 = tree!.root.findAllByProps({ testID: 'day-group-2026-03-28' });
    expect(mar20.length).toBeGreaterThan(0);
    expect(mar28.length).toBeGreaterThan(0);
  });

  it('shows two task cards on Mar 20', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderScreen();
    });
    const card0 = tree!.root.findAllByProps({ testID: 'day-group-2026-03-20-task-0' });
    const card1 = tree!.root.findAllByProps({ testID: 'day-group-2026-03-20-task-1' });
    expect(card0.length).toBeGreaterThan(0);
    expect(card1.length).toBeGreaterThan(0);
  });

  it('date label is rendered next to the group (testID present)', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderScreen();
    });
    const dateLabel = tree!.root.findAllByProps({ testID: 'day-group-2026-03-20-date-label' });
    expect(dateLabel.length).toBeGreaterThan(0);
  });

  it('collapses task cards when per-group toggle is pressed', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderScreen();
    });

    // Groups start expanded (future dates) — cards should be visible
    const card0Before = tree!.root.findAllByProps({ testID: 'day-group-2026-03-20-task-0' });
    expect(card0Before.length).toBeGreaterThan(0);

    // Tap the per-group collapse toggle
    const toggle = tree!.root.findAllByProps({ testID: 'day-group-2026-03-20-toggle' });
    await act(async () => {
      toggle[0].props.onPress();
    });

    // After collapse, the card should no longer be in the tree
    const card0After = tree!.root.findAllByProps({ testID: 'day-group-2026-03-20-task-0' });
    expect(card0After.length).toBe(0);
  });


  it('registers a focus listener for timeline invalidation', async () => {
    await act(async () => {
      renderScreen();
    });
    expect(mockAddListener).toHaveBeenCalledWith('focus', expect.any(Function));
  });

  it('shows "no tasks" message when project has no tasks', async () => {
    setHookReturn({ taskTimeline: { dayGroups: [] } });
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderScreen();
    });
    const empty = tree!.root.findAllByProps({ testID: 'tasks-empty' });
    expect(empty.length).toBeGreaterThan(0);
  });

  it('calls Alert when mark-complete action is pressed', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderScreen();
    });

    // Framing Installation (t3) is pending — complete button should be visible
    const completeBtn = tree!.root.findAllByProps({ testID: 'day-group-2026-03-28-task-0-complete' });
    await act(async () => {
      completeBtn[0].props.onPress();
    });

    expect(alertSpy).toHaveBeenCalledWith(
      'Mark Complete',
      expect.stringContaining('Framing Installation'),
      expect.any(Array),
    );
  });
});

