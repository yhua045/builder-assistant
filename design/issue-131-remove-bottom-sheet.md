# Design: Issue #131 — Remove TaskBottomSheet, move Next-In-Line into BlockerCard, redirect to TaskDetail

**Branch**: `issue-131-remove-bottom-sheet`  
**Date**: 2026-03-06  
**Status**: PENDING APPROVAL

---

## 1. User Story

> As an on-site builder, I want to tap a blocker card and land directly on the full Task Detail screen — without an intermediate bottom sheet — so that I can act on a task with fewer taps.

---

## 2. Motivation / Context

`TaskBottomSheet` is a slide-up modal that opens when a `BlockerCard` is tapped. It shows:
- Task status/priority pill selectors (optimistic update)
- AI suggestion panel
- Prerequisites list
- **Next-In-Line** (downstream tasks, 1-3 items)
- A "Full Details" button that navigates to `TaskDetailsPage`

It is an **unnecessary intermediate step**: every meaningful action (edit status, edit priority, view delay reasons) is already available on `TaskDetailsPage`. Removing it:
1. Reduces taps from 2 → 1 to reach full details.
2. Eliminates two navigation patterns for the same destination.
3. Simplifies state management in `TasksScreen` (`index.tsx`).

---

## 3. Current Architecture

```
BlockerCarousel (onCardPress)
  └─► TasksScreen.openSheet()
        └─► TaskBottomSheet (Modal, visible)
              ├─ Status / Priority pills  ── optimistic updateTask()
              ├─ AI suggestion panel      ── useTaskDetail hook
              ├─ Next-In-Line list        ── nextInLine: Task[]
              └─ "Full Details" button    ── navigation.navigate('TaskDetails')
```

Relevant files today:
| File | Role |
|---|---|
| `src/components/tasks/TaskBottomSheet.tsx` | The component to be removed |
| `src/components/tasks/BlockerCarousel.tsx` | Renders `BlockerCard` rows; fires `onCardPress` |
| `src/pages/tasks/index.tsx` | Wires sheet open/close state; holds `useTaskDetail` |
| `src/pages/tasks/TaskDetailsPage.tsx` | Full Task Detail page (target navigation destination) |
| `src/hooks/useCockpitData.ts` | Supplies `BlockerBarResult` (includes `nextInLine: Task[]`) |
| `src/hooks/useTaskDetail.ts` | Fetches optional AI suggestion for open task |

---

## 4. Proposed Architecture

```
BlockerCarousel (onCardPress)
  └─► TasksScreen.handleBlockerCardPress()
        └─► navigation.navigate('TaskDetails', { taskId })
                (no sheet, no intermediate state)

TaskDetailsPage
  ├─ (existing) Delay / dependency / document sections
  ├─ (existing) Delete / edit actions
  ├─ (NEW) Status / Priority quick-edit row          ← from TaskBottomSheet
  ├─ (NEW) Next-In-Line preview section (1-3 tasks)  ← from TaskBottomSheet
  └─ (existing) AI suggestion (via useTaskDetail)    ← already usable here
```

`BlockerCard` inside `BlockerCarousel` will show a **Next-In-Line inline preview** (1-3 downstream tasks with status badge and impact delta) without waiting for a sheet — keep it read-only and lightweight (data already present in `BlockerBarResult.blockers[n].nextInLine`).

---

## 5. Detailed Changes

### 5.1 Delete `TaskBottomSheet`
- Remove `src/components/tasks/TaskBottomSheet.tsx` entirely.
- No other file outside `src/pages/tasks/index.tsx` imports it.

### 5.2 Update `src/pages/tasks/index.tsx`
Remove:
- `import { TaskBottomSheet }` (line 16)
- `import { useTaskDetail }` (line 12) — only used for sheet's AI panel
- All sheet state variables: `sheetVisible`, `sheetTask`, `sheetPrereqs`, `sheetNextInLine`, `sheetProject`
- Handlers: `openSheet`, `closeSheet`, `handleSheetUpdate`, `handleOpenFullDetails`, `handleMarkBlocked`
- `<TaskBottomSheet>` JSX block (~lines 188–210)

Add:
```ts
const handleBlockerCardPress = useCallback((task: Task) => {
  navigation.navigate('TaskDetails', { taskId: task.id });
}, [navigation]);
```

Update `BlockerCarousel` prop:
```tsx
// Before
onCardPress={(task, prereqs, nextInLine) => openSheet(task, prereqs, nextInLine)}

// After
onCardPress={(task) => handleBlockerCardPress(task)}
```

### 5.3 Update `src/components/tasks/BlockerCarousel.tsx`
Simplify `BlockerCarouselProps`:
```ts
// Before
onCardPress: (task: Task, prereqs: Task[], nextInLine: Task[]) => void;

// After
onCardPress: (task: Task) => void;
```

Add `NextInLinePreview` sub-component (inline, within the same file) that renders up to 3 items from `item.nextInLine`:
```tsx
function NextInLinePreview({ tasks }: { tasks: Task[] }) {
  if (!tasks.length) return null;
  return (
    <View style={styles.nextInLineContainer}>
      <Text style={styles.nextInLineLabel}>Next in line</Text>
      {tasks.slice(0, 3).map((t) => (
        <View key={t.id} style={styles.nextInLineRow}>
          <StatusDot status={t.status} />
          <Text style={styles.nextInLineTitle} numberOfLines={1}>{t.title}</Text>
        </View>
      ))}
    </View>
  );
}
```

