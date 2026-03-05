/**
 * Unit tests for TaskBottomSheet (src/components/tasks/TaskBottomSheet.tsx)
 * TDD — written before the component exists (red phase).
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { TaskBottomSheet } from '../../src/components/tasks/TaskBottomSheet';
import type { Task } from '../../src/domain/entities/Task';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeTask = (overrides: Partial<Task> = {}): Task => ({
  id: 'task-1',
  title: 'Frame Roof Plates',
  status: 'in_progress',
  priority: 'high',
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  ...overrides,
});

const makePrereq = (id: string, title: string, status: Task['status']): Task => ({
  id,
  title,
  status,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
});

const defaultProps = () => ({
  visible: true,
  task: makeTask(),
  prereqs: [] as Task[],
  nextInLine: [] as Task[],
  onClose: jest.fn(),
  onUpdateTask: jest.fn().mockResolvedValue(undefined),
  onOpenFullDetails: jest.fn(),
  onMarkBlocked: jest.fn(),
});

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// TC-1: Renders task title when visible
// ---------------------------------------------------------------------------
describe('TC-1: renders task title', () => {
  it('displays the task title in the sheet', async () => {
    const props = defaultProps();
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TaskBottomSheet {...props} />);
    });
    const allText = tree!.root
      .findAll((n) => String(n.type) === 'Text')
      .map((n) => String(n.props.children))
      .join(' ');
    expect(allText).toContain('Frame Roof Plates');
  });

  it('renders nothing meaningful when task is null', async () => {
    const props = { ...defaultProps(), task: null };
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TaskBottomSheet {...props} />);
    });
    // Should not throw; may render null or an empty sheet
    expect(tree!).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// TC-2: Status pills render
// ---------------------------------------------------------------------------
describe('TC-2: status pills', () => {
  it('renders all 4 status pills', async () => {
    const props = defaultProps();
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TaskBottomSheet {...props} />);
    });
    const pendingPill = tree!.root.find((n) => n.props.testID === 'status-pill-pending');
    const inProgressPill = tree!.root.find((n) => n.props.testID === 'status-pill-in_progress');
    const blockedPill = tree!.root.find((n) => n.props.testID === 'status-pill-blocked');
    const completedPill = tree!.root.find((n) => n.props.testID === 'status-pill-completed');
    expect(pendingPill).toBeTruthy();
    expect(inProgressPill).toBeTruthy();
    expect(blockedPill).toBeTruthy();
    expect(completedPill).toBeTruthy();
  });

  it('calls onUpdateTask with updated status when a status pill is tapped', async () => {
    const props = defaultProps();
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TaskBottomSheet {...props} />);
    });
    const pill = tree!.root.find((n) => n.props.testID === 'status-pill-completed');
    await act(async () => { pill.props.onPress(); });
    expect(props.onUpdateTask).toHaveBeenCalledTimes(1);
    expect(props.onUpdateTask).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed' }),
    );
  });
});

// ---------------------------------------------------------------------------
// TC-3: Priority pills render
// ---------------------------------------------------------------------------
describe('TC-3: priority pills', () => {
  it('renders all 4 priority pills', async () => {
    const props = defaultProps();
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TaskBottomSheet {...props} />);
    });
    expect(tree!.root.find((n) => n.props.testID === 'priority-pill-urgent')).toBeTruthy();
    expect(tree!.root.find((n) => n.props.testID === 'priority-pill-high')).toBeTruthy();
    expect(tree!.root.find((n) => n.props.testID === 'priority-pill-medium')).toBeTruthy();
    expect(tree!.root.find((n) => n.props.testID === 'priority-pill-low')).toBeTruthy();
  });

  it('calls onUpdateTask with updated priority when a priority pill is tapped', async () => {
    const props = defaultProps();
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TaskBottomSheet {...props} />);
    });
    const pill = tree!.root.find((n) => n.props.testID === 'priority-pill-urgent');
    await act(async () => { pill.props.onPress(); });
    expect(props.onUpdateTask).toHaveBeenCalledWith(
      expect.objectContaining({ priority: 'urgent' }),
    );
  });
});

// ---------------------------------------------------------------------------
// TC-4: Prereqs list
// ---------------------------------------------------------------------------
describe('TC-4: prerequisites list', () => {
  it('renders prereq titles with status icons', async () => {
    const prereqs = [
      makePrereq('p1', 'Concrete pour', 'completed'),
      makePrereq('p2', 'Scaffold up', 'blocked'),
    ];
    const props = { ...defaultProps(), prereqs };
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TaskBottomSheet {...props} />);
    });
    const allText = tree!.root
      .findAll((n) => String(n.type) === 'Text')
      .map((n) => String(n.props.children))
      .join(' ');
    expect(allText).toContain('Concrete pour');
    expect(allText).toContain('Scaffold up');
  });
});

// ---------------------------------------------------------------------------
// TC-5: Next-in-line list
// ---------------------------------------------------------------------------
describe('TC-5: next-in-line list', () => {
  it('renders next-in-line task titles', async () => {
    const nextInLine = [
      makePrereq('n1', 'Roof Battens', 'pending'),
    ];
    const props = { ...defaultProps(), nextInLine };
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TaskBottomSheet {...props} />);
    });
    const allText = tree!.root
      .findAll((n) => String(n.type) === 'Text')
      .map((n) => String(n.props.children))
      .join(' ');
    expect(allText).toContain('Roof Battens');
  });
});

// ---------------------------------------------------------------------------
// TC-6: Quick Action buttons
// ---------------------------------------------------------------------------
describe('TC-6: quick action buttons', () => {
  it('renders Mark as Blocked and See Full Details buttons', async () => {
    const props = defaultProps();
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TaskBottomSheet {...props} />);
    });
    const markBtn = tree!.root.find((n) => n.props.testID === 'action-mark-blocked');
    const detailsBtn = tree!.root.find((n) => n.props.testID === 'action-full-details');
    expect(markBtn).toBeTruthy();
    expect(detailsBtn).toBeTruthy();
  });

  it('calls onMarkBlocked with taskId when Mark as Blocked is pressed', async () => {
    const props = defaultProps();
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TaskBottomSheet {...props} />);
    });
    const btn = tree!.root.find((n) => n.props.testID === 'action-mark-blocked');
    await act(async () => { btn.props.onPress(); });
    expect(props.onMarkBlocked).toHaveBeenCalledWith('task-1');
  });

  it('calls onOpenFullDetails with taskId when See Full Details is pressed', async () => {
    const props = defaultProps();
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TaskBottomSheet {...props} />);
    });
    const btn = tree!.root.find((n) => n.props.testID === 'action-full-details');
    await act(async () => { btn.props.onPress(); });
    expect(props.onOpenFullDetails).toHaveBeenCalledWith('task-1');
  });
});

// ---------------------------------------------------------------------------
// TC-7: Close button
// ---------------------------------------------------------------------------
describe('TC-7: close button', () => {
  it('calls onClose when close button is pressed', async () => {
    const props = defaultProps();
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TaskBottomSheet {...props} />);
    });
    const closeBtn = tree!.root.find((n) => n.props.testID === 'sheet-close-btn');
    await act(async () => { closeBtn.props.onPress(); });
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// TC-8: Optimistic update — local state mirrors mutation
// ---------------------------------------------------------------------------
describe('TC-8: optimistic status update', () => {
  it('fires onUpdateTask immediately (optimistic) without waiting for resolution', async () => {
    // onUpdateTask returns a promise that never resolves to simulate slow network
    let resolveUpdate!: () => void;
    const onUpdateTask = jest.fn(() => new Promise<void>((res) => { resolveUpdate = res; }));
    const props = { ...defaultProps(), onUpdateTask };
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TaskBottomSheet {...props} />);
    });
    const pill = tree!.root.find((n) => n.props.testID === 'status-pill-blocked');
    // Tap the pill — should call onUpdateTask immediately even though promise hasn't resolved
    act(() => { pill.props.onPress(); });
    expect(onUpdateTask).toHaveBeenCalledTimes(1);
    // Resolve the pending promise to avoid open handle warnings
    resolveUpdate();
  });
});
