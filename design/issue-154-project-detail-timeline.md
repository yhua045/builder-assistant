# Design: Project Detail — Vertical Task Timeline

**Issue**: #154  
**Branch**: `issue/154-project-timeline`  
**Date**: 2026-03-17  
**Status**: ⏳ Awaiting approval

---

## 1. User Story

> As a builder, I want to open a project and see all its tasks on a vertical, day-grouped timeline so that I can quickly understand what is scheduled, what is blocked, and take immediate action (mark complete, add log, attach document, open task detail).

---

## 2. Acceptance Criteria

- [ ] `src/pages/projects/ProjectDetail.tsx` exists and is reachable by tapping a project card.
- [ ] Page header shows: project name, address, status badge, start date, estimated end date, contact.
- [ ] Tasks are grouped by day (iso date bucket), sorted earliest-to-latest.
- [ ] Each day group is collapsible/expandable (defaults to expanded).
- [ ] **Timeline task card shows only: task title + status icon + status colour coding** (no description, no scheduled time — maximise high-level scan-ability per user requirement).
- [ ] Quick actions per task: open task detail, add progress log, attach document, mark complete.
- [ ] Quick actions trigger appropriate use-cases and follow the `invalidations` map in `queryKeys.ts`.
- [ ] `useProjectTimeline` hook is unit-testable and decoupled from UI.
- [ ] Tests added: unit (grouping logic, hook), integration (data fetch, mark complete mutation).

---

## 3. Architecture Decisions

### 3.1 No new domain interface needed
`ListTasksUseCase` already accepts an optional `projectId` and returns `Task[]` via `TaskRepository.findByProjectId()`. Grouping is a pure presentation concern and is handled in the hook.

### 3.2 New hook: `useProjectTimeline`
Thin wrapper around `useQuery` that:
- Uses `queryKeys.tasks(projectId)` — **reuses the existing cache key** so any mutation that invalidates `tasks(projectId)` (e.g. `updateTask`, `createTask`, `deleteTask` in `useTasks`) automatically refreshes the timeline. No cache duplication.
- Derives `DayGroup[]` inside `useMemo` (grouping logic is pure and testable in isolation).
- Exposes `markComplete(task)` which delegates to `UpdateTaskUseCase` and invalidates via `invalidations.taskEdited()`.

### 3.3 Project header data
A new `queryKeys.projectDetail(projectId)` entry is added to the central registry. The screen fetches `ProjectRepository.findDetailsById(projectId)` via a lightweight `useQuery` call inside `useProjectTimeline` (or a sibling `useProjectDetail` if separation is preferred — see §4).

### 3.4 Invalidation pattern — follows existing convention exactly
```ts
// Inside useProjectTimeline mutation helpers:
await Promise.all(
  invalidations.taskEdited({ projectId, taskId, affectsPayments: false })
    .map(key => queryClient.invalidateQueries({ queryKey: key }))
);
```
This matches the established pattern in `useTasks.ts` (`updateTask`, `addProgressLog`, etc.).

### 3.5 Navigation — new `ProjectsNavigator`
The Projects tab currently renders `ProjectsPage` directly inside the `Tab.Navigator`. Introduce a `ProjectsNavigator` (stack) so `ProjectDetail` can be pushed on top, matching the pattern used by `TasksNavigator` and `PaymentsNavigator`.

### 3.6 No third-party UI library (decided 2026-03-17)
**Decision**: Do **not** introduce RNUILib (or any other UI component library) for this feature.

**Rationale**:
- The entire codebase uses **NativeWind** (Tailwind `className`) as the single, consistent styling system. RNUILib ships its own design-token/theming engine; mixing the two would create two parallel styling paradigms and break visual consistency.
- RNUILib targets React 18; the project runs React **19.1.0**, creating unresolved peer-dependency gaps.
- The Timeline UI is structurally simple (a vertical line, date column, minimal task cards) — entirely achievable with `View`, `Pressable`, `Text`, NativeWind classes, `lucide-react-native` icons, and a `useState`-driven collapse, all already in the project.
- No new runtime dependency weight is justified for a single screen.

**Consequence**: `TimelineDayGroup` and `TimelineTaskCard` are lightweight custom components built on NativeWind primitives. Collapse/expand uses `useState` + `LayoutAnimation` (React Native built-in).

