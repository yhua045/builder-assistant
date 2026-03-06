# Design: Issue #123 — Blocker Bar: Fallback to Next Project With Blockers

**Date**: 2026-03-06
**Branch**: `issue-123-default-project-fallback`
**Status**: IMPLEMENTED ✅

---

## 1. User Story

> As a builder using the Task Cockpit, I want the Blocker Bar to automatically surface blockers from whichever project currently has them — even if my "first" project is healthy — so I never stare at an empty section that hides real problems elsewhere.

---

## 2. Acceptance Criteria (from issue)

- [x] The Blocker Bar displays blockers from the **first project (in list order) that has active blockers**, falling back from the default (first) project when it has none.
- [x] If **no projects have blockers**, the Blocker Bar shows a friendly `"You're winning today — no active blockers"` message card instead of hiding.
- [x] The fallback is **read-only**: it does not change the app's persistent default project.
- [x] Covered by **unit tests** for the use-case/hook computing Blocker Bar data.
- [x] **Integration sanity check**: Cockpit with seeded projects (one healthy, one with blockers) shows the blocking project in the Blocker Bar.

---

## 3. Current Behaviour (Baseline)

```
TasksScreen
  └── defaultProjectId = projects[0]?.id ?? ''
  └── useCockpitData(defaultProjectId)
        └── GetCockpitDataUseCase.execute(projectId)
              └── returns { blockers: BlockerItem[], focus3: FocusItem[] }
  └── {cockpit?.blockers.length > 0 && <BlockerCarousel blockers={cockpit.blockers} />}
```

**Problem**: when `projects[0]` has no blockers, `BlockerCarousel` renders nothing (`return null`). Blockers on other projects are invisible.

---

## 4. Proposed Design

### 4.1 New Domain Type — `BlockerBarResult`

Add to `src/domain/entities/CockpitData.ts`:

```ts
/**
 * Discriminated union returned by GetBlockerBarDataUseCase.
 *
 * - 'blockers'  → at least one project has active blockers; carry projectId + name for display context.
 * - 'winning'   → no project has active blockers; show the friendly empty-state card.
 */
export type BlockerBarResult =
  | {
      kind: 'blockers';
      projectId: string;
      projectName: string;
      blockers: BlockerItem[];
    }
  | { kind: 'winning' };
```

No changes to the existing `CockpitData` interface (Focus-3 stays per-project, unaffected).

---

### 4.2 New Use Case — `GetBlockerBarDataUseCase`

**File**: `src/application/usecases/task/GetBlockerBarDataUseCase.ts`

```ts
interface ProjectSummary { id: string; name: string; }

class GetBlockerBarDataUseCase {
  constructor(
    private readonly taskRepository: TaskRepository,
  ) {}

  async execute(
    orderedProjects: ProjectSummary[],
    now: Date = new Date(),
  ): Promise<BlockerBarResult> {
    for (const project of orderedProjects) {
      const blockers = await this._computeBlockers(project.id, now);
      if (blockers.length > 0) {
        return { kind: 'blockers', projectId: project.id, projectName: project.name, blockers };
      }
    }
    return { kind: 'winning' };
  }

  private async _computeBlockers(projectId: string, now: Date): Promise<BlockerItem[]> {
    // Re-uses existing CockpitScorer.computeBlockers — same logic, same data loading
    // as GetCockpitDataUseCase.execute() but only returns blockers (no Focus-3 needed here)
    const allTasks = await this.taskRepository.findByProjectId(projectId);
    const activeTasks = allTasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
    if (activeTasks.length === 0) return [];

    const edges = await this.taskRepository.findAllDependencies(projectId);
    const taskMap = new Map(allTasks.map(t => [t.id, t]));
    const prereqsOf = new Map<string, string[]>();
    const dependentsOf = new Map<string, string[]>();
    for (const edge of edges) {
      if (!prereqsOf.has(edge.taskId)) prereqsOf.set(edge.taskId, []);
      prereqsOf.get(edge.taskId)!.push(edge.dependsOnTaskId);
      if (!dependentsOf.has(edge.dependsOnTaskId)) dependentsOf.set(edge.dependsOnTaskId, []);
      dependentsOf.get(edge.dependsOnTaskId)!.push(edge.taskId);
    }
    return computeBlockers(activeTasks, taskMap, prereqsOf, dependentsOf, now);
  }
}
```

