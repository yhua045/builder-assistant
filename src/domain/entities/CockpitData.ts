import { Task } from './Task';

/**
 * Severity of a blocker:
 *  - 'red'    → a prerequisite is `blocked` or overdue by more than 2 days
 *  - 'yellow' → a prerequisite is overdue by 0–2 days, or `in_progress` past its due date
 */
export type BlockerSeverity = 'red' | 'yellow';

/**
 * A task that cannot proceed because at least one of its prerequisites is
 * not done / not on track, OR the task itself was manually set to `blocked`.
 */
export interface BlockerItem {
  task: Task;
  severity: BlockerSeverity;
  /** The prerequisite tasks that are causing this block. */
  blockedPrereqs: Task[];
  /** Tasks that are waiting on THIS task — will also be blocked if this stays stuck. */
  nextInLine: Task[];
}

/**
 * One of the Focus-3 tasks — the top 3 non-completed tasks ranked by the
 * heuristic score (priority + due-date urgency + blocked-dependents boost +
 * manual critical-path pin boost).
 */
export interface FocusItem {
  task: Task;
  /** Raw heuristic score (higher = more urgent). Exposed for testing. */
  score: number;
  /**
   * Human-readable urgency label, e.g.:
   *   "🔴 3d overdue" | "🟡 Due today" | "🟡 Due tomorrow" | "🟢 5d left" | ""
   */
  urgencyLabel: string;
  /** Tasks that are directly waiting on this task to be completed. */
  nextInLine: Task[];
}

/** The full cockpit payload consumed by `useCockpitData` and the cockpit UI. */
export interface CockpitData {
  blockers: BlockerItem[];
  focus3: FocusItem[];
}

/**
 * Discriminated union returned by `GetBlockerBarDataUseCase` and `useBlockerBar`.
 *
 * - `'blockers'` → at least one project has active blockers. Carries the
 *   resolved projectId, projectName, and the blocker items to display.
 * - `'winning'`  → no project has active blockers. The UI should show the
 *   friendly "You're winning today" empty-state card.
 */
export type BlockerBarResult =
  | {
      kind: 'blockers';
      projectId: string;
      projectName: string;
      blockers: BlockerItem[];
    }
  | { kind: 'winning' };
