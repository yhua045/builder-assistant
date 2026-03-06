/**
 * Unit tests for BlockerCarousel (src/components/tasks/BlockerCarousel.tsx)
 *
 * Updated to use the new BlockerBarResult-based API (issue #123).
 * Covers both kind='blockers' and kind='winning' states.
 *
 * Run: npx jest BlockerCarousel
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { BlockerCarousel } from '../../src/components/tasks/BlockerCarousel';
import type { BlockerBarResult, BlockerItem } from '../../src/domain/entities/CockpitData';
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

const makeBlockerItem = (
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

/** Convenience: wrap one or more BlockerItems in a kind='blockers' result */
function blockersResult(
  items: BlockerItem[],
  projectId = 'p1',
  projectName = 'My Build',
): BlockerBarResult {
  return { kind: 'blockers', projectId, projectName, blockers: items };
}

const WINNING: BlockerBarResult = { kind: 'winning' };

const mockOnCardPress = jest.fn();

beforeEach(() => {
  mockOnCardPress.mockClear();
});

// ---------------------------------------------------------------------------
// TC-1: kind='winning' — renders winning card, no blocker cards
// ---------------------------------------------------------------------------
describe('TC-1: kind=winning renders the winning empty-state card', () => {
  it('shows the winning card with correct message text', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<BlockerCarousel data={WINNING} onCardPress={mockOnCardPress} />);
    });
    const winningCard = tree!.root.find(n => n.props.testID === 'blocker-winning-card');
    expect(winningCard).toBeTruthy();

    const allText = tree!.root
      .findAll(n => String(n.type) === 'Text')
      .map(n => String(n.props.children))
      .join(' ');
    expect(allText).toContain("You're winning today");
    expect(allText).toContain('no active blockers');
  });

  it('does NOT render any blocker cards when kind=winning', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<BlockerCarousel data={WINNING} onCardPress={mockOnCardPress} />);
    });
    const blockerCards = tree!.root.findAll(
      n => typeof n.props.testID === 'string' && n.props.testID.startsWith('blocker-card-'),
    );
    expect(blockerCards).toHaveLength(0);
  });

  it('winning card is non-interactive (no onPress)', async () => {
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<BlockerCarousel data={WINNING} onCardPress={mockOnCardPress} />);
    });
    const winningCard = tree!.root.find(n => n.props.testID === 'blocker-winning-card');
    expect(winningCard.props.onPress).toBeUndefined();
    expect(mockOnCardPress).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// TC-2: kind='blockers' — renders a card per blocker, no winning card
// ---------------------------------------------------------------------------
describe('TC-2: kind=blockers renders a card per blocker', () => {
  it('renders two cards for two blockers', async () => {
    const data = blockersResult([makeBlockerItem('b1', 'red'), makeBlockerItem('b2', 'yellow')]);
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<BlockerCarousel data={data} onCardPress={mockOnCardPress} />);
    });
    expect(tree!.root.find(n => n.props.testID === 'blocker-card-b1')).toBeTruthy();
    expect(tree!.root.find(n => n.props.testID === 'blocker-card-b2')).toBeTruthy();
  });

  it('shows the task title on each card', async () => {
    const data = blockersResult([makeBlockerItem('t1', 'red')]);
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<BlockerCarousel data={data} onCardPress={mockOnCardPress} />);
    });
    const texts = tree!.root
      .findAll(n => String(n.type) === 'Text')
      .map(n => String(n.props.children));
    expect(texts.join(' ')).toContain('Task t1');
  });

  it('does NOT render a winning card when there are blockers', async () => {
    const data = blockersResult([makeBlockerItem('b1', 'red')]);
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<BlockerCarousel data={data} onCardPress={mockOnCardPress} />);
    });
    const winningCards = tree!.root.findAll(n => n.props.testID === 'blocker-winning-card');
    expect(winningCards).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// TC-3: Project name sub-label shown in header for kind=blockers
// ---------------------------------------------------------------------------
describe('TC-3: project name sub-label shown when falling back', () => {
  it('shows project name in the section header area', async () => {
    const data = blockersResult([makeBlockerItem('b1', 'red')], 'p2', 'Reno Project B');
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<BlockerCarousel data={data} onCardPress={mockOnCardPress} />);
    });
    const allText = tree!.root
      .findAll(n => String(n.type) === 'Text')
      .map(n => String(n.props.children))
      .join(' ');
    expect(allText).toContain('Reno Project B');
  });
});