**Why a separate use case** rather than modifying `GetCockpitDataUseCase`:
- Single Responsibility: the existing use case computes a full cockpit payload for one project. The new one answers a different query ("find the right project for the Blocker Bar").
- Avoids over-fetching Focus-3 data for every project just to find blockers.

---

### 4.3 New Hook — `useBlockerBar`

**File**: `src/hooks/useBlockerBar.ts`

```ts
export interface UseBlockerBarReturn {
  result: BlockerBarResult | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useBlockerBar(projects: Project[]): UseBlockerBarReturn
```

- Resolves `TaskRepository` from DI container (same pattern as `useCockpitData`).
- Instantiates `GetBlockerBarDataUseCase`.
- Re-runs whenever `projects` array reference changes (guard with stable id-list string).
- Returns `null` while loading (component can show a skeleton or nothing).

**`useCockpitData` is not replaced** — it continues to serve the Focus-3 list for the default project. Only the Blocker Bar source changes.

---

### 4.4 Updated `BlockerCarousel` Props

**File**: `src/components/tasks/BlockerCarousel.tsx`

Current props:
```ts
export interface BlockerCarouselProps {
  blockers: BlockerItem[];
  onCardPress: (task: Task, prereqs: Task[], nextInLine: Task[]) => void;
}
```

Proposed change — accept `BlockerBarResult` instead:

```ts
export interface BlockerCarouselProps {
  data: BlockerBarResult;
  onCardPress: (task: Task, prereqs: Task[], nextInLine: Task[]) => void;
}
```

Rendering logic:

| `data.kind`  | Rendered output |
|---|---|
| `'blockers'` | Existing blocker cards (unchanged). Optionally: small project name subtitle `"⛔ Blockers · {projectName}"` |
| `'winning'`  | Single card with green styling: `"🎉 You're winning today — no active blockers"` |

The component is **never** hidden when `data` is provided. The `return null` guard is removed (caller passes the result directly).

---

### 4.5 Updated `TasksScreen`

**File**: `src/pages/tasks/index.tsx`

```diff
- const { cockpit, refresh: refreshCockpit } = useCockpitData(defaultProjectId);
+ const { result: blockerBarResult, refresh: refreshBlockerBar } = useBlockerBar(projects);
```

Render:

```diff
- {cockpit && cockpit.blockers.length > 0 && (
-   <BlockerCarousel blockers={cockpit.blockers} onCardPress={...} />
- )}
+ {blockerBarResult && (
+   <BlockerCarousel data={blockerBarResult} onCardPress={...} />
+ )}
```

Focus-3 keeps its own hook:
```ts
const { cockpit } = useCockpitData(defaultProjectId); // unchanged — Focus-3 only
```

---

## 5. Data Flow (After)

```
TasksScreen
  ├── useBlockerBar(projects)              ← NEW
  │     └── GetBlockerBarDataUseCase
  │           iterates projects in order
  │           └── returns BlockerBarResult ('blockers' | 'winning')
  │
  ├── useCockpitData(defaultProjectId)     ← unchanged (Focus-3)
  │
  └── <BlockerCarousel data={blockerBarResult} />
        ├── kind='blockers' → existing cards (+ project name label)
        └── kind='winning'  → green "You're winning" card
```

---

## 6. Test Plan

### 6.1 Unit Tests — `GetBlockerBarDataUseCase`

**File**: `__tests__/unit/GetBlockerBarDataUseCase.test.ts`