### 3.7 Date label layout — fixed-width pinned column
The date label must stay **visually locked to its corresponding day-group** regardless of how many task cards are in that group. A misaligned date label would break the timeline readability.

**Implementation rule**: Use a two-column `flex-row` layout exactly as in the mock:
- **Left column** — fixed width (`w-16`), right-aligned, contains the day-number and weekday abbreviation. Renders only once per `TimelineDayGroup`, aligned to the top of the group (`items-start`).
- **Right column** — `flex-1`, contains the vertical connector line plus all task cards for that day.
- The vertical line is an `absolute`-positioned `View` (`w-0.5 bg-border`) spanning the full height of the right column, with a dot (`w-2.5 h-2.5 rounded-full bg-primary`) anchored at the top-left.

This layout ensures the date label is always flush with the first task card of its group, and the connecting line runs continuously between days without gaps introduced by card height variation.

```
┌── w-16 ──┬──── flex-1 ────────────────────────────┐
│  20      │  ●── vertical line                      │
│  Thu     │  ┌─ TaskCard (blocked) ──────────────┐  │
│          │  └───────────────────────────────────┘  │
│          │  ┌─ TaskCard (pending) ──────────────┐  │
│          │  └───────────────────────────────────┘  │
├──────────┼─────────────────────────────────────────┤
│  28      │  ●                                       │
│  Fri     │  ┌─ TaskCard (pending) ──────────────┐  │
│          │  └───────────────────────────────────┘  │
└──────────┴─────────────────────────────────────────┘
```

**Test coverage**: an integration test will assert that each `TimelineDayGroup` renders its date label in the correct position relative to its first task card (via `testID` props on the label and first card).

---

## 4. Files to Create / Modify

| Action | Path | Purpose |
|--------|------|---------|
| **Create** | `src/hooks/useProjectTimeline.ts` | Central hook — fetch, group, mutations |
| **Create** | `src/pages/projects/ProjectDetail.tsx` | Detail screen (consumes hook) |
| **Create** | `src/pages/projects/ProjectsNavigator.tsx` | Stack navigator for projects tab |
| **Create** | `src/components/projects/TimelineTaskCard.tsx` | Minimal task card: title + icon |
| **Create** | `src/components/projects/TimelineDayGroup.tsx` | Collapsible day group header + cards |
| **Modify** | `src/hooks/queryKeys.ts` | Add `queryKeys.projectDetail()` key and update `invalidations` |
| **Modify** | `src/pages/tabs/index.tsx` | Replace `ProjectsPage` with `ProjectsNavigator` |
| **Modify** | `src/components/ProjectCard.tsx` | Wire `onPress` → navigate to `ProjectDetail` |
| **Create** | `__tests__/unit/useProjectTimeline.test.ts` | Unit tests: grouping, mutations |
| **Create** | `__tests__/integration/ProjectDetail.test.tsx` | Integration: render, collapse, mark complete |

---

## 5. Data Contracts

### `DayGroup` (hook-internal, exported for testing)
```ts
export interface DayGroup {
  date: string;           // ISO date bucket: "YYYY-MM-DD"
  label: string;          // Display: "Mon 20 Dec"
  tasks: Task[];          // Sorted by scheduledAt ?? dueDate asc
}
```

### `UseProjectTimelineReturn`
```ts
export interface UseProjectTimelineReturn {
  project: ProjectDetails | null;
  dayGroups: DayGroup[];
  loading: boolean;
  error: string | null;
  markComplete: (task: Task) => Promise<void>;
  // Quick-action delegates (navigation handled by caller):
  invalidateTimeline: () => Promise<void>;
}
```

---

## 6. Component Tree

```
ProjectDetail.tsx (screen)
├── SafeAreaView
│   ├── Header row (back button, "Project Details" title)
│   └── ScrollView
│       ├── Project header card
│       │   ├── Name + address + status badge
│       │   └── Start / Est. End / Contact
│       └── Task Timeline section
│           └── TimelineDayGroup (per day) [collapsible]
│               ├── Day label + dot (vertical line)
│               └── TimelineTaskCard (per task)  ← title + icon only
│                   └── Quick action row (open, log, doc, complete)
```

---

## 7. Timeline Task Card — Minimal Design

Per the user requirement: "show only task title (and the colour coding, icon etc)". The card intentionally omits description and scheduled time.