// ---------------------------------------------------------------------------
// TC-4: Severity badges
// ---------------------------------------------------------------------------
describe('TC-4: severity badges', () => {
  it('shows 🔴 BLOCKED badge for red severity', async () => {
    const data = blockersResult([makeBlockerItem('x', 'red')]);
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<BlockerCarousel data={data} onCardPress={mockOnCardPress} />);
    });
    const allText = tree!.root
      .findAll(n => String(n.type) === 'Text')
      .map(n => String(n.props.children))
      .join(' ');
    expect(allText).toContain('🔴 BLOCKED');
  });

  it('shows 🟡 DELAYED badge for yellow severity', async () => {
    const data = blockersResult([makeBlockerItem('y', 'yellow')]);
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<BlockerCarousel data={data} onCardPress={mockOnCardPress} />);
    });
    const allText = tree!.root
      .findAll(n => String(n.type) === 'Text')
      .map(n => String(n.props.children))
      .join(' ');
    expect(allText).toContain('🟡 DELAYED');
  });
});

// ---------------------------------------------------------------------------
// TC-5: Blocked-by and next-in-line labels
// ---------------------------------------------------------------------------
describe('TC-5: prereq and next-in-line labels', () => {
  it('shows "Blocked by: <prereq title>" for the first prereq', async () => {
    const prereq = makeTask('p1', 'Concrete pour');
    const data = blockersResult([makeBlockerItem('b1', 'red', [prereq])]);
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<BlockerCarousel data={data} onCardPress={mockOnCardPress} />);
    });
    const allText = tree!.root
      .findAll(n => String(n.type) === 'Text')
      .map(n => String(n.props.children))
      .join(' ');
    expect(allText).toContain('Concrete pour');
  });

  it('shows "+N tasks waiting" for nextInLine', async () => {
    const waiters = [makeTask('w1', 'W1'), makeTask('w2', 'W2')];
    const data = blockersResult([makeBlockerItem('b1', 'red', [], waiters)]);
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<BlockerCarousel data={data} onCardPress={mockOnCardPress} />);
    });
    const allText = tree!.root
      .findAll(n => String(n.type) === 'Text')
      .map(n => String(n.props.children))
      .join(' ');
    expect(allText).toContain('+2 tasks waiting');
  });
});

// ---------------------------------------------------------------------------
// TC-6: onCardPress callback
// ---------------------------------------------------------------------------
describe('TC-6: onCardPress fires with correct arguments', () => {
  it('calls onCardPress with task, prereqs and nextInLine when card is tapped', async () => {
    const prereq = makeTask('p1', 'Prereq');
    const next = makeTask('n1', 'Next');
    const item = makeBlockerItem('t1', 'red', [prereq], [next]);
    const data = blockersResult([item]);
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<BlockerCarousel data={data} onCardPress={mockOnCardPress} />);
    });
    const card = tree!.root.find(n => n.props.testID === 'blocker-card-t1');
    await act(async () => { card.props.onPress(); });
    expect(mockOnCardPress).toHaveBeenCalledTimes(1);
    expect(mockOnCardPress).toHaveBeenCalledWith(item.task, item.blockedPrereqs, item.nextInLine);
  });
});

// ---------------------------------------------------------------------------
// TC-7: Accessibility on blocker cards
// ---------------------------------------------------------------------------
describe('TC-7: accessibility on blocker cards', () => {
  it('card has accessibilityRole="button"', async () => {
    const data = blockersResult([makeBlockerItem('a1', 'red')]);
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<BlockerCarousel data={data} onCardPress={mockOnCardPress} />);
    });
    const card = tree!.root.find(n => n.props.testID === 'blocker-card-a1');
    expect(card.props.accessibilityRole).toBe('button');
  });

  it('card has non-empty accessibilityLabel', async () => {
    const data = blockersResult([makeBlockerItem('a1', 'red')]);
    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<BlockerCarousel data={data} onCardPress={mockOnCardPress} />);
    });
    const card = tree!.root.find(n => n.props.testID === 'blocker-card-a1');
    expect(card.props.accessibilityLabel).toBeTruthy();
    expect(card.props.accessibilityLabel).toContain('Task a1');
  });
});
