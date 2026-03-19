# Issue #164 — Dashboard ProjectOverviewCard Redesign

**Date:** 2026-03-20  
**Milestone:** Enhanced dashboard card — Simple & Comprehensive views

---

## 1. User Story

> As a builder scanning my dashboard, I want each project card to show me
> precisely **how far along** each phase is, **which tasks are blocked**, and
> whether a **payment is pending** — all without leaving the dashboard.

---

## 2. Acceptance Criteria

### Simple View (collapsed)
- [x] Title (project name) + "Active Project" subtitle (derived from `project.status`)
- [x] "PENDING PAYMENT" badge on the right — dark background, orange text — shown only when `totalPendingPayment > 0`
- [x] "Overall Progress" label + task count chip (e.g. `6/9 tasks`) using **all** tasks, not just critical-path
- [x] Status-coloured progress bar: green = on_track, orange = at_risk, red = blocked
- [x] Status indicator text ("On Track" / "At Risk" / "Blocked") + overall percentage ("67%")
- [x] "View Details" button (secondary style) with `ChevronDown` icon at bottom of card

### Comprehensive View (expanded per-card)
- [x] Same header row as Simple view
- [x] One `PhaseProgressRow` per project phase:
  - Phase name (e.g. "Phase 1: Foundation & Structure") + inline `BLOCKER` badge if any task in that phase is `blocked`
  - Subtitle: "Critical Path: X/Y tasks completed" (critical-path tasks within that phase)
  - Phase-specific progress bar (coloured by phase blocked status)
  - `TaskIconRow`: up to 6 circular icons — ✓ green (completed), ✗ red (blocked), ⏱ yellow (pending/in_progress)
- [x] "Attention Required" section if any blocked tasks exist — lists blocked task titles
- [x] "Show Less" button with `ChevronUp` in place of "View Details"

---

## 3. Domain Analysis

### 3.1 Gap: Tasks lack phase association

`Task` currently has **no `phaseId`** field. `Project.phases: ProjectPhase[]` exists in the domain
but there is no FK from tasks to phases. Without this, phase-level progress grouping is impossible.

**Decision → add `phaseId?: string` to `Task`.**

This requires:
1. `src/domain/entities/Task.ts` — add optional field
2. `src/infrastructure/database/schema.ts` — add `phase_id TEXT` column
3. `npm run db:generate` migration
4. `DrizzleTaskRepository` — map `phase_id ↔ phaseId`

No existing data is broken (column is nullable, old tasks default to `phaseId: undefined`).

### 3.2 `overallStatus` derivation (pure function, no DB change)

| Condition (checked in order) | `overallStatus` |
|---|---|
| Any project task has `status === 'blocked'` | `'blocked'` |
| `overdueCriticalTasksCount > 0` | `'at_risk'` |
| Otherwise | `'on_track'` |

### 3.3 Progress bar colour tokens

| `overallStatus` / phase blocked | Tailwind class |
|---|---|
| `on_track` | `bg-green-500` |
| `at_risk` | `bg-orange-500` |
| `blocked` | `bg-red-500` |

### 3.4 Expand/Collapse — per-card vs. global toggle

**Current behaviour:** `isComprehensive` is a single boolean in `DashboardScreen`, toggled by
the grid/list icon buttons in the header. All cards expand/collapse together.

**Mock intent:** "View Details" / "Show Less" buttons on _each card_ strongly imply **per-card**
expand state.

**Decision → move expand state into `ProjectOverviewCard` as local `useState<boolean>(false)`**.
Remove the `isComprehensive` prop from the component signature.  
Remove the `LayoutGrid` / `List` icon toggle from the `DashboardScreen` header (no longer needed).

---

## 4. Architecture Changes

### 4.1 Layer dependency diagram (unchanged)

```
DashboardScreen
  └─ ProjectOverviewCard          (UI)
       └─ useProjectsOverview     (Hook)
            └─ toOverview()       (Application pure fn)
                 ├─ ProjectRepository  (Infrastructure)
                 ├─ TaskRepository     (Infrastructure)
                 └─ PaymentRepository  (Infrastructure)
```

