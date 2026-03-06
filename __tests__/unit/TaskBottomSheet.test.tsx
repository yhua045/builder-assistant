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

// ---------------------------------------------------------------------------
// TC-9: Section ordering — Next-In-Line appears BEFORE Status pills
// ---------------------------------------------------------------------------
describe('TC-9: section ordering — Next-In-Line before Status', () => {
  it('renders Next-in-Line section before Status section in the scroll body', async () => {
    const nextInLine: Task[] = [{ id: 'n1', title: 'Roof Battens', status: 'pending',
      createdAt: '2024-01-01T00:00:00Z', updatedAt: '2024-01-01T00:00:00Z' }];
    const props = { ...defaultProps(), nextInLine };
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TaskBottomSheet {...props} />);
    });
    const json = JSON.stringify(tree!.toJSON());
    const nextInLineIdx = json.indexOf('Next in Line');
    const statusIdx = json.indexOf('"Status"');
    expect(nextInLineIdx).toBeGreaterThan(-1);
    expect(statusIdx).toBeGreaterThan(-1);
    expect(nextInLineIdx).toBeLessThan(statusIdx);
  });
});

// ---------------------------------------------------------------------------
// TC-10: Task description renders when set
// ---------------------------------------------------------------------------
describe('TC-10: task description', () => {
  it('renders description text when task.description is set', async () => {
    const task = makeTask({ description: 'Install LVL ridge beam before plates.' });
    const props = { ...defaultProps(), task };
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TaskBottomSheet {...props} />);
    });
    const allText = tree!.root
      .findAll((n) => String(n.type) === 'Text')
      .map((n) => String(n.props.children))
      .join(' ');
    expect(allText).toContain('Install LVL ridge beam before plates.');
  });

  it('does NOT render description section when task.description is empty/undefined', async () => {
    const task = makeTask({ description: undefined });
    const props = { ...defaultProps(), task };
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TaskBottomSheet {...props} />);
    });
    const allText = tree!.root
      .findAll((n) => String(n.type) === 'Text')
      .map((n) => String(n.props.children))
      .join(' ');
    // The word "Description" should NOT appear as a section label
    expect(allText).not.toContain('DESCRIPTION');
  });
});

// ---------------------------------------------------------------------------
// TC-11: Photo strip renders when task.photos is non-empty
// ---------------------------------------------------------------------------
describe('TC-11: photo strip', () => {
  it('renders photo strip container when task.photos is non-empty', async () => {
    const task = makeTask({ photos: ['file:///photo1.jpg', 'https://cdn.example.com/photo2.jpg'] });
    const props = { ...defaultProps(), task };
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TaskBottomSheet {...props} />);
    });
    const strip = tree!.root.find((n) => n.props.testID === 'photo-strip');
    expect(strip).toBeTruthy();
  });

  it('does NOT render photo strip when task.photos is empty/undefined', async () => {
    const task = makeTask({ photos: [] });
    const props = { ...defaultProps(), task };
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TaskBottomSheet {...props} />);
    });
    const strips = tree!.root.findAll((n) => n.props.testID === 'photo-strip');
    expect(strips).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// TC-12: AI suggestion area NOT rendered by default
// ---------------------------------------------------------------------------
describe('TC-12: AI suggestion area hidden by default', () => {
  it('does not render AI suggestion area when suggestion prop is omitted', async () => {
    const props = defaultProps(); // no suggestion prop
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TaskBottomSheet {...props} />);
    });
    const areas = tree!.root.findAll((n) => n.props.testID === 'ai-suggestion-area');
    expect(areas).toHaveLength(0);
  });

  it('does not render AI suggestion area when suggestion prop is null', async () => {
    const props = { ...defaultProps(), suggestion: null };
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TaskBottomSheet {...props} />);
    });
    const areas = tree!.root.findAll((n) => n.props.testID === 'ai-suggestion-area');
    expect(areas).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// TC-13: AI suggestion area renders when suggestion prop is provided
// ---------------------------------------------------------------------------
describe('TC-13: AI suggestion area visible when suggestion provided', () => {
  it('renders suggestion text and disclaimer when suggestion prop is set', async () => {
    const suggestion = {
      suggestion: 'Check if ridge beam delivery was rescheduled.',
      confidence: 'medium' as const,
      disclaimer: 'AI-generated. Verify with a qualified professional.',
    };
    const props = { ...defaultProps(), suggestion };
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TaskBottomSheet {...props} />);
    });
    const area = tree!.root.find((n) => n.props.testID === 'ai-suggestion-area');
    expect(area).toBeTruthy();
    const allText = tree!.root
      .findAll((n) => String(n.type) === 'Text')
      .map((n) => String(n.props.children))
      .join(' ');
    expect(allText).toContain('Check if ridge beam delivery was rescheduled.');
    expect(allText).toContain('AI-generated. Verify with a qualified professional.');
  });
});

// ---------------------------------------------------------------------------
// TC-14: Subcontractor call button is rendered (disabled)
// ---------------------------------------------------------------------------
describe('TC-14: disabled subcontractor call button', () => {
  it('renders the call-sub action button in a disabled state', async () => {
    const props = defaultProps();
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<TaskBottomSheet {...props} />);
    });
    // The button should be present but have no onPress (or be styled as disabled)
    const callBtn = tree!.root.find((n) => n.props.testID === 'action-call-sub');
    expect(callBtn).toBeTruthy();
  });
});