Render `<NextInLinePreview tasks={item.nextInLine} />` inside the existing `BlockerCard` tile body (after the severity/date row).

Update `onPress` handler to pass only `task`:
```tsx
onPress={() => onCardPress(item.task)
```

### 5.4 Update `src/pages/tasks/TaskDetailsPage.tsx`
Add **Status & Priority quick-edit row** near the top of the scroll area (below the title/header, before the existing sections). This replicates the pill selectors from the sheet:
```tsx
<StatusPriorityRow
  status={task.status}
  priority={task.priority}
  onStatusChange={handleStatusChange}
  onPriorityChange={handlePriorityChange}
/>
```
- `handleStatusChange` calls `updateTask({ ...task, status })`; optimistic approach — update local state then persist.
- `handlePriorityChange` similarly.

> **Implementation note**: extract `StatusPriorityRow` as a small presentational component in `src/components/tasks/StatusPriorityRow.tsx` for testability.

Add **Next-In-Line section** after the status row: load downstream tasks via a new lightweight query in `useTasks` (or reuse `taskDetail.dependencies` filtered to `prerequisiteOf`). Show 1-3 items read-only.

> **AI suggestion**: `useTaskDetail` is already available or can be called within `TaskDetailsPage` since the task and project are available there. No changes to the hook interface are needed.

### 5.5 Hooks — `useTaskDetail`
No interface changes required. `TaskDetailsPage` can call `useTaskDetail(task, project)` directly using the resolved project from the DI container or route context.

### 5.6 `useCockpitData` 
No changes required — `nextInLine` data is already present in `BlockerBarResult.blockers[n].nextInLine` and flows to `BlockerCarousel`.

---

## 6. Component Sketch

### BlockerCard (updated)
```
┌──────────────────────────────────────────┐
│ 🔴 Task Title                    📅 Mar 8│
│ 2 prereqs blocking                        │
│ ─────────────────────────────────────────│
│ Next in line                              │
│  ⏳ Foundation inspection                 │
│  ⏳ Frame delivery                        │
└──────────────────────────────────────────┘
```
(Tap → full TaskDetailsPage)

### TaskDetailsPage (updated)
```
← Back    Task Title               [Edit] [Delete]

[ Pending ] [ In Progress ] [ Blocked ] [ Done ]  ← NEW
[ 🔴 Urgent ] [ 🟠 High ] [ 🟡 Medium ] [ 🟢 Low ] ← NEW

📅 Due: Mar 8   ⏱ Est: 3 days

── Next in Line ──────────────────────────────── ← NEW
⏳ Foundation inspection
⏳ Frame delivery

── Dependencies ... (existing)
── Documents ...    (existing)
── Delay Reasons ... (existing)
```

---

## 7. Files Changed

| Action | File |
|---|---|
| Delete | `src/components/tasks/TaskBottomSheet.tsx` |
| Update | `src/pages/tasks/index.tsx` |
| Update | `src/components/tasks/BlockerCarousel.tsx` |
| Update | `src/pages/tasks/TaskDetailsPage.tsx` |
| Create | `src/components/tasks/StatusPriorityRow.tsx` |
| Delete/Update | `__tests__/unit/BlockerCarousel.test.tsx` |
| Create | `__tests__/unit/StatusPriorityRow.test.tsx` |
| Create | `__tests__/unit/BlockerCarousel.NextInLine.test.tsx` |

No schema changes. No migrations needed.

---

## 8. Test Acceptance Criteria

| # | Scenario | Expected |
|---|---|---|
| T1 | `BlockerCarousel` renders `nextInLine` items inside each card | 1-3 downstream task names visible in card |
| T2 | Tapping a `BlockerCard` calls `onCardPress(task)` with only `task` arg | `onCardPress` called once with correct task, **no** prereqs/nextInLine args |
| T3 | `BlockerCarousel` — `kind='winning'` still renders winning-state card | Winning card visible, no blocker cards |
| T4 | `TaskDetailsPage` renders status pills and updates task status on press | Status changes optimistically; `updateTask` called with new status |
| T5 | `TaskDetailsPage` renders priority pills and updates task priority on press | Priority changes optimistically; `updateTask` called with new priority |
| T6 | `TasksScreen` (index.tsx) does NOT render `<TaskBottomSheet>` | Component not present in rendered tree |
| T7 | `TaskBottomSheet.tsx` file no longer exists in the repo | `import` of it causes compile error |

---

## 9. Out of Scope

- Feature flag wrapping (issue notes it as optional — omitting given straightforward removal).
- Changes to the `AddDelayReasonModal` flow (already works from `TaskDetailsPage`).
- AI suggestion wiring in `TaskDetailsPage` (hook exists; wiring can be follow-up if desired).

---

## 10. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| `BlockerCarousel` test suite references `prereqs` / `nextInLine` args in `onCardPress` | Update tests in same PR to match simplified signature |
| Status/Priority pills in `TaskDetailsPage` reloads full page on update (vs. optimistic in-sheet) | Use local state optimistic update pattern already present in `TaskDetailsPage` (`setTask`) |
| `nextInLine` data may be empty for tasks with no downstream dependencies | `NextInLinePreview` renders nothing when `tasks.length === 0` — no visual regression |

---

## 11. Approval Checklist

- [ ] Design reviewed and approved by maintainer
- [ ] Acceptance criteria signed off
- [ ] Proceed to TDD implementation

