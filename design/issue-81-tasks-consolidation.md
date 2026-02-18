# Design Plan: Issue #81 — Consolidate Tasks List UI

## User Story

As a builder/owner, I want a single Tasks List screen that shows real task data with a polished layout — so I can see, filter, and act on tasks without encountering duplicate or inconsistent screens.

---

## Background & Problem Statement

Two files currently co-exist for the Tasks list:

| File | Styling | Data | Navigation |
|---|---|---|---|
| `src/pages/tasks/index.tsx` (`TasksScreen`) | Rich cards (images, priority badges, summary counts, filter tabs) | **Hardcoded static mock data** | None |
| `src/pages/tasks/TasksListPage.tsx` (`TasksListPage`) | Minimal list with filter pills | Real data via `useTasks()` | `CreateTask`, `TaskDetails` |

`TasksNavigator.tsx` currently registers `TasksListPage` as the `TasksList` screen, meaning `index.tsx` is unused in navigation.

The goal is **one authoritative screen** (`index.tsx`) that has both the polished layout *and* real data/navigation.

---

## Chosen Approach

**Merge into `index.tsx`** — rewrite `TasksScreen` (`index.tsx`) to use the real data layer while keeping the rich visual design. Then:

- Update `TasksNavigator.tsx` to import from `./index` (default folder import) instead of `./TasksListPage`.
- Delete `TasksListPage.tsx` (no longer needed as a screen).

> **Why not keep `TasksListPage.tsx` as a presentational component?**
> The visual design lives entirely inside `index.tsx`; there is no shared presentational logic worth splitting. Keeping two files would perpetuate the confusion the issue is trying to resolve.

---

## Component Design

### `src/pages/tasks/index.tsx` (after consolidation)

```
TasksScreen
├── SafeAreaView
│   ├── Header row
│   │   ├── Title ("Tasks") + subtitle
│   │   ├── ThemeToggle
│   │   └── "+" CreateTask button → navigate('CreateTask')
│   ├── Summary cards row (real counts from useTasks)
│   │   ├── Pending card  (count of tasks with status 'pending')
│   │   └── In Progress card (count of tasks with status 'in_progress')
│   ├── Filter pill bar (horizontal ScrollView)
│   │   └── Pills: All · Pending · In Progress · Completed
│   └── ScrollView + RefreshControl (onRefresh = refreshTasks)
│       ├── Task cards (mapped from filtered real tasks)
│       │   ├── Title, status badge, priority badge
│       │   ├── Due date, trade/assignee
│       │   └── onPress → navigate('TaskDetails', { taskId: task.id })
│       └── Empty state (when filteredTasks.length === 0)
```

**Key data mapping decisions** (domain `Task` → visual card):

| Visual field | Domain field |
|---|---|
| Title | `task.title` |
| Status badge | `task.status` ('pending' \| 'in_progress' \| 'completed' \| 'blocked' \| 'cancelled') |
| Priority badge | `task.priority` ('low' \| 'medium' \| 'high' \| 'urgent') |
| Due date | `task.dueDate` (ISO string, formatted) |
| Assignee | `task.assignedToContactId` (or `task.assignedTo` for compat) |
| Trade | `task.trade` |

**Filter mapping** (replaces 'today'/'tomorrow' which depended on mock string fields):

| Pill label | Filter value | Condition |
|---|---|---|
| All | `'all'` | no filter |
| Pending | `'pending'` | `task.status === 'pending'` |
| In Progress | `'in_progress'` | `task.status === 'in_progress'` |
| Completed | `'completed'` | `task.status === 'completed'` |

**No vendor image** — domain `Task` has no image URL; remove the image stripe from the card and replace with a coloured priority strip or status icon (keeps the card looking polished without hardcoded URLs).

---

## Files Changed

