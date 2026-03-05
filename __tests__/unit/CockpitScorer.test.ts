/**
 * Unit tests for CockpitScorer pure functions.
 * These tests are written FIRST (TDD — red phase) before the implementation.
 * Run: npx jest CockpitScorer
 */

import {
  computeUrgencyLabel,
  computeDueDateUrgency,
  computePriorityWeight,
  computeBlockerSeverity,
  computeFocus3Score,
  computeBlockers,
  computeFocus3,
} from '../../src/application/usecases/task/CockpitScorer';
import { Task } from '../../src/domain/entities/Task';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const NOW = new Date('2026-03-05T10:00:00.000Z');

/** Quick task builder */
function makeTask(overrides: Partial<Task>): Task {
  return {
    id: `task_${Math.random().toString(36).slice(2, 8)}`,
    title: 'Test Task',
    status: 'pending',
    ...overrides,
  };
}

function daysFromNow(n: number, base = NOW): string {
  return new Date(base.getTime() + n * 24 * 60 * 60 * 1000).toISOString();
}

// ─── computeUrgencyLabel ──────────────────────────────────────────────────────

describe('computeUrgencyLabel', () => {
  it('returns empty string when no dueDate', () => {
    expect(computeUrgencyLabel(undefined, NOW)).toBe('');
  });

  it('shows overdue count for past due dates', () => {
    const label = computeUrgencyLabel(daysFromNow(-3), NOW);
    expect(label).toBe('🔴 3d overdue');
  });

  it('shows "Due today" when dueDate is today', () => {
    const label = computeUrgencyLabel(daysFromNow(0), NOW);
    expect(label).toBe('🟡 Due today');
  });

  it('shows "Due tomorrow" when dueDate is tomorrow', () => {
    const label = computeUrgencyLabel(daysFromNow(1), NOW);
    expect(label).toBe('🟡 Due tomorrow');
  });

  it('shows days remaining for future due dates', () => {
    const label = computeUrgencyLabel(daysFromNow(5), NOW);
    expect(label).toBe('🟢 5d left');
  });

  it('shows 1d overdue when exactly 1 day past', () => {
    const label = computeUrgencyLabel(daysFromNow(-1), NOW);
    expect(label).toBe('🔴 1d overdue');
  });
});

// ─── computeDueDateUrgency ────────────────────────────────────────────────────

describe('computeDueDateUrgency', () => {
  it('returns 0 when no dueDate', () => {
    expect(computeDueDateUrgency(undefined, NOW)).toBe(0);
  });

  it('returns 100 when overdue', () => {
    expect(computeDueDateUrgency(daysFromNow(-1), NOW)).toBe(100);
  });

  it('returns 95 when due today', () => {
    expect(computeDueDateUrgency(daysFromNow(0), NOW)).toBe(95);
  });

  it('returns 90 when due tomorrow', () => {
    expect(computeDueDateUrgency(daysFromNow(1), NOW)).toBe(90);
  });

  it('returns lower value for more distant due date', () => {
    const closeScore = computeDueDateUrgency(daysFromNow(3), NOW);
    const farScore = computeDueDateUrgency(daysFromNow(14), NOW);
    expect(closeScore).toBeGreaterThan(farScore);
  });
});

// ─── computePriorityWeight ────────────────────────────────────────────────────

describe('computePriorityWeight', () => {
  it('returns 100 for urgent', () => {
    expect(computePriorityWeight('urgent')).toBe(100);
  });

  it('returns 70 for high', () => {
    expect(computePriorityWeight('high')).toBe(70);
  });

  it('returns 40 for medium', () => {
    expect(computePriorityWeight('medium')).toBe(40);
  });

  it('returns 10 for low', () => {
    expect(computePriorityWeight('low')).toBe(10);
  });

  it('returns a default (20) when priority is undefined', () => {
    expect(computePriorityWeight(undefined)).toBe(20);
  });
});

// ─── computeBlockerSeverity ───────────────────────────────────────────────────

