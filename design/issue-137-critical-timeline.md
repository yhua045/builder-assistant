# Design: Issue #137 — Replace Blocked Carousel with Vertical Timeline (Top-2 per Project)

**Ticket**: [#137](https://github.com/yhua045/builder-assistant/issues/137)  
**Date**: 2026-03-11  
**Status**: DRAFT — awaiting approval before implementation

---

## 1. User Story

> As a builder/project manager, I want the Critical Tasks section on the Task Index screen to show a vertical timeline of the top-2 blocked tasks per project (ordered globally by scheduled/start date), so I can quickly understand the most imminent blockers across all my projects without swiping through a carousel.

---

## 2. Current Behaviour

The "Critical Tasks" section in the Task Index renders `BlockerCarousel.tsx` — a horizontally scrollable carousel of blocker cards. Each card shows a top-level blocker (the entity from `BlockerBarResult`) with downstream "next in line" tasks.

The mock prototype in `TaskDetailsPage.Mock.tsx` already shows an expanded vertical timeline UI (the `/* VISUAL TIMELINE - Top 3 Blockers */` section) that groups by **blocker** entity, not by individual blocked task.

---

## 3. Proposed New Behaviour

Replace the carousel with a **vertical timeline** whose _items are individual blocked tasks_ (those with `status === 'blocked'`), filtered and ordered as follows:

1. **Filter**: only tasks with `status === 'blocked'`.
2. **Group by project**: take at most the **2 earliest** blocked tasks per `projectId` (by `scheduledAt` / `dueDate` ascending).
3. **Global order**: merge the per-project selections and sort the full list by scheduled/start date ascending (earliest first).
4. **Display**: each timeline item shows:
   - Coloured project badge / label
   - Task title
   - Scheduled / start date
   - Blocker severity indicator (derived from parent blocker or task `priority`)

---

## 4. Component Architecture

```
CriticalTasksTimeline            ← new top-level component (replaces BlockerCarousel in this context)
  ├── TimelineConnector          ← thin vertical line + dot (shared sub-component)
  └── TimelineItem               ← single blocked-task row card
        ├── ProjectBadge         ← coloured pill with project name
        └── SeverityBadge        ← severity/priority pill
```

### Files to Create

| File | Purpose |
|------|---------|
| `src/components/tasks/CriticalTasksTimeline.tsx` | Main timeline component |
| `src/utils/selectTopBlockedTasks.ts` | Pure selection/ordering utility |
| `__tests__/unit/selectTopBlockedTasks.test.ts` | Unit tests for the utility |
| `__tests__/unit/CriticalTasksTimeline.test.tsx` | Snapshot + render tests |

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/tasks/TaskDetailsPage.Mock.tsx` | Replace `/* VISUAL TIMELINE - Top 3 Blockers */` section with `<CriticalTasksTimeline>` wired to `BLOCKERS`/`blockedTasks` mock data |
| `src/components/tasks/BlockerCarousel.tsx` | **No deletion** — keep as-is for other usages; `CriticalTasksTimeline` is a new parallel component |

---

## 5. Pure Utility: `selectTopBlockedTasks`

```typescript
// src/utils/selectTopBlockedTasks.ts

export interface BlockedTaskItem {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  projectColor?: string;
  scheduledAt?: string;   // ISO date string — used for ordering
  severity?: 'critical' | 'high' | 'medium' | 'low';
  status: 'blocked' | 'pending';
}

/**
 * From a flat list of blocked task items, returns at most `perProjectLimit`
 * tasks per project (earliest scheduledAt first), then sorts the resulting
 * list globally by scheduledAt ascending.
 *
 * Nullish scheduledAt sorts to the end.
 */
export function selectTopBlockedTasks(
  tasks: BlockedTaskItem[],
  perProjectLimit = 2
): BlockedTaskItem[]
```

**Algorithm**:
1. Group tasks by `projectId`.
2. Within each group, sort by `scheduledAt` ascending (nullish → end), take first `perProjectLimit`.
3. Flatten all groups into one array.
4. Sort globally by `scheduledAt` ascending.

---

## 6. Component API

```typescript
// src/components/tasks/CriticalTasksTimeline.tsx

export interface CriticalTasksTimelineProps {
  /** Pre-selected, globally-ordered blocked task items to render. */
  items: BlockedTaskItem[];
  /** Called when a timeline item is tapped. */
  onItemPress?: (item: BlockedTaskItem) => void;
}

export function CriticalTasksTimeline(props: CriticalTasksTimelineProps): JSX.Element
```

The screen/hook is responsible for calling `selectTopBlockedTasks` and passing the result as `items`. This keeps the component pure/presentational.

---

## 7. Visual Design

Based on the mock timeline already in `TaskDetailsPage.Mock.tsx`:

```
● ─────────────────────────────────────────
│  [Downtown Plaza]              CRITICAL
│  Drywall Installation - Section A
│  📅 Oct 15
│
● ─────────────────────────────────────────
│  [Downtown Plaza]              CRITICAL
│  Painting Prep - Common Areas
│  📅 Oct 15
│
● ─────────────────────────────────────────
│  [Riverside Residence]         HIGH
│  Backfilling Operations
│  📅 Oct 18
│
  ...
```

- Dot colour: red = critical, orange = high, amber = medium
- Connecting line: `bg-border` thin vertical rule
- Card: `bg-card border border-border rounded-2xl p-4` (matches existing design language)
- Project badge: coloured dot + project name (matches mock)
- Severity badge: coloured pill (`CRITICAL` / `HIGH` / `MEDIUM`)
- Last item: no connecting line below its dot

---

## 8. Mapping Mock Data → New Shape

The existing `BLOCKERS[].blockedTasks` in the mock file need to be mapped to `BlockedTaskItem[]` in the mock file. For the real integration, this mapping will come from the repository/use-case layer.

Mock mapping (for `TaskDetailsPage.Mock.tsx` update):
```typescript
const timelineItems: BlockedTaskItem[] = BLOCKERS.flatMap((blocker) =>
  blocker.blockedTasks.map((bt) => ({
    id: bt.id,
    title: bt.title,
    projectId: blocker.project,          // using project name as ID in mock
    projectName: blocker.project,
    projectColor: blocker.projectColor,
    scheduledAt: blocker.startDate,       // best approximation in mock
    severity: blocker.severity,
    status: bt.status,
  }))
);
```

Then pass through `selectTopBlockedTasks(timelineItems, 2)`.

---

## 9. Acceptance Criteria

- [ ] `selectTopBlockedTasks` returns at most 2 tasks per project, globally sorted by scheduledAt ascending.
- [ ] `CriticalTasksTimeline` renders a vertical list of timeline items with dot + connecting line.
- [ ] Each item displays: project name (with colour), task title, scheduled date, severity badge.
- [ ] The mock page (`TaskDetailsPage.Mock.tsx`) uses `CriticalTasksTimeline` for its Critical Tasks section.
- [ ] `BlockerCarousel` is **not removed** (other screens may use it).
- [ ] Unit tests added for `selectTopBlockedTasks` (grouping, ordering, various edge cases).
- [ ] Snapshot/render test added for `CriticalTasksTimeline`.
- [ ] TypeScript strict mode: `npx tsc --noEmit` passes with zero new errors.
- [ ] Responsive: works on small screens (no horizontal overflow).

---

## 10. Out of Scope

- Wiring `CriticalTasksTimeline` to real repository data (a follow-up issue).
- Replacing `BlockerCarousel` on every screen (only the Task Index mock is in scope).
- Backend / use-case changes to `GetBlockerBarDataUseCase`.

---

## 11. Test Plan

### Unit tests — `selectTopBlockedTasks.test.ts`

| # | Scenario | Expected |
|---|----------|----------|
| 1 | Empty input | Returns `[]` |
| 2 | All tasks same project, 5 tasks | Returns 2 (earliest) |
| 3 | 3 projects × 3 tasks each | Returns 2 per project = 6, globally sorted |
| 4 | Tasks with missing `scheduledAt` | Nullish dates sort to end |
| 5 | `perProjectLimit = 1` | Returns 1 per project |
| 6 | Tasks already in reverse order | Output is still ascending |

### Render tests — `CriticalTasksTimeline.test.tsx`

- Snapshot test with 4 items across 2 projects.
- Verify last item has no connecting line.
- Verify `onItemPress` is called with correct item on tap.

---

## 12. Open Questions

1. Should the timeline show a "Show more" / "See all blockers" link if there are >6 items? *(Suggest: yes, link to the full blocker list — defer to follow-up.)*
2. Should `severity` fall back to task `priority` when no explicit severity field exists on the domain `Task`? *(Suggest: yes — derive as `'critical'` → `urgent`, `'high'` → `high`, `'medium'` → `medium`, `'low'` → `low`.)*

---

**Please review and approve this plan before implementation begins.**