| File | Action |
|---|---|
| `src/pages/tasks/index.tsx` | **Rewrite** — merge real data + rich layout |
| `src/pages/tasks/TasksNavigator.tsx` | **Update** — import from `./index` (or rely on folder default) instead of `./TasksListPage` |
| `src/pages/tasks/TasksListPage.tsx` | **Delete** |
| `__tests__/unit/TasksScreen.test.tsx` | **Create** — new unit tests (see below) |

No domain, application, infrastructure, or hook changes needed. The `useTasks` hook API and `TasksList` component are already fit for purpose.

---

## Test Acceptance Criteria (TDD)

All tests go in `__tests__/unit/TasksScreen.test.tsx`. They must fail before implementation (red) and pass after (green).

### TC-1: Renders task titles from `useTasks`
- Mock `useTasks` to return two tasks (`{ id: '1', title: 'Fix roof', status: 'pending', ... }`, `{ id: '2', title: 'Paint walls', status: 'in_progress', ... }`).
- Render `<TasksScreen />`.
- Assert both titles are visible.

### TC-2: Empty state shown when no tasks
- Mock `useTasks` to return `tasks: []`.
- Assert empty-state copy is visible (e.g. `"No tasks found"`).

### TC-3: Status filter pills filter the list
- Mock `useTasks` to return one `'pending'` task and one `'completed'` task.
- Render screen; press the **"Pending"** pill.
- Assert only the pending task title is visible; the completed task title is not.

### TC-4: Tapping a task navigates to `TaskDetails`
- Mock `useTasks` with one task.
- Mock `useNavigation` → `navigation.navigate`.
- Tap the task card.
- Assert `navigation.navigate('TaskDetails', { taskId: '1' })` was called.

### TC-5: Tapping "+" navigates to `CreateTask`
- Mock `useNavigation` → `navigation.navigate`.
- Tap the create button (`testID="create-task-btn"`).
- Assert `navigation.navigate('CreateTask')` was called.

### TC-6: Pull-to-refresh calls `refreshTasks`
- Mock `useTasks` exposing a `refreshTasks` spy.
- Trigger `RefreshControl`'s `onRefresh`.
- Assert `refreshTasks` was called.

### TC-7 (Navigator): `TasksNavigator` registers a single `TasksList` screen
- Render `<TasksNavigator />` inside a `NavigationContainer`.
- Assert no duplicate screen named `TasksList` exists.
- (Optional snapshot of the screen component reference.)

---

## What Is Explicitly Out of Scope

- Editing/creating tasks (handled by `CreateTaskPage` / `EditTaskPage` — unchanged).
- Task detail view (handled by `TaskDetailsPage` — unchanged).
- Any domain, application, or infrastructure layer changes.
- Navigation stack topology changes (keep `TasksNavigator` stack identical).

---

## Open Questions for Review

1. **Summary card content**: Currently shows "Today / Tomorrow" counts (mock). With real data, proposed replacement is "Pending" + "In Progress" counts. Does this match the desired UX? Alternative: "Due Today" (filtered by `dueDate === today`) + "In Progress".
2. **Remove vendor image**: The mock card had a banner photo. Since domain `Task` has no image, replace with a coloured left-border strip or status icon pill.
3. **Filter scope**: Should `'completed'` and `'blocked'` also be filter pills, or just `All / Pending / In Progress`? yes, 'Completed' and 'Blocked' are important states to filter by. Let's include pills for all 5 statuses: All, Pending, In Progress, Completed, Blocked.

---

## Acceptance Checklist (from Issue #81)

- [ ] `src/pages/tasks/index.tsx` has full Tasks list functionality (data, actions, navigation) and uses the desired styling/layout.
- [ ] No duplicate routes/screens for Tasks list exist in navigation config.
- [ ] `TasksListPage.tsx` is removed.
- [ ] All imports across the app referencing the Tasks list are updated.
- [ ] Tests added/updated to verify list rendering and navigation to `TaskDetails`, `CreateTask`.
