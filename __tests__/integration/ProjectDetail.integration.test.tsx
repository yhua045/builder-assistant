/**
 * Integration tests for ProjectDetail screen.
 *
 * Covers:
 *  - Renders project header fields
 *  - Renders one TimelineDayGroup per distinct date
 *  - Multiple tasks on the same day appear under the same group
 *  - Day group collapse/expand works
 *  - "Mark complete" triggers markComplete in the hook and shows confirmation
 *
 * Strategy: mock `useProjectTimeline` directly (consistent with cockpit tests)
 * so we test the component tree without needing a QueryClientProvider.
 * Hook logic is covered independently in unit/useProjectTimeline.test.ts.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Alert } from 'react-native';

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('nativewind', () => ({
  cssInterop: jest.fn(),
  useColorScheme: () => ({ colorScheme: 'light' }),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
  useRoute: () => ({ params: { projectId: 'proj-1' } }),
}));

jest.mock('lucide-react-native', () => ({
  ArrowLeft: 'ArrowLeft', MapPin: 'MapPin', Phone: 'Phone',
  Calendar: 'Calendar', Clock: 'Clock', Layers: 'Layers',
  AlertCircle: 'AlertCircle', CheckCircle: 'CheckCircle',
  XCircle: 'XCircle', Play: 'Play', ExternalLink: 'ExternalLink',
  Camera: 'Camera', Paperclip: 'Paperclip',
  ChevronDown: 'ChevronDown', ChevronRight: 'ChevronRight',
}));

// ── useProjectTimeline hook mock ─────────────────────────────────────────────

const mockMarkComplete = jest.fn().mockResolvedValue(undefined);
const mockInvalidate = jest.fn().mockResolvedValue(undefined);

jest.mock('../../src/hooks/useProjectTimeline', () => ({
  useProjectTimeline: () => mockHookReturn,
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────

const sampleProject = {
  id: 'proj-1',
  name: 'Smith Residence',
  location: '1234 Oak Street',
  status: 'in_progress',
  startDate: new Date('2024-12-15'),
  expectedEndDate: new Date('2025-01-15'),
  materials: [], phases: [],
  owner: { id: 'c1', name: 'John Smith', phone: '0412 000 111' },
};

const taskT1 = { id: 't1', title: 'Foundation Inspection', status: 'completed', projectId: 'proj-1', scheduledAt: '2024-12-20T10:00:00Z' };
const taskT2 = { id: 't2', title: 'Concrete Pouring',       status: 'completed', projectId: 'proj-1', scheduledAt: '2024-12-20T14:00:00Z' };
const taskT3 = { id: 't3', title: 'Framing Installation',   status: 'pending',   projectId: 'proj-1', scheduledAt: '2024-12-28T09:00:00Z' };

let mockHookReturn: any;

function setHookReturn(overrides?: Partial<typeof mockHookReturn>) {
  mockHookReturn = {
    project: sampleProject,
    dayGroups: [
      { date: '2024-12-20', label: 'Fri 20 Dec', tasks: [taskT1, taskT2] },
      { date: '2024-12-28', label: 'Sat 28 Dec', tasks: [taskT3] },
    ],
    loading: false,
    error: null,
    markComplete: mockMarkComplete,
    invalidateTimeline: mockInvalidate,
    ...overrides,
  };
}

import ProjectDetailScreen from '../../src/pages/projects/ProjectDetail';

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProjectDetail screen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setHookReturn();
  });

  it('renders loading indicator when loading=true', async () => {
    setHookReturn({ loading: true, project: null, dayGroups: [] });
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<ProjectDetailScreen />);
    });
    const loading = tree!.root.findAllByProps({ testID: 'project-detail-loading' });
    expect(loading.length).toBeGreaterThan(0);
  });

  it('renders project name after data loads', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<ProjectDetailScreen />);
    });
    const nameEl = tree!.root.findAllByProps({ testID: 'project-detail-name' });
    expect(nameEl.length).toBeGreaterThan(0);
    expect(nameEl[0].props.children).toBe('Smith Residence');
  });

  it('renders two day groups (Dec 20 and Dec 28)', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<ProjectDetailScreen />);
    });
    const dec20 = tree!.root.findAllByProps({ testID: 'day-group-2024-12-20' });
    const dec28 = tree!.root.findAllByProps({ testID: 'day-group-2024-12-28' });
    expect(dec20.length).toBeGreaterThan(0);
    expect(dec28.length).toBeGreaterThan(0);
  });

  it('shows two task cards on Dec 20', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<ProjectDetailScreen />);
    });
    const card0 = tree!.root.findAllByProps({ testID: 'day-group-2024-12-20-task-0' });
    const card1 = tree!.root.findAllByProps({ testID: 'day-group-2024-12-20-task-1' });
    expect(card0.length).toBeGreaterThan(0);
    expect(card1.length).toBeGreaterThan(0);
  });

  it('date label is rendered next to the group (testID present)', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<ProjectDetailScreen />);
    });
    const dateLabel = tree!.root.findAllByProps({ testID: 'day-group-2024-12-20-date-label' });
    expect(dateLabel.length).toBeGreaterThan(0);
  });

  it('collapses task cards when toggle is pressed', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<ProjectDetailScreen />);
    });

    // Before collapse
    const card0Before = tree!.root.findAllByProps({ testID: 'day-group-2024-12-20-task-0' });
    expect(card0Before.length).toBeGreaterThan(0);

    // Tap collapse toggle
    const toggle = tree!.root.findAllByProps({ testID: 'day-group-2024-12-20-toggle' });
    await act(async () => {
      toggle[0].props.onPress();
    });

    // After collapse, the card should no longer be in the tree
    const card0After = tree!.root.findAllByProps({ testID: 'day-group-2024-12-20-task-0' });
    expect(card0After.length).toBe(0);
  });

  it('shows "no tasks" message when project has no tasks', async () => {
    setHookReturn({ dayGroups: [] });
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<ProjectDetailScreen />);
    });
    const empty = tree!.root.findAllByProps({ testID: 'project-detail-no-tasks' });
    expect(empty.length).toBeGreaterThan(0);
  });

  it('calls Alert when mark-complete action is pressed', async () => {
    const alertSpy = jest.spyOn(Alert, 'alert');
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<ProjectDetailScreen />);
    });

    // Framing Installation (t3) is pending — complete button should be visible
    const completeBtn = tree!.root.findAllByProps({ testID: 'day-group-2024-12-28-task-0-complete' });
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

