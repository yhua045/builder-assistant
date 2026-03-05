# Design: Issue #118 — Phase 2 Task Cockpit UI (BlockerCarousel, FocusList, TaskBottomSheet)

**Status**: APPROVED — implementation complete  
**Author**: Copilot  
**Date**: 2026-03-05  
**GitHub Issue**: https://github.com/yhua045/builder-assistant/issues/118  
**Parent design**: [design/issue-116-task-cockpit.md](issue-116-task-cockpit.md)  

---

## 0. User Story

> As an owner-builder opening the Tasks screen each morning, I want to see **what's blocking me** and **what I should focus on next** immediately — without scrolling — so I can make on-site decisions in under 5 seconds.

---

## 1. Scope

### In Scope
- `BlockerCarousel` component (horizontally scrollable blocker cards)
- `FocusList` component (top-3 focus task rows)
- `TaskBottomSheet` component (peek-mode slide-up overlay)
- Wiring the above into `src/pages/tasks/index.tsx`
- Unit tests for all three components
- Integration smoke test for `TasksScreen` with mocked `useCockpitData`

### Out of Scope
- No new domain entities or DB migrations (strictly UI wiring)
- No changes to `GetCockpitDataUseCase`, `CockpitScorer`, or domain types
- Full `TaskDetailsPage` is untouched; the bottom sheet is a quick-peek supplement only (per design decision OQ-2 in `issue-116-task-cockpit.md`)

---

## 2. Data Contracts

All three components consume data already available from the existing `useCockpitData` hook. **No new hooks or use cases are needed for reading.** Mutations use the existing `useTasks().updateTask()`.

### `useCockpitData(projectId)` — read path
```ts
// Already implemented; returns:
{
  cockpit: CockpitData | null,  // { blockers: BlockerItem[], focus3: FocusItem[] }
  loading: boolean,
  refresh: () => Promise<void>,
}
```

#### `BlockerItem`
```ts
interface BlockerItem {
  task: Task;
  severity: 'red' | 'yellow';
  blockedPrereqs: Task[];   // prerequisites causing the block
  nextInLine: Task[];        // tasks waiting on this one
}
```

#### `FocusItem`
```ts
interface FocusItem {
  task: Task;
  score: number;             // heuristic score (higher = more urgent)
  urgencyLabel: string;      // e.g. "🔴 3d overdue" | "🟡 Due today" | "🟢 5d left"
  nextInLine: Task[];        // direct dependents
}
```

### Mutation path (Bottom Sheet quick edits)
```ts
// Already exists in useTasks() hook — no new hook needed:
updateTask: (task: Task) => Promise<void>
```

---

## 3. Component Designs

### 3.1 `BlockerCarousel`

**File**: `src/components/tasks/BlockerCarousel.tsx`

#### Props
```ts
interface BlockerCarouselProps {
  blockers: BlockerItem[];
  onCardPress: (task: Task) => void;  // opens TaskBottomSheet
}
```

#### Visual layout (per card)
```
┌─────────────────────────────────┐
│  🔴  BLOCKED             [red]  │
│  Scaffold Assembly              │
│  Blocked by: Concrete pour      │
│  +2 tasks waiting               │
└─────────────────────────────────┘
```
- Left accent border coloured `red` (severity=red) or `amber` (severity=yellow)
- Severity badge: small pill `"🔴 BLOCKED"` or `"🟡 DELAYED"` at top-right
- Task title: `text-foreground font-semibold`
- Blocked by: first `blockedPrereqs[0].title` with label "Blocked by:"
- `nextInLine.length` shown as `+N tasks waiting` when > 0
- Entire card is `TouchableOpacity` with `accessible={true}` and `accessibilityRole="button"` + `accessibilityLabel`

#### Behaviour
- `ScrollView` horizontal, `showsHorizontalScrollIndicator={false}`
- If `blockers.length === 0`: render nothing (no empty state — section is simply hidden)
- Section header: `"⛔ Blockers"` label above carousel

#### Accessibility
- `accessibilityLabel={`${item.task.title} - ${item.severity === 'red' ? 'critically blocked' : 'delayed'}. Tap to open details.`}`

---

### 3.2 `FocusList`

**File**: `src/components/tasks/FocusList.tsx`

#### Props
```ts
interface FocusListProps {
  focusItems: FocusItem[];   // max 3 from useCockpitData
  onItemPress: (task: Task) => void;  // opens TaskBottomSheet
}
```

