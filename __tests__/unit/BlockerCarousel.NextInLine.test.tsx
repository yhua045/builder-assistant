/**
 * Unit tests: BlockerCarousel — Next-In-Line inline preview (issue #131)
 *
 * Tests T1 and T2 from issue-131 acceptance criteria:
 *   T1: BlockerCarousel renders nextInLine items inside each card (1-3 names visible)
 *   T2: Tapping a BlockerCard calls onCardPress(task) with ONLY task arg (no prereqs/nextInLine)
 *
 * Run: npx jest BlockerCarousel.NextInLine
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { BlockerCarousel } from '../../src/features/tasks/components/BlockerCarousel';
import type { BlockerBarResult, BlockerItem } from '../../src/domain/entities/CockpitData';
import type { Task } from '../../src/domain/entities/Task';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeTask = (id: string, title: string, status: Task['status'] = 'pending'): Task => ({
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

function blockersResult(items: BlockerItem[]): BlockerBarResult {
  return { kind: 'blockers', projectId: 'p1', projectName: 'Test Project', blockers: items };
}

// ---------------------------------------------------------------------------
// T1: BlockerCarousel renders nextInLine titles inside each card
// ---------------------------------------------------------------------------
describe('T1: NextInLinePreview renders downstream task titles inside BlockerCard', () => {
  it('shows nextInLine task title inside the blocker card', async () => {
    const waiter1 = makeTask('w1', 'Foundation Inspection');
    const waiter2 = makeTask('w2', 'Frame Delivery');
    const item = makeBlockerItem('b1', 'red', [], [waiter1, waiter2]);
    const data = blockersResult([item]);

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<BlockerCarousel data={data} onCardPress={jest.fn()} />);
    });

    const allText = tree!.root
      .findAll((n) => String(n.type) === 'Text')
      .map((n) => String(n.props.children))
      .join(' ');

    expect(allText).toContain('Foundation Inspection');
    expect(allText).toContain('Frame Delivery');
  });

  it('shows at most 3 nextInLine items even when there are more', async () => {
    const waiters = [
      makeTask('w1', 'Task W1'),
      makeTask('w2', 'Task W2'),
      makeTask('w3', 'Task W3'),
      makeTask('w4', 'Task W4 — should not appear'),
    ];
    const item = makeBlockerItem('b1', 'red', [], waiters);
    const data = blockersResult([item]);

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<BlockerCarousel data={data} onCardPress={jest.fn()} />);
    });

    const allText = tree!.root
      .findAll((n) => String(n.type) === 'Text')
      .map((n) => String(n.props.children))
      .join(' ');

    expect(allText).toContain('Task W1');
    expect(allText).toContain('Task W2');
    expect(allText).toContain('Task W3');
    expect(allText).not.toContain('Task W4');
  });

  it('renders nothing for nextInLine when tasks array is empty', async () => {
    const item = makeBlockerItem('b1', 'red', [], []);
    const data = blockersResult([item]);

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<BlockerCarousel data={data} onCardPress={jest.fn()} />);
    });

    // No crash — component renders fine
    const card = tree!.root.find((n) => n.props.testID === 'blocker-card-b1');
    expect(card).toBeTruthy();

    // No "Next in line" label should appear when there are no downstream tasks
    const allText = tree!.root
      .findAll((n) => String(n.type) === 'Text')
      .map((n) => String(n.props.children))
      .join(' ');
    expect(allText).not.toContain('Next in line');
  });

  it('shows "Next in line" section label when there are nextInLine tasks', async () => {
    const waiter = makeTask('w1', 'Downstream Task');
    const item = makeBlockerItem('b1', 'red', [], [waiter]);
    const data = blockersResult([item]);

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<BlockerCarousel data={data} onCardPress={jest.fn()} />);
    });

    const allText = tree!.root
      .findAll((n) => String(n.type) === 'Text')
      .map((n) => String(n.props.children))
      .join(' ');

    expect(allText).toContain('Next in line');
    expect(allText).toContain('Downstream Task');
  });
});

// ---------------------------------------------------------------------------
// T2: onCardPress is called with only task (not prereqs/nextInLine)
// ---------------------------------------------------------------------------
describe('T2: onCardPress fires with only (task) argument', () => {
  it('calls onCardPress with just the task, no extra args', async () => {
    const prereq = makeTask('p1', 'Prereq Task');
    const waiter = makeTask('w1', 'Waiting Task');
    const item = makeBlockerItem('t1', 'red', [prereq], [waiter]);
    const data = blockersResult([item]);

    const onCardPress = jest.fn();

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<BlockerCarousel data={data} onCardPress={onCardPress} />);
    });

    const card = tree!.root.find((n) => n.props.testID === 'blocker-card-t1');
    await act(async () => {
      card.props.onPress();
    });

    expect(onCardPress).toHaveBeenCalledTimes(1);
    // New signature: called with ONLY the task object — no second/third args
    expect(onCardPress).toHaveBeenCalledWith(item.task);
    const callArgs = onCardPress.mock.calls[0];
    expect(callArgs).toHaveLength(1);
  });

  it('does NOT pass prereqs or nextInLine as arguments to onCardPress', async () => {
    const item = makeBlockerItem('t2', 'yellow', [makeTask('p1', 'P1')], [makeTask('n1', 'N1')]);
    const data = blockersResult([item]);
    const onCardPress = jest.fn();

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<BlockerCarousel data={data} onCardPress={onCardPress} />);
    });

    const card = tree!.root.find((n) => n.props.testID === 'blocker-card-t2');
    await act(async () => { card.props.onPress(); });

    // Extra arguments should NOT be provided
    const [firstArg, secondArg] = onCardPress.mock.calls[0];
    expect(firstArg).toEqual(item.task);
    expect(secondArg).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// T3 (regression): kind='winning' still renders winning card
// ---------------------------------------------------------------------------
describe('T3: kind=winning regression — winning card still renders', () => {
  it('shows winning card after the nextInLine refactor', async () => {
    const WINNING: BlockerBarResult = { kind: 'winning' };

    let tree: renderer.ReactTestRenderer;
    await act(async () => {
      tree = renderer.create(<BlockerCarousel data={WINNING} onCardPress={jest.fn()} />);
    });

    const winningCard = tree!.root.find((n) => n.props.testID === 'blocker-winning-card');
    expect(winningCard).toBeTruthy();
  });
});