describe('computeBlockerSeverity', () => {
  it('returns null when all prereqs are completed', () => {
    const prereqs = [
      makeTask({ status: 'completed' }),
      makeTask({ status: 'cancelled' }),
    ];
    expect(computeBlockerSeverity(prereqs, NOW)).toBeNull();
  });

  it('returns null when there are no prereqs', () => {
    expect(computeBlockerSeverity([], NOW)).toBeNull();
  });

  it('returns red when any prereq is blocked', () => {
    const prereqs = [makeTask({ status: 'blocked' })];
    expect(computeBlockerSeverity(prereqs, NOW)).toBe('red');
  });

  it('returns red when any prereq is overdue by more than 2 days', () => {
    const prereqs = [makeTask({ status: 'in_progress', dueDate: daysFromNow(-3) })];
    expect(computeBlockerSeverity(prereqs, NOW)).toBe('red');
  });

  it('returns yellow when prereq is overdue by 1 day', () => {
    const prereqs = [makeTask({ status: 'in_progress', dueDate: daysFromNow(-1) })];
    expect(computeBlockerSeverity(prereqs, NOW)).toBe('yellow');
  });

  it('returns yellow when prereq is due today and still in_progress', () => {
    const prereqs = [makeTask({ status: 'in_progress', dueDate: daysFromNow(0) })];
    expect(computeBlockerSeverity(prereqs, NOW)).toBe('yellow');
  });

  it('red takes precedence over yellow', () => {
    const prereqs = [
      makeTask({ status: 'in_progress', dueDate: daysFromNow(-1) }), // yellow
      makeTask({ status: 'blocked' }),                                 // red
    ];
    expect(computeBlockerSeverity(prereqs, NOW)).toBe('red');
  });

  it('returns null when prereq is in_progress with a future due date', () => {
    const prereqs = [makeTask({ status: 'in_progress', dueDate: daysFromNow(5) })];
    expect(computeBlockerSeverity(prereqs, NOW)).toBeNull();
  });
});

// ─── computeFocus3Score ───────────────────────────────────────────────────────

describe('computeFocus3Score', () => {
  it('higher priority produces higher score', () => {
    const urgent = makeTask({ priority: 'urgent' });
    const low = makeTask({ priority: 'low' });
    const scoreUrgent = computeFocus3Score(urgent, 0, NOW);
    const scoreLow = computeFocus3Score(low, 0, NOW);
    expect(scoreUrgent).toBeGreaterThan(scoreLow);
  });

  it('overdue task scores higher than same-priority future task', () => {
    const overdue = makeTask({ priority: 'medium', dueDate: daysFromNow(-2) });
    const future = makeTask({ priority: 'medium', dueDate: daysFromNow(10) });
    expect(computeFocus3Score(overdue, 0, NOW)).toBeGreaterThan(computeFocus3Score(future, 0, NOW));
  });

  it('each blocked dependent adds boost to score', () => {
    const task = makeTask({ priority: 'medium' });
    const scoreWithDeps = computeFocus3Score(task, 3, NOW);
    const scoreNoDeps = computeFocus3Score(task, 0, NOW);
    expect(scoreWithDeps).toBeGreaterThan(scoreNoDeps);
    // +50 per blocked dependent
    expect(scoreWithDeps - scoreNoDeps).toBe(150);
  });

  it('isCriticalPath adds +200 boost', () => {
    const normal = makeTask({ priority: 'medium' });
    const critical = makeTask({ priority: 'medium', isCriticalPath: true });
    const diff = computeFocus3Score(critical, 0, NOW) - computeFocus3Score(normal, 0, NOW);
    expect(diff).toBe(200);
  });
});

// ─── computeBlockers ──────────────────────────────────────────────────────────

describe('computeBlockers', () => {
  it('returns empty list when no tasks', () => {
    const result = computeBlockers([], new Map(), new Map(), new Map(), NOW);
    expect(result).toHaveLength(0);
  });

  it('includes manually blocked tasks (status=blocked)', () => {
    const t = makeTask({ status: 'blocked' });
    const taskMap = new Map([[t.id, t]]);
    const result = computeBlockers([t], taskMap, new Map(), new Map(), NOW);
    expect(result).toHaveLength(1);
    expect(result[0].task.id).toBe(t.id);
    expect(result[0].severity).toBe('red');
    expect(result[0].blockedPrereqs).toHaveLength(0);
  });

  it('auto-blocks task whose prerequisite is overdue (red)', () => {
    const prereq = makeTask({ id: 'prereq1', status: 'in_progress', dueDate: daysFromNow(-5) });
    const dependent = makeTask({ id: 'dep1', status: 'pending' });
    const taskMap = new Map([
      [prereq.id, prereq],
      [dependent.id, dependent],
    ]);
    // dependent depends on prereq
    const prereqsOf = new Map([[dependent.id, [prereq.id]]]);
    const dependentsOf = new Map([[prereq.id, [dependent.id]]]);

    const result = computeBlockers([prereq, dependent], taskMap, prereqsOf, dependentsOf, NOW);
    const blockerItem = result.find(b => b.task.id === dependent.id);
    expect(blockerItem).toBeDefined();
    expect(blockerItem!.severity).toBe('red');
    expect(blockerItem!.blockedPrereqs.map(p => p.id)).toContain(prereq.id);
  });

  it('does NOT include completed tasks as blockers', () => {
    const t = makeTask({ status: 'completed' });
    const taskMap = new Map([[t.id, t]]);
    const result = computeBlockers([t], taskMap, new Map(), new Map(), NOW);
    expect(result).toHaveLength(0);
  });

  it('does NOT include cancelled tasks as blockers', () => {
    const t = makeTask({ status: 'cancelled' });
    const taskMap = new Map([[t.id, t]]);
    const result = computeBlockers([t], taskMap, new Map(), new Map(), NOW);
    expect(result).toHaveLength(0);
  });

  it('includes nextInLine in blocker item', () => {
    // taskA is blocked; taskB depends on taskA (waiting for it)
    const taskA = makeTask({ id: 'A', status: 'blocked' });
    const taskB = makeTask({ id: 'B', status: 'pending' });
    const taskMap = new Map([
      [taskA.id, taskA],
      [taskB.id, taskB],
    ]);
    const dependentsOf = new Map([[taskA.id, [taskB.id]]]);

    const result = computeBlockers([taskA, taskB], taskMap, new Map(), dependentsOf, NOW);
    const blockA = result.find(b => b.task.id === taskA.id);
    expect(blockA).toBeDefined();
    expect(blockA!.nextInLine.map(t => t.id)).toContain(taskB.id);
  });

  it('auto-blocks with yellow severity for barely-overdue prereq', () => {
    const prereq = makeTask({ id: 'prereq_y', status: 'in_progress', dueDate: daysFromNow(-1) });
    const dependent = makeTask({ id: 'dep_y', status: 'pending' });
    const taskMap = new Map([[prereq.id, prereq], [dependent.id, dependent]]);
    const prereqsOf = new Map([[dependent.id, [prereq.id]]]);
    const result = computeBlockers([prereq, dependent], taskMap, prereqsOf, new Map(), NOW);
    const item = result.find(b => b.task.id === dependent.id);
    expect(item).toBeDefined();
    expect(item!.severity).toBe('yellow');
  });
});