#### Visual layout (per row)
```
┌────────────────────────────────────────────┐
│  #1  Frame Roof Plates       🔴 3d overdue │
│      Score: 245 · 2 tasks waiting          │
└────────────────────────────────────────────┘
```
- Rank badge: `#1` / `#2` / `#3` in a small circle
- Task title: `text-foreground font-semibold flex-1` (truncated at 1 line)
- `urgencyLabel` right-aligned text
- Sub-row: `Score: {score}` + `nextInLine.length > 0 ? "· {n} tasks waiting" : ""`
- Separator line between rows
- Entire row is `TouchableOpacity`

#### Behaviour
- If `focusItems.length === 0`: render nothing (section hidden)
- Section header: `"🎯 Focus"` label above list

---

### 3.3 `TaskBottomSheet`

**File**: `src/components/tasks/TaskBottomSheet.tsx`

#### Props
```ts
interface TaskBottomSheetProps {
  visible: boolean;
  task: Task | null;
  prereqs?: Task[];        // blockedPrereqs (if opened from BlockerCarousel) or []
  nextInLine?: Task[];     // tasks waiting (from BlockerItem or FocusItem)
  onClose: () => void;
  onUpdateTask: (updated: Task) => Promise<void>;  // delegates to useTasks().updateTask
  onOpenFullDetails: (taskId: string) => void;     // navigates to TaskDetailsPage
  onMarkBlocked: (taskId: string) => void;         // nudge to AddDelayReason modal
}
```

#### Implementation approach: React Native `Modal`
No new library is required. The app already uses `Modal` with `animationType="slide"` and `presentationStyle="pageSheet"` (see `src/components/inputs/ProjectPicker.tsx`). We follow the same pattern for consistency.

```tsx
<Modal
  visible={visible}
  animationType="slide"
  presentationStyle="formSheet"   // gives the "peek" half-sheet feel on iOS
  onRequestClose={onClose}
  transparent={false}
>
```

> **Note**: `presentationStyle="formSheet"` (vs `"pageSheet"`) gives a more compact half-sheet appearance on iOS, which is the "peek" behaviour described in the issue. On Android, `Modal` with `animationType="slide"` achieves a similar sliding overlay; the sheet will not be constrained to half-height on Android by the `presentationStyle` prop, but we handle this with content styling (`maxHeight: '70%'`).

#### Visual layout
```
─── drag handle ──────────────────────────────
  Frame Roof Plates                    [×]

  Status:  [Pending] [In Progress] [Blocked] [Done]
  Priority: [Urgent] [High] [Medium] [Low]

  ─── Prerequisites ─────────────────────────
  ✅ Concrete pour complete
  🔴 Scaffold Assembly — blocked

  ─── Next in Line ──────────────────────────
  → Roof Battens Install
  → Tile Laying

  ─── Quick Actions ─────────────────────────
  [⚠ Mark as Blocked]   [📋 See Full Details]
─────────────────────────────────────────────
```

#### Status quick-set
- 4 pill buttons: `pending | in_progress | blocked | completed`
- Selected pill highlighted with `bg-primary`
- Tapping a pill calls `onUpdateTask({ ...task, status: newStatus })` **optimistically** — local state updates immediately, async call fires in background

#### Priority quick-toggle
- 4 pill buttons: `urgent | high | medium | low`
- Same optimistic pattern as status

#### Prereqs list
- Renders `prereqs` array (max shown: 5, with "+ N more" overflow)
- Status icon: `✅` for `completed`, `🔴` for `blocked`, `⏳` for others

#### Next-in-Line list
- Renders `nextInLine` array (max 3 shown)

#### Quick Actions row
- `"⚠ Mark as Blocked"` → calls `onMarkBlocked(task.id)` (parent navigates to AddDelayReason modal)
- `"📋 See Full Details"` → calls `onOpenFullDetails(task.id)` → `navigation.navigate('TaskDetails', { taskId })`

#### Optimistic update pattern
```ts
// Local state mirrors the task; mutations are optimistic
const [localTask, setLocalTask] = useState(task);

const handleStatusChange = (status: Task['status']) => {
  const updated = { ...localTask!, status };
  setLocalTask(updated);       // immediate UI update
  onUpdateTask(updated);       // fires async (errors logged, not surfaced in sheet)
};
```

---

## 4. `TasksScreen` Wiring

**File**: `src/pages/tasks/index.tsx` — edit only

### New layout order
```
Header
Summary Cards
──────────────────── NEW ────────────────────
<BlockerCarousel blockers={cockpit?.blockers ?? []} onCardPress={openSheet} />
<FocusList focusItems={cockpit?.focus3 ?? []} onItemPress={openSheet} />
──────────────────── END NEW ────────────────
Filter Pills
Task List
```

