/**
 * Unit tests for FocusList (src/components/tasks/FocusList.tsx)
 * TDD — written before the component exists (red phase).
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { FocusList } from '../../src/components/tasks/FocusList';
import type { FocusItem } from '../../src/domain/entities/CockpitData';
import type { Task } from '../../src/domain/entities/Task';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeTask = (id: string, title: string, status: Task['status'] = 'in_progress'): Task => ({
  id,
  title,
  status,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
});

const makeFocusItem = (
  id: string,
  urgencyLabel = '',
  score = 100,
  nextInLine: Task[] = [],
): FocusItem => ({
  task: makeTask(id, `Task ${id}`),
  score,
  urgencyLabel,
  nextInLine,
});

const mockOnItemPress = jest.fn();

beforeEach(() => {
  mockOnItemPress.mockClear();
});

// ---------------------------------------------------------------------------
// TC-1: Hides when focusItems is empty
// ---------------------------------------------------------------------------
describe('TC-1: hides when focusItems is empty', () => {
  it('returns null and renders nothing', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<FocusList focusItems={[]} onItemPress={mockOnItemPress} />);
    });
    expect(tree!.toJSON()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// TC-2: Renders up to 3 rows
// ---------------------------------------------------------------------------
describe('TC-2: renders rows for each item', () => {
  it('renders one row for each item (up to 3)', async () => {
    const items = [
      makeFocusItem('f1', '🔴 3d overdue', 245),
      makeFocusItem('f2', '🟡 Due today', 180),
      makeFocusItem('f3', '🟢 5d left', 110),
    ];
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<FocusList focusItems={items} onItemPress={mockOnItemPress} />);
    });
    // find() throws if not found — confirms each row is present in the render tree
    expect(tree!.root.find((n) => n.props.testID === 'focus-item-f1')).toBeTruthy();
    expect(tree!.root.find((n) => n.props.testID === 'focus-item-f2')).toBeTruthy();
    expect(tree!.root.find((n) => n.props.testID === 'focus-item-f3')).toBeTruthy();
  });

  it('shows task titles', async () => {
    const items = [makeFocusItem('f1', '', 100)];
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<FocusList focusItems={items} onItemPress={mockOnItemPress} />);
    });
    const allText = tree!.root
      .findAll((n) => String(n.type) === 'Text')
      .map((n) => String(n.props.children))
      .join(' ');
    expect(allText).toContain('Task f1');
  });
});

// ---------------------------------------------------------------------------
// TC-3: Urgency label
// ---------------------------------------------------------------------------
describe('TC-3: urgency label is displayed', () => {
  it('shows urgencyLabel when present', async () => {
    const items = [makeFocusItem('f1', '🔴 3d overdue', 200)];
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<FocusList focusItems={items} onItemPress={mockOnItemPress} />);
    });
    const allText = tree!.root
      .findAll((n) => String(n.type) === 'Text')
      .map((n) => String(n.props.children))
      .join(' ');
    expect(allText).toContain('🔴 3d overdue');
  });

  it('does not show urgency text element when urgencyLabel is empty', async () => {
    const items = [makeFocusItem('f1', '', 100)];
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<FocusList focusItems={items} onItemPress={mockOnItemPress} />);
    });
    const allText = tree!.root
      .findAll((n) => String(n.type) === 'Text')
      .map((n) => String(n.props.children))
      .join(' ');
    expect(allText).not.toContain('🔴');
  });
});

// ---------------------------------------------------------------------------
// TC-4: Score display
// ---------------------------------------------------------------------------
describe('TC-4: score is displayed', () => {
  it('shows the numeric score', async () => {
    const items = [makeFocusItem('f1', '', 245)];
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<FocusList focusItems={items} onItemPress={mockOnItemPress} />);
    });
    const allText = tree!.root
      .findAll((n) => String(n.type) === 'Text')
      .map((n) => String(n.props.children))
      .join(' ');
    expect(allText).toContain('245');
  });
});

// ---------------------------------------------------------------------------
// TC-5: Next-in-line count
// ---------------------------------------------------------------------------
describe('TC-5: nextInLine count shown when > 0', () => {
  it('shows "N tasks waiting" when nextInLine is non-empty', async () => {
    const waiters = [makeTask('w1', 'W1'), makeTask('w2', 'W2')];
    const items = [makeFocusItem('f1', '', 100, waiters)];
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<FocusList focusItems={items} onItemPress={mockOnItemPress} />);
    });
    const allText = tree!.root
      .findAll((n) => String(n.type) === 'Text')
      .map((n) => String(n.props.children))
      .join(' ');
    expect(allText).toContain('2 tasks waiting');
  });
});

// ---------------------------------------------------------------------------
// TC-6: Rank badges
// ---------------------------------------------------------------------------
describe('TC-6: rank badges', () => {
  it('shows #1, #2, #3 rank badges for 3 items', async () => {
    const items = [
      makeFocusItem('f1', '', 300),
      makeFocusItem('f2', '', 200),
      makeFocusItem('f3', '', 100),
    ];
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<FocusList focusItems={items} onItemPress={mockOnItemPress} />);
    });
    const allText = tree!.root
      .findAll((n) => String(n.type) === 'Text')
      .map((n) => String(n.props.children))
      .join(' ');
    expect(allText).toContain('#1');
    expect(allText).toContain('#2');
    expect(allText).toContain('#3');
  });
});

// ---------------------------------------------------------------------------
// TC-7: onItemPress callback
// ---------------------------------------------------------------------------
describe('TC-7: onItemPress fires with correct task', () => {
  it('calls onItemPress with the task when row is tapped', async () => {
    const item = makeFocusItem('f1', '', 100);
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<FocusList focusItems={[item]} onItemPress={mockOnItemPress} />);
    });
    const row = tree!.root.find((n) => n.props.testID === 'focus-item-f1');
    await act(async () => { row.props.onPress(); });
    expect(mockOnItemPress).toHaveBeenCalledTimes(1);
    expect(mockOnItemPress).toHaveBeenCalledWith(item.task, [], item.nextInLine);
  });
});