// ─── computeFocus3 ────────────────────────────────────────────────────────────

describe('computeFocus3', () => {
  it('returns at most 3 items', () => {
    const tasks = Array.from({ length: 10 }, (_, i) =>
      makeTask({ id: `t${i}`, priority: 'medium', dueDate: daysFromNow(i + 1) })
    );
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const result = computeFocus3(tasks, taskMap, new Map(), NOW, new Set());
    expect(result.length).toBeLessThanOrEqual(3);
  });

  it('excludes completed and cancelled tasks', () => {
    const active = makeTask({ id: 'active', status: 'pending', priority: 'urgent' });
    const completed = makeTask({ id: 'done', status: 'completed', priority: 'urgent' });
    const cancelled = makeTask({ id: 'gone', status: 'cancelled', priority: 'urgent' });
    const tasks = [active, completed, cancelled];
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const result = computeFocus3(tasks, taskMap, new Map(), NOW, new Set());
    const ids = result.map(f => f.task.id);
    expect(ids).toContain('active');
    expect(ids).not.toContain('done');
    expect(ids).not.toContain('gone');
  });

  it('orders by score descending', () => {
    const highPriOverdue = makeTask({ id: 'A', priority: 'urgent', dueDate: daysFromNow(-2) });
    const lowPriFuture = makeTask({ id: 'B', priority: 'low', dueDate: daysFromNow(20) });
    const tasks = [lowPriFuture, highPriOverdue]; // intentionally reversed
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const result = computeFocus3(tasks, taskMap, new Map(), NOW, new Set());
    expect(result[0].task.id).toBe('A');
  });

  it('isCriticalPath task outranks high-priority task without flag', () => {
    const critical = makeTask({ id: 'crit', priority: 'low', isCriticalPath: true });
    const highPri = makeTask({ id: 'high', priority: 'high', dueDate: daysFromNow(2) });
    const tasks = [highPri, critical];
    const taskMap = new Map(tasks.map(t => [t.id, t]));
    const result = computeFocus3(tasks, taskMap, new Map(), NOW, new Set());
    expect(result[0].task.id).toBe('crit');
  });

  it('each focusItem has urgencyLabel and nextInLine populated', () => {
    const taskA = makeTask({ id: 'fA', priority: 'high', dueDate: daysFromNow(-1) });
    const taskB = makeTask({ id: 'fB', priority: 'medium' });
    const taskMap = new Map([[taskA.id, taskA], [taskB.id, taskB]]);
    // B depends on A (A is next-in-line for nothing; B waits for A)
    const dependentsOf = new Map([[taskA.id, [taskB.id]]]);

    const result = computeFocus3([taskA], taskMap, dependentsOf, NOW, new Set());
    const item = result.find(f => f.task.id === taskA.id);
    expect(item).toBeDefined();
    expect(item!.urgencyLabel).toBe('🔴 1d overdue');
    expect(item!.nextInLine.map(t => t.id)).toContain(taskB.id);
  });
});