| # | Scenario | Expected `BlockerBarResult` |
|---|---|---|
| 1 | Single project, has active blockers | `{ kind: 'blockers', projectId: 'p1', ... }` |
| 2 | First project healthy, second has blockers | `{ kind: 'blockers', projectId: 'p2', ... }` |
| 3 | All projects healthy (no blockers) | `{ kind: 'winning' }` |
| 4 | Empty project list | `{ kind: 'winning' }` |
| 5 | First project has blockers (short-circuits, doesn't query p2) | `{ kind: 'blockers', projectId: 'p1', ... }` |
| 6 | Project with only completed/cancelled tasks has no blockers | falls through to next project |

### 6.2 Unit Tests — `useBlockerBar` hook

**File**: `__tests__/unit/useBlockerBar.test.ts`

- Returns `loading: true` initially, `loading: false` after resolve.
- Calls `GetBlockerBarDataUseCase.execute` with ordered `[{ id, name }]` from projects prop.
- Re-fetches when projects list changes (id-list changes).
- Propagates `refresh()` call.

### 6.3 Unit Tests — `BlockerCarousel` component

**File**: `__tests__/unit/BlockerCarousel.test.tsx` (new or extend existing)

- Renders blocker cards when `data.kind === 'blockers'`.
- Renders winning message card when `data.kind === 'winning'`.
- Winning card has `testID="blocker-winning-card"` and correct text.
- `onCardPress` is not called for the winning card (read-only).

### 6.4 Integration Sanity Test

**File**: `__tests__/integration/TasksScreen.cockpit.integration.test.tsx` (extend)

Add a new describe block:

- Seed: project `p1` (no blockers) + project `p2` (1 task `blocked`).
- Mock `useBlockerBar` returning `{ kind: 'blockers', projectId: 'p2', blockers: [...] }`.
- Assert: `BlockerCarousel` renders the blocker card for `p2`'s task.
- Mock `useBlockerBar` returning `{ kind: 'winning' }`.
- Assert: winning card is rendered; no blocker cards present.

---

## 7. Files Touched

| File | Change Type |
|---|---|
| `src/domain/entities/CockpitData.ts` | Add `BlockerBarResult` type |
| `src/application/usecases/task/GetBlockerBarDataUseCase.ts` | **NEW** |
| `src/hooks/useBlockerBar.ts` | **NEW** |
| `src/components/tasks/BlockerCarousel.tsx` | Props change + winning-state rendering |
| `src/pages/tasks/index.tsx` | Switch from `useCockpitData` to `useBlockerBar` for Blocker Bar |
| `__tests__/unit/GetBlockerBarDataUseCase.test.ts` | **NEW** |
| `__tests__/unit/useBlockerBar.test.ts` | **NEW** |
| `__tests__/unit/BlockerCarousel.test.tsx` | **NEW** |
| `__tests__/integration/TasksScreen.cockpit.integration.test.tsx` | Extend |

---

## 8. Out of Scope

- Changing the persistent default project.
- Focus-3 list fallback (remains tied to `projects[0]`).
- Per-project Blocker Bar filtering UI.
- Winning message animation / haptics.

---

## 9. Open Questions

1. **Project name label**: Should the Blocker Bar sub-header show the project name when falling back (e.g., `"⛔ Blockers · Reno Project B"`)? Useful context but adds complexity to `BlockerCarousel`. → Default: **yes, show project name** as a subtle sub-label when `kind === 'blockers'`.
2. **Performance**: iterating all projects sequentially could be slow if a user has many projects. For now this is acceptable (<10 projects typical). Future: Promise.all with early exit via `find`. ***yes***
3. **`useBlockerBar` dependency array**: should it track the full `projects` array or just a stable `projectIds` string? → Use stable id-list string to avoid unnecessary re-fetches. ***yes, for the time being*** but we will need to enhance it so it works across different projects because different tasks have different 'weight'

---

## 10. Approval Gate

**Implementation will not begin until this design is explicitly approved.**

Reviewer checklist:
- [ ] Domain type (`BlockerBarResult`) design is correct and minimal
- [ ] Use case approach (iterate, short-circuit) is understood and accepted
- [ ] `BlockerCarousel` props change is backward-compatible enough (or a migration plan exists)
- [ ] Test plan covers all acceptance criteria
- [ ] Winning message copy confirmed: `"You're winning today — no active blockers"`
