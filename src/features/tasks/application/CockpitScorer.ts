/**
 * CockpitScorer — pure functions for cockpit heuristic scoring.
 *
 * All functions are side-effect-free and accept a `now: Date` argument for
 * deterministic, time-injected testing.
 *
 * Domain references:  src/domain/entities/CockpitData.ts
 */

import { Task } from '../../../domain/entities/Task';
import { BlockerItem, BlockerSeverity, FocusItem } from '../../../domain/entities/CockpitData';

// ─── Constants ────────────────────────────────────────────────────────────────

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const BLOCKED_DEPENDENT_BOOST = 50;
const CRITICAL_PATH_BOOST = 200;

const PRIORITY_WEIGHTS: Record<NonNullable<Task['priority']>, number> = {
  urgent: 100,
  high: 70,
  medium: 40,
  low: 10,
};
const DEFAULT_PRIORITY_WEIGHT = 20;

// ─── Exported pure functions ──────────────────────────────────────────────────

/**
 * Returns the priority weight component of the Focus-3 heuristic score.
 */
export function computePriorityWeight(priority: Task['priority']): number {
  if (!priority) return DEFAULT_PRIORITY_WEIGHT;
  return PRIORITY_WEIGHTS[priority] ?? DEFAULT_PRIORITY_WEIGHT;
}

/**
 * Returns a score 0–100 representing how urgently a task's due date demands
 * attention.  Overdue tasks always score 100.  Tasks with no due date score 0.
 */
export function computeDueDateUrgency(dueDateIso: string | undefined, now: Date): number {
  if (!dueDateIso) return 0;
  const diffDays = (new Date(dueDateIso).getTime() - now.getTime()) / MS_PER_DAY;
  if (diffDays < 0) return 100;   // overdue
  if (diffDays < 0.5) return 95;  // today (same calendar day)
  if (diffDays <= 1) return 90;   // tomorrow
  if (diffDays <= 3) return 75;
  if (diffDays <= 7) return 60;
  if (diffDays <= 14) return 30;
  return 10;
}

/**
 * Returns a human-readable urgency label suitable for display on a task card.
 *
 * Examples:
 *   "🔴 3d overdue" | "🟡 Due today" | "🟡 Due tomorrow" | "🟢 5d left" | ""
 */
export function computeUrgencyLabel(dueDateIso: string | undefined, now: Date): string {
  if (!dueDateIso) return '';
  const diffDays = Math.ceil((new Date(dueDateIso).getTime() - now.getTime()) / MS_PER_DAY);
  if (diffDays < 0) return `🔴 ${Math.abs(diffDays)}d overdue`;
  if (diffDays === 0) return '🟡 Due today';
  if (diffDays === 1) return '🟡 Due tomorrow';
  return `🟢 ${diffDays}d left`;
}

/**
 * Given a list of prerequisite tasks, returns the severity of the block they
 * impose, or `null` if none of them is blocking.
 *
 *  - `'red'`    → a prereq has `status='blocked'` OR is overdue by > 2 days
 *  - `'yellow'` → a prereq is overdue by 0–2 days (including today)
 *  - `null`     → all prereqs are fine (completed, cancelled, or on track)
 */
export function computeBlockerSeverity(prereqTasks: Task[], now: Date): BlockerSeverity | null {
  let hasRed = false;
  let hasYellow = false;

  for (const prereq of prereqTasks) {
    if (prereq.status === 'completed' || prereq.status === 'cancelled') continue;

    if (prereq.status === 'blocked') {
      hasRed = true;
      continue;
    }

    if (prereq.dueDate) {
      const daysOverdue = (now.getTime() - new Date(prereq.dueDate).getTime()) / MS_PER_DAY;
      if (daysOverdue > 2) {
        hasRed = true;
      } else if (daysOverdue >= 0) {
        hasYellow = true;
      }
    }
  }

  if (hasRed) return 'red';
  if (hasYellow) return 'yellow';
  return null;
}

/**
 * Computes the composite heuristic score for a task in the Focus-3 ranking.
 *
 * score = priorityWeight + dueDateUrgency + (blockedDependentCount × 50) + criticalPathBoost
 */