### State additions
```ts
const { cockpit, loading: cockpitLoading, refresh: refreshCockpit } = useCockpitData(projectId ?? '');
// Note: TasksScreen currently doesn't receive a projectId prop — see §5 Open Question Q1

const [sheetTask, setSheetTask] = useState<Task | null>(null);
const [sheetPrereqs, setSheetPrereqs] = useState<Task[]>([]);
const [sheetNextInLine, setSheetNextInLine] = useState<Task[]>([]);
const [sheetVisible, setSheetVisible] = useState(false);

const openSheet = (task: Task, prereqs: Task[] = [], nextInLine: Task[] = []) => {
  setSheetTask(task);
  setSheetPrereqs(prereqs);
  setSheetNextInLine(nextInLine);
  setSheetVisible(true);
};
```

### Refresh coordination
- Pull-to-refresh triggers both `refreshTasks()` and `refreshCockpit()` in parallel via `Promise.all`

---

## 5. Open Questions

| # | Question | Proposed Default |
|---|---|---|
| **Q1** | `TasksScreen` doesn't currently receive a `projectId` prop. `useCockpitData` requires one. | **RESOLVED**: `GetCockpitDataUseCase` requires a single `projectId`. Cross-project scoring is out of scope for this ticket. We default to the first project returned by `useProjects()`, so the cockpit sections are meaningful for the most common owner-builder case (1 active project). If no projects exist or are loading, `cockpit` is null and both sections are hidden. |
| **Q2** | On Android, `FormSheet` presentation style has no effect — the full-screen modal slides up. Should we add a `maxHeight: '70%'` + rounded top corners wrapper to simulate a bottom sheet on Android? | **Yes** — wrap modal content in a `View` with `borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '70%'` applied via a platform-specific style. |

---

## 6. Test Plan

### Unit Tests

| File | What it tests |
|---|---|
| `__tests__/unit/BlockerCarousel.test.tsx` | Renders N blocker cards; hides when `blockers=[]`; `onCardPress` called with correct task; severity colours; accessibility labels |
| `__tests__/unit/FocusList.test.tsx` | Renders up to 3 items; shows urgencyLabel; shows `nextInLine` count; `onItemPress` called; hides when `focusItems=[]` |
| `__tests__/unit/TaskBottomSheet.test.tsx` | Renders task title; status pills render + selecting one calls `onUpdateTask`; priority pills work; prereqs list; Quick Action buttons; close button |

### Integration Test

| File | What it tests |
|---|---|
| `__tests__/integration/TasksScreen.cockpit.integration.test.tsx` | `TasksScreen` renders both `BlockerCarousel` and `FocusList` when `useCockpitData` is mocked with fixture data; tapping a blocker card opens `TaskBottomSheet` with correct task; tapping "See Full Details" navigates to TaskDetails |

### Mocking strategy
- `useCockpitData` is mocked with `jest.mock` returning a fixture `CockpitData`
- `useTasks` is mocked to provide a no-op `updateTask`
- Navigation is mocked via `@react-navigation/native` jest mock

---

## 7. File Change Summary

| File | Action |
|---|---|
| `src/components/tasks/BlockerCarousel.tsx` | **Create** |
| `src/components/tasks/FocusList.tsx` | **Create** |
| `src/components/tasks/TaskBottomSheet.tsx` | **Create** |
| `src/pages/tasks/index.tsx` | **Edit** — add cockpit hook, carousel + focus list, bottom sheet, refresh coordination |
| `__tests__/unit/BlockerCarousel.test.tsx` | **Create** |
| `__tests__/unit/FocusList.test.tsx` | **Create** |
| `__tests__/unit/TaskBottomSheet.test.tsx` | **Create** |
| `__tests__/integration/TasksScreen.cockpit.integration.test.tsx` | **Create** |

**No DB migrations. No domain changes. No new libraries.**

---

## 8. Acceptance Criteria (from issue)

- [x] `BlockerCarousel` shows active blockers for current `projectId` (from `useCockpitData`) and tapping a card opens the bottom sheet with the correct task
- [x] `FocusList` shows up to 3 items ordered by score and displays `urgencyLabel` and score
- [x] Quick edits in the bottom sheet (status/priority) call `UpdateTaskUseCase` via `useTasks().updateTask()` and update UI optimistically
- [x] All new UI components covered by unit tests for rendering and basic interactions
- [x] Integration smoke test verifies `TasksScreen` renders `BlockerCarousel` and `FocusList` with mocked `useCockpitData`

---

## 9. Confirmation Needed Before Implementation

Please review and confirm (or adjust) the following before I begin coding:

1. **Q1 — `projectId` sourcing**: Should `TasksScreen` read `projectId` from navigation params, a global context, or something else?
2. **Android bottom sheet**: Approve the `maxHeight: 70% + rounded corners` approach for simulating a peek sheet on Android.
3. **Overall design**: Any structural changes to component props, layout, or behaviour?