```
┌──────────────────────────────────┐
│  [icon]  Task Title      [badge] │
│  ── ── quick actions ── ──       │
│  [↗ Open] [📷 Log] [📎 Doc] [✓] │
└──────────────────────────────────┘
```

**Status colour map** (matches mock):

| Status      | Card bg / border           | Icon            |
|-------------|----------------------------|-----------------|
| `blocked`   | `bg-red-50 / border-red-200`   | `AlertCircle`   |
| `pending`   | `bg-yellow-50 / border-yellow-200` | `Clock`     |
| `in_progress` | `bg-blue-50 / border-blue-200` | `Play`        |
| `completed` | `bg-green-50 / border-green-200` | `CheckCircle` |
| `cancelled` | `bg-gray-50 / border-gray-200` | `XCircle`     |

> **Note**: The mock shows `cancelled` using green styling ("Green per request"), but the standard semantic colour for cancelled is gray. This design uses gray for `cancelled` to align with universal UX conventions. **Requires confirmation** before implementation.

---

## 8. queryKeys Changes

```ts
// NEW — add to queryKeys object in queryKeys.ts
projectDetail: (projectId: string) => ['projectDetail', projectId] as const,

// NEW context type
export type ProjectDetailCtx = { projectId: string };
```

No new entry in `invalidations` is needed at this stage because the project header data is read-only from this screen (no mutations that change the `Project` entity itself).

---

## 9. Navigation Wiring

```ts
// ProjectsNavigator.tsx  (new, mirrors TasksNavigator)
const Stack = createNativeStackNavigator<ProjectsStackParamList>();

export type ProjectsStackParamList = {
  ProjectsList: undefined;
  ProjectDetail: { projectId: string };
};

export default function ProjectsNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProjectsList" component={ProjectsPage} />
      <Stack.Screen name="ProjectDetail" component={ProjectDetailScreen} options={{ presentation: 'card' }} />
    </Stack.Navigator>
  );
}
```

`ProjectCard.tsx` receives an `onPress` handler from `ProjectsPage` which calls:
```ts
navigation.navigate('ProjectDetail', { projectId: project.id });
```

---

## 10. Test Plan

### Unit — `__tests__/unit/useProjectTimeline.test.ts`
- `groupTasksByDate` produces correct buckets when tasks span multiple days.
- `groupTasksByDate` sorts tasks within each bucket by `scheduledAt` ascending.
- `markComplete` calls `updateUseCase.execute` with `status: 'completed'`.
- `markComplete` triggers invalidation of `queryKeys.tasks(projectId)` and `queryKeys.taskDetail(taskId)`.

### Integration — `__tests__/integration/ProjectDetail.test.tsx`
- Renders project header fields from `ProjectDetails`.
- Renders one `TimelineDayGroup` per distinct date.
- Multiple tasks on the same day appear under the same group.
- Tapping the day group header collapses/expands task cards.
- Tapping "Mark complete" updates the task status and re-renders the card with `completed` styling (mock `UpdateTaskUseCase`).

---

## 11. Open Questions

1. **`cancelled` card colour**: Mock uses green; this design proposes gray. Confirm expected colour. **Answer**: Gray (standard convention for cancelled).
2. **Quick-action "Open Task"**: Should this push `TaskDetailsPage` from within the projects stack, or navigate cross-tab to the Tasks stack? Recommend: same-stack push for coherence, but needs product confirmation. **Answer**: Same-stack push (Projects stack).
3. **Day group sort order**: Issue says "most recent/urgent first" (descending by date). The mock appears ascending. Which should it be? **Answer**: Ascending (oldest first). Is it possible to move the timeline directly to current day by default?
4. **Project header data source**: `ProjectRepository.findDetailsById` hydrates `owner: Contact`. Confirm whether the contact phone/email displayed in the header should come from the `Contact` entity (structured) or `Project.meta`. **Answer**: Use `Contact` entity for structured data (phone/email).
5. **`in_progress` status**: The mock only shows `blocked | pending | completed | cancelled`. The domain `Task` entity also has `in_progress`. The colour map above adds it — confirm whether to include or exclude. **Answer**: include `in_progress` with blue styling (matches existing status colour conventions).

---

## 12. Out of Scope (this issue)

- Filtering/searching tasks within the timeline.
- Editing task fields inline from the timeline.
- Push notifications from task status changes.