export function computeFocus3Score(
  task: Task,
  blockedDependentCount: number,
  now: Date,
): number {
  return (
    computePriorityWeight(task.priority) +
    computeDueDateUrgency(task.dueDate, now) +
    blockedDependentCount * BLOCKED_DEPENDENT_BOOST +
    (task.isCriticalPath ? CRITICAL_PATH_BOOST : 0)
  );
}

/**
 * Identifies all tasks that are actively blocking downstream work.
 *
 * A task appears in the result if:
 *  1. Its own `status` is `'blocked'` (manually blocked), OR
 *  2. At least one of its prerequisites is overdue or blocked
 *     (auto-derived from `prereqsOf` and `taskMap`).
 *
 * Completed and cancelled tasks are never considered blockers.
 */
export function computeBlockers(
  activeTasks: Task[],
  taskMap: Map<string, Task>,
  prereqsOf: Map<string, string[]>,
  dependentsOf: Map<string, string[]>,
  now: Date,
): BlockerItem[] {
  const result: BlockerItem[] = [];

  for (const task of activeTasks) {
    if (task.status === 'completed' || task.status === 'cancelled') continue;

    // ── Case 1: manually blocked ────────────────────────────────────────────
    if (task.status === 'blocked') {
      result.push({
        task,
        severity: 'red',
        blockedPrereqs: [],
        nextInLine: resolveNextInLine(task.id, dependentsOf, taskMap),
      });
      continue;
    }

    // ── Case 2: auto-blocked via prerequisites ──────────────────────────────
    const prereqIds = prereqsOf.get(task.id) ?? [];
    if (prereqIds.length === 0) continue;

    const prereqTasks = prereqIds
      .map(pid => taskMap.get(pid))
      .filter((t): t is Task => t !== undefined);

    const severity = computeBlockerSeverity(prereqTasks, now);
    if (severity === null) continue;

    // Only include the blocking prereqs (exclude completed/cancelled/on-track ones)
    const blockedPrereqs = prereqTasks.filter(p => {
      if (p.status === 'completed' || p.status === 'cancelled') return false;
      if (p.status === 'blocked') return true;
      if (p.dueDate) {
        const daysOverdue = (now.getTime() - new Date(p.dueDate).getTime()) / MS_PER_DAY;
        return daysOverdue >= 0;
      }
      return false;
    });

    result.push({
      task,
      severity,
      blockedPrereqs,
      nextInLine: resolveNextInLine(task.id, dependentsOf, taskMap),
    });
  }

  return result;
}

/**
 * Computes the Focus-3 list: the top 3 non-completed tasks ranked by the
 * heuristic score.
 *
 * Tasks with `status === 'completed'` or `'cancelled'` are excluded.
 * The `blockerTaskIds` parameter is accepted for potential future dual-list
 * deduplication but is not currently used to filter results.
 */
export function computeFocus3(
  activeTasks: Task[],
  taskMap: Map<string, Task>,
  dependentsOf: Map<string, string[]>,
  now: Date,
  _blockerTaskIds: Set<string>,
): FocusItem[] {
  const eligible = activeTasks.filter(
    t => t.status !== 'completed' && t.status !== 'cancelled',
  );

  // Count non-completed dependents for each task (used in scoring)
  const scored = eligible.map(task => {
    const dependentIds = dependentsOf.get(task.id) ?? [];
    const nonCompletedDependents = dependentIds.filter(depId => {
      const dep = taskMap.get(depId);
      return dep !== undefined && dep.status !== 'completed' && dep.status !== 'cancelled';
    });
    return {
      task,
      score: computeFocus3Score(task, nonCompletedDependents.length, now),
    };
  });

  // Sort descending by score, take top 3
  scored.sort((a, b) => b.score - a.score);
  const top3 = scored.slice(0, 3);

  return top3.map(({ task, score }) => ({
    task,
    score,
    urgencyLabel: computeUrgencyLabel(task.dueDate, now),
    nextInLine: resolveNextInLine(task.id, dependentsOf, taskMap),
  }));
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function resolveNextInLine(
  taskId: string,
  dependentsOf: Map<string, string[]>,
  taskMap: Map<string, Task>,
): Task[] {
  const depIds = dependentsOf.get(taskId) ?? [];
  return depIds
    .map(id => taskMap.get(id))
    .filter((t): t is Task => t !== undefined && t.status !== 'completed' && t.status !== 'cancelled');
}
