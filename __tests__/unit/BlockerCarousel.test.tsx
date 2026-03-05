/**
 * Unit tests for BlockerCarousel (src/components/tasks/BlockerCarousel.tsx)
 * TDD — written before the component exists (red phase).
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { BlockerCarousel } from '../../src/components/tasks/BlockerCarousel';
import type { BlockerItem } from '../../src/domain/entities/CockpitData';
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

const makeBlocker = (
  id: string,
  severity: 'red' | 'yellow',
  prereqs: Task[] = [],
  nextInLine: Task[] = [],
): BlockerItem => ({
  task: makeTask(id, `Task ${id}`),
  severity,
  blockedPrereqs: prereqs,
  nextInLine,
});

const mockOnCardPress = jest.fn();

beforeEach(() => {
  mockOnCardPress.mockClear();
});

// ---------------------------------------------------------------------------
// TC-1: Renders zero cards when blockers is empty
// ---------------------------------------------------------------------------
describe('TC-1: hides when blockers is empty', () => {
  it('returns null and renders nothing', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<BlockerCarousel blockers={[]} onCardPress={mockOnCardPress} />);
    });
    expect(tree!.toJSON()).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// TC-2: Renders a card for each blocker
// ---------------------------------------------------------------------------
describe('TC-2: renders a card per blocker', () => {
  it('renders two cards for two blockers', async () => {
    const blockers = [
      makeBlocker('b1', 'red'),
      makeBlocker('b2', 'yellow'),
    ];
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<BlockerCarousel blockers={blockers} onCardPress={mockOnCardPress} />);
    });
    // find() throws if not found — this confirms each card is rendered exactly once in the tree
    expect(tree!.root.find((n) => n.props.testID === 'blocker-card-b1')).toBeTruthy();
    expect(tree!.root.find((n) => n.props.testID === 'blocker-card-b2')).toBeTruthy();
  });

  it('shows the task title on each card', async () => {
    const blockers = [makeBlocker('t1', 'red')];
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<BlockerCarousel blockers={blockers} onCardPress={mockOnCardPress} />);
    });
    const texts = tree!.root
      .findAll((n) => String(n.type) === 'Text')
      .map((n) => String(n.props.children));
    expect(texts.join(' ')).toContain('Task t1');
  });
});

// ---------------------------------------------------------------------------
// TC-3: Severity badges
// ---------------------------------------------------------------------------
describe('TC-3: severity badges', () => {
  it('shows 🔴 BLOCKED badge for red severity', async () => {
    const blockers = [makeBlocker('x', 'red')];
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<BlockerCarousel blockers={blockers} onCardPress={mockOnCardPress} />);
    });
    const allText = tree!.root
      .findAll((n) => String(n.type) === 'Text')
      .map((n) => String(n.props.children))
      .join(' ');
    expect(allText).toContain('🔴 BLOCKED');
  });

  it('shows 🟡 DELAYED badge for yellow severity', async () => {
    const blockers = [makeBlocker('y', 'yellow')];
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<BlockerCarousel blockers={blockers} onCardPress={mockOnCardPress} />);
    });
    const allText = tree!.root
      .findAll((n) => String(n.type) === 'Text')
      .map((n) => String(n.props.children))
      .join(' ');
    expect(allText).toContain('🟡 DELAYED');
  });
});

// ---------------------------------------------------------------------------
// TC-4: Blocked-by and next-in-line labels
// ---------------------------------------------------------------------------
describe('TC-4: prereq and next-in-line labels', () => {
  it('shows "Blocked by: <prereq title>" for the first prereq', async () => {
    const prereq = makeTask('p1', 'Concrete pour');
    const blockers = [makeBlocker('b1', 'red', [prereq])];
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<BlockerCarousel blockers={blockers} onCardPress={mockOnCardPress} />);
    });
    const allText = tree!.root
      .findAll((n) => String(n.type) === 'Text')
      .map((n) => String(n.props.children))
      .join(' ');
    expect(allText).toContain('Concrete pour');
  });

  it('shows "+N tasks waiting" for nextInLine', async () => {
    const waiters = [makeTask('w1', 'W1'), makeTask('w2', 'W2')];
    const blockers = [makeBlocker('b1', 'red', [], waiters)];
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<BlockerCarousel blockers={blockers} onCardPress={mockOnCardPress} />);
    });
    const allText = tree!.root
      .findAll((n) => String(n.type) === 'Text')
      .map((n) => String(n.props.children))
      .join(' ');
    expect(allText).toContain('+2 tasks waiting');
  });
});

// ---------------------------------------------------------------------------
// TC-5: onCardPress callback
// ---------------------------------------------------------------------------
describe('TC-5: onCardPress fires with correct arguments', () => {
  it('calls onCardPress with task, prereqs and nextInLine when card is tapped', async () => {
    const prereq = makeTask('p1', 'Prereq');
    const next = makeTask('n1', 'Next');
    const blocker = makeBlocker('t1', 'red', [prereq], [next]);
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<BlockerCarousel blockers={[blocker]} onCardPress={mockOnCardPress} />);
    });
    const card = tree!.root.find((n) => n.props.testID === 'blocker-card-t1');
    await act(async () => { card.props.onPress(); });
    expect(mockOnCardPress).toHaveBeenCalledTimes(1);
    expect(mockOnCardPress).toHaveBeenCalledWith(blocker.task, blocker.blockedPrereqs, blocker.nextInLine);
  });
});

// ---------------------------------------------------------------------------
// TC-6: Accessibility
// ---------------------------------------------------------------------------
describe('TC-6: accessibility', () => {
  it('card has accessibilityRole="button"', async () => {
    const blockers = [makeBlocker('a1', 'red')];
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<BlockerCarousel blockers={blockers} onCardPress={mockOnCardPress} />);
    });
    const card = tree!.root.find((n) => n.props.testID === 'blocker-card-a1');
    expect(card.props.accessibilityRole).toBe('button');
  });

  it('card has non-empty accessibilityLabel', async () => {
    const blockers = [makeBlocker('a1', 'red')];
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<BlockerCarousel blockers={blockers} onCardPress={mockOnCardPress} />);
    });
    const card = tree!.root.find((n) => n.props.testID === 'blocker-card-a1');
    expect(card.props.accessibilityLabel).toBeTruthy();
    expect(card.props.accessibilityLabel).toContain('Task a1');
  });
});