### 4.2 Domain — `src/domain/entities/Task.ts`

Add one field **after** `isCriticalPath`:

```typescript
/** Phase this task belongs to (FK to ProjectPhase.id). Optional for ad-hoc tasks. */
phaseId?: string;
```

### 4.3 Database — `src/infrastructure/database/schema.ts`

```typescript
// inside tasks table definition
phaseId: text('phase_id'),
```

Run `npm run db:generate` + restart app for auto-migration.

### 4.4 Application — `src/hooks/useProjectsOverview.ts`

#### New exported types

```typescript
export interface PhaseOverview {
  phase: ProjectPhase;
  tasks: Task[];           // all tasks in this phase
  tasksCompleted: number;
  tasksTotal: number;
  progressPercent: number;
  isBlocked: boolean;      // true if any task.status === 'blocked'
  criticalCompleted: number;
  criticalTotal: number;
}
```

#### Extended `ProjectOverview`

Add to the **existing** interface (additive, no breaking changes):

```typescript
totalTasksCompleted: number;         // all tasks (not just critical)
totalTasksCount: number;             // all tasks
overallStatus: 'on_track' | 'at_risk' | 'blocked';
phaseOverviews: PhaseOverview[];     // one per project phase
blockedTasks: Task[];                // tasks where status === 'blocked'
```

#### `toOverview()` updates

- Compute `totalTasksCount = tasks.length`, `totalTasksCompleted = tasks.filter(completed).length`
- Compute `overallStatus` per §3.2
- Compute `phaseOverviews` by:
  1. Iterating `project.phases`
  2. Filtering `tasks` where `t.phaseId === phase.id`
  3. Building `PhaseOverview` per phase
  4. Appending an synthetic "Unassigned" phase for tasks where `phaseId` is undefined
     (only if at least one unassigned task exists, so existing data renders gracefully)

### 4.5 UI components

#### `PendingPaymentBadge` — re-style only

Current style: orange border + orange text on transparent background.  
Mock style: **dark rounded rectangle** (`bg-zinc-900 dark:bg-zinc-800`) + orange text, no border.  
No prop changes required.

#### `ProjectOverviewCard` — full rewrite of render body

Signature change:

```typescript
// BEFORE
interface ProjectOverviewCardProps {
  overview: ProjectOverview;
  isComprehensive: boolean;  // ← REMOVE
  onPress: () => void;
}

// AFTER
interface ProjectOverviewCardProps {
  overview: ProjectOverview;
  onPress: () => void;
}
```

Internal state: `const [expanded, setExpanded] = useState(false);`

Render structure:

```
<Pressable onPress={onPress}>            ← still navigates to project detail
  <HeaderRow>                            ← title + badge
  <SubtitleRow>                          ← "Active Project" status label
  <ProgressSection>                      ← "Overall Progress" + "6/9 tasks"
    <StatusBar />                        ← coloured by overallStatus
    <StatusRow />                        ← "On Track" text + "67%"
  <ViewDetailsButton onPress={toggle}>   ← ChevronDown | ChevronUp
  {expanded && <ComprehensiveSection />}
</Pressable>
```

#### New sub-components (collocated in `src/pages/dashboard/components/`)

| File | Responsibility |
|---|---|
| `PhaseProgressRow.tsx` | Renders one `PhaseOverview`: name, BLOCKER badge, subtitle, progress bar, `TaskIconRow` |
| `TaskIconRow.tsx` | Renders up to 6 circular icons; green ✓ / red ✗ / yellow ⏱ |
| `AttentionRequiredSection.tsx` | Renders dark card listing `blockedTasks` by title |

#### `DashboardScreen` (`src/pages/dashboard/index.tsx`)

- Remove `isComprehensive` state and the `LayoutGrid`/`List` toggle buttons from header
- Remove `isComprehensive` prop from every `<ProjectOverviewCard />` call

---

## 5. File Change Inventory

| File | Change type |
|---|---|
| `src/domain/entities/Task.ts` | Add `phaseId?: string` |
| `src/infrastructure/database/schema.ts` | Add `phase_id TEXT` to tasks table |
| `src/infrastructure/database/DrizzleTaskRepository.ts` | Map `phaseId` in select/insert/update |
| `src/hooks/useProjectsOverview.ts` | Extend `ProjectOverview`, add `PhaseOverview`, update `toOverview()` |
| `src/components/dashboard/PendingPaymentBadge.tsx` | Re-style to dark bg + orange text |
| `src/pages/dashboard/components/ProjectOverviewCard.tsx` | Full rewrite of render body; remove `isComprehensive` prop |
| `src/pages/dashboard/components/PhaseProgressRow.tsx` | **NEW** |
| `src/pages/dashboard/components/TaskIconRow.tsx` | **NEW** |
| `src/pages/dashboard/components/AttentionRequiredSection.tsx` | **NEW** |
| `src/pages/dashboard/index.tsx` | Remove `isComprehensive` state + header toggle |

---

## 6. Test Acceptance Criteria

### Unit — `toOverview()` (pure function, no DB)

| # | Scenario | Expected |
|---|---|---|
| U1 | All tasks completed, no blocked | `overallStatus === 'on_track'` |
| U2 | One task has `status === 'blocked'` | `overallStatus === 'blocked'` |
| U3 | No blocked tasks, one overdue critical task | `overallStatus === 'at_risk'` |
| U4 | Tasks assigned to two phases | `phaseOverviews.length === 2` |
| U5 | Task with no `phaseId` | Appears in synthetic "Unassigned" phase overview |
| U6 | `totalTasksCount` = all tasks (critical + non-critical) | Numeric equality |
| U7 | `blockedTasks` lists only `status === 'blocked'` tasks | Array filter check |
| U8 | `PhaseOverview.progressPercent` = 0 when phase has no tasks | Returns `0`, no division-by-zero |

### Unit — `PhaseProgressRow` component

| # | Scenario | Expected |
|---|---|---|
| C1 | `isBlocked === true` | "BLOCKER" badge visible |
| C2 | `isBlocked === false` | "BLOCKER" badge absent |
| C3 | `tasks.length > 6` | Only 6 icons rendered |

### Unit — `TaskIconRow`

| # | Icon type | Expected colour |
|---|---|---|
| I1 | `status === 'completed'` | Green check |
| I2 | `status === 'blocked'` | Red X |
| I3 | `status === 'pending'` or `'in_progress'` | Yellow clock |

### Integration — schema migration

| # | Scenario | Expected |
|---|---|---|
| M1 | Existing task row with no `phase_id` | Reads back as `phaseId: undefined` (no crash) |
| M2 | New task created with `phaseId` | Stored and retrieved correctly |

---

## 7. Out of Scope

- Task-to-phase **assignment UI** (editing which phase a task belongs to) — separate issue
- "Attention Required" deep-link to the blocked task detail — separate issue
- Push notifications for blocked tasks — separate issue

---

## 8. Open Questions

1. **"Critical Path: X/Y tasks completed" subtitle on phases** — should "critical path" here mean tasks
   where `isCriticalPath === true` **within the phase**, or is it just all tasks in the phase?
   _Assumption: `isCriticalPath === true && phaseId === phase.id` tasks only._

2. **Max icons in `TaskIconRow`** — mock shows ~6 icons. If a phase has 20 tasks, should we show
   "+N more" or truncate silently? _Assumption: truncate to 6, no overflow indicator for MVP._

3. **Unassigned tasks** — existing data has no `phaseId`. Should the card render an "Unassigned"
   phase row, or hide these tasks entirely in comprehensive view?
   _Assumption: hide unassigned tasks from phase rows to avoid visual noise for existing data._

---

## Handoff

- Label: **Start TDD**
- Agent: **developer**
- Prompt: *"Plan approved. Write failing tests for these requirements per design/issue-164-dashboard-ui.md."*
