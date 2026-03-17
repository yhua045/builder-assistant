# Design: Fine-Tuning — Task Detail, Project Detail & Quick Actions

**Issue**: #147  
**Branch**: `issue/147`  
**Date**: 2026-03-17  
**Status**: ⏳ Awaiting approval

---

## 1. Overview

Issue #147 bundles four focused UI/UX refinements across the Task Detail and Project Detail screens, plus one outstanding wiring fix for the Quick Actions already partially scaffolded in the timeline:

| # | Area | What changes |
|---|------|-------------|
| A | Task Detail — Dependent Task status | Show the real status of each dependency task (not a generic "Blocked / Waiting" label) |
| B | Project Detail — Project Name in heading | Replace the static "Project Details" header text with the actual project name |
| C | Project Detail — Expand / Collapse All | Global toggle + auto-collapse rule (past = collapsed, future = expanded) |
| D | Quick Actions wiring | `openProgressLog` / `openDocument` navigation params are declared but never consumed in `TaskDetailsPage` |

---

## 2. Acceptance Criteria

### A — Dependent Task Status

- [ ] In `TaskDependencySection`, each dependency row shows a status chip derived from `dep.status`:
  - `pending` → icon `Clock` + label **"Waiting to complete"**
  - `in_progress` → icon `Play` + label **"In progress"**
  - `completed` → icon `CheckCircle` + label **"Complete"** (green tint)
  - `blocked` → icon `AlertCircle` + label **"Blocked"** (red tint)
  - `cancelled` → icon `XCircle` + label **"Cancelled"** (grey tint)
- [ ] The "X blocked" counter in the section header continues to work (counts dependency tasks that are not `completed` / `cancelled`).
- [ ] No new domain interface or use-case required (status data is already present on the `Task` entity returned by `GetTaskDetailUseCase`).

### B — Project Name in Heading

- [ ] The `ProjectDetail` screen header (`<View>` inside `SafeAreaView`) displays `project?.name` instead of the hard-coded text `"Project Details"`.
- [ ] While the project query is still loading (`loading === true`), the heading shows `"Loading…"` (or a narrow grey skeleton, see §5).
- [ ] The `project-detail-name` `testID` element in the body card is unchanged (regression check).

### C — Expand / Collapse All Toggle

- [ ] A button row appears directly above the first `TimelineDayGroup` (between the "Task Timeline" heading and the list). It shows either **"Collapse All"** or **"Expand All"** depending on current state.
- [ ] Tapping the button toggles every day group simultaneously (all expand or all collapse, no partial state from the button's perspective).
- [ ] **Auto-collapse rule on first load**: any group whose `date` is strictly before today (UTC) starts collapsed; groups dated today or in the future start expanded. The "No Date" bucket (`__nodate__`) follows the future rule (starts expanded).
- [ ] `TimelineDayGroup` accepts a new controlled prop `expanded: boolean` alongside an `onToggle: () => void` callback; internal `useState` is removed.
- [ ] The individual per-group toggle (the `●  label  ▾` row) still works — pressing it updates only that group's state without affecting others.
- [ ] Existing integration test for collapse/expand continues to pass.

### D — Quick Actions Wiring (`openProgressLog` / `openDocument`)

- [ ] `TaskDetailsPage` reads `openProgressLog` and `openDocument` from `route.params`.
- [ ] When `openProgressLog === true`, the `AddProgressLogModal` is opened automatically after the initial data load completes (i.e. after `loadData()` resolves for the first time).
- [ ] When `openDocument === true`, `handleAddDocument()` is invoked automatically after the initial data load completes.
- [ ] Each auto-trigger fires **at most once** per navigation (param is consumed; navigating back and returning to the same route should not re-trigger). A `useRef` latch is sufficient.
- [ ] Unit test: mocking route params, verify the modal opens / handler fires on mount.

---

## 3. Architecture & Implementation Plan

### 3A — `TaskDependencySection.tsx`

**Current behaviour** (lines ~79–100):
```tsx
{isBlocked ? (
  <>
    <AlertCircle className="text-red-500" size={14} />
    <Text className="text-red-500 text-xs font-medium">Blocked by this task</Text>
  </>
) : (
  <>
    <Clock className="text-amber-500" size={14} />
    <Text className="text-muted-foreground text-xs">Waiting for completion</Text>
  </>
)}
```
`isBlocked` is derived from `dep.status !== 'completed' && dep.status !== 'cancelled'`, which collapses five status values into a binary display — losing useful information.

**Proposed change** — add a pure helper `getDependencyStatusDisplay(status)` local to the component that maps each `Task['status']` to `{ icon, label, colour }`. Replace the binary `{isBlocked ? ... : ...}` block with a single rendered chip from the helper output. No interface changes needed; `dep.status` is already available.

**Files modified**: `src/components/tasks/TaskDependencySection.tsx` only.

---

### 3B — Project Name in `ProjectDetail.tsx`

**Current header** (lines ~119–127 of `ProjectDetail.tsx`):
```tsx
<View className="flex-row items-center gap-2">
  <Layers className="text-primary" size={20} />
  <Text className="text-lg font-bold text-foreground">Project Details</Text>
</View>
```

**Proposed change** — replace the static text with:
```tsx
<Text className="text-lg font-bold text-foreground" numberOfLines={1}>
  {loading ? 'Loading…' : (project?.name ?? '—')}
</Text>
```
The `Layers` icon is removed (no semantic value when the name is shown). The centre slot retains its `flex-grow` to stay centred between the back arrow and the spacer `View`.

**Files modified**: `src/pages/projects/ProjectDetail.tsx` only.

---

### 3C — Expand / Collapse All

#### 3C-i  `TimelineDayGroup` — controlled component

Convert from self-managed `useState(true)` to a *controlled* component:

```tsx
// Before
const [expanded, setExpanded] = useState(true);
const toggleExpanded = useCallback(() => { ... setExpanded(prev => !prev); }, []);

// After — props extended
export interface TimelineDayGroupProps {
  // ... existing props ...
  expanded: boolean;           // new — controlled
  onToggle: () => void;        // new — replaces internal setState
}
```

The `LayoutAnimation` call moves inside `onToggle` callers (both the per-group toggle handler in `ProjectDetail` and the global toggle handler).

#### 3C-ii  `ProjectDetail.tsx` — state management

```tsx
// Derive initial collapsed/expanded from today
const TODAY = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

// Initialise once when dayGroups first arrive
const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
const initialised = useRef(false);

useEffect(() => {
  if (!dayGroups.length || initialised.current) return;
  const init: Record<string, boolean> = {};
  for (const g of dayGroups) {
    init[g.date] = g.date === '__nodate__' || g.date >= TODAY;
  }
  setExpandedGroups(init);
  initialised.current = true;
}, [dayGroups]);
```

Global toggle button label logic:
```tsx
const allExpanded = dayGroups.every(g => expandedGroups[g.date] !== false);

const handleToggleAll = () => {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  const next = !allExpanded;
  setExpandedGroups(Object.fromEntries(dayGroups.map(g => [g.date, next])));
};
```

The toggle button sits in the row with the "Task Timeline" heading:
```tsx
<View className="flex-row items-center justify-between mb-4">
  <Text className="text-xl font-bold text-foreground">Task Timeline</Text>
  <Pressable onPress={handleToggleAll} className="px-3 py-1 bg-muted rounded-full">
    <Text className="text-xs font-semibold text-muted-foreground">
      {allExpanded ? 'Collapse All' : 'Expand All'}
    </Text>
  </Pressable>
</View>
```

Per-group toggle handler (passed as `onToggle`):
```tsx
const handleGroupToggle = useCallback((date: string) => {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  setExpandedGroups(prev => ({ ...prev, [date]: !prev[date] }));
}, []);
```

**Files modified**: `src/pages/projects/ProjectDetail.tsx`, `src/components/projects/TimelineDayGroup.tsx`.

---

### 3D — `openProgressLog` / `openDocument` wiring in `TaskDetailsPage.tsx`

The params are already defined in `ProjectsNavigatorParamList` (`src/pages/projects/ProjectsNavigator.tsx` line 10). Nothing is needed in the navigator.

In `TaskDetailsPage.tsx`, after `const { taskId } = route.params`:
```tsx
const { taskId, openProgressLog, openDocument } = route.params as {
  taskId: string;
  openProgressLog?: boolean;
  openDocument?: boolean;
};
const autoTriggered = useRef(false);
```

After `loadData()` resolves in the initial `useEffect`:
```tsx
const loadData = useCallback(async () => {
  setLoading(true);
  try {
    // ... existing fetch logic ...
  } finally {
    setLoading(false);
    // One-time auto-trigger for deep-link params
    if (!autoTriggered.current) {
      autoTriggered.current = true;
      if (openProgressLog) setShowAddLogModal(true);
      else if (openDocument) handleAddDocument();
    }
  }
}, [/* existing deps */ openProgressLog, openDocument]);
```

> **Note**: `handleAddDocument` uses `filePickerAdapter` which is resolved in `useMemo`. Both are available by the time `loadData` runs. The `autoTriggered` ref prevents re-triggering on subsequent focus-driven reloads.

**Files modified**: `src/pages/tasks/TaskDetailsPage.tsx` only.

---

## 4. Files to Create / Modify

| Action | Path | Purpose |
|--------|------|---------|
| Modify | `src/components/tasks/TaskDependencySection.tsx` | Status chip per dependency task (3A) |
| Modify | `src/pages/projects/ProjectDetail.tsx` | Project name in heading + expand/collapse state (3B, 3C) |
| Modify | `src/components/projects/TimelineDayGroup.tsx` | Controlled `expanded` + `onToggle` prop (3C) |
| Modify | `src/pages/tasks/TaskDetailsPage.tsx` | Consume `openProgressLog` / `openDocument` params (3D) |

No schema changes. No new domain entities, repositories, or use-cases.

---

## 5. UI Sketches

### 5A — Dependency Status Chip (Task Detail Screen)

```
┌───────────────────────────────────────────────────┐
│  🔗  Foundation Inspection                         │
│      🕐  Waiting to complete          [PENDING]    │
└───────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────┐
│  🔗  Site Survey                                   │
│      ✅  Complete                    [COMPLETED]   │
└───────────────────────────────────────────────────┘
```

### 5B — Project Detail Header

```
  ← [back]           Smith Residence      [spacer]
```

### 5C — Expand / Collapse Toggle

```
  Task Timeline                      [Collapse All]
  │                                                 
  ├── 15 Mar ●─── Foundation Work (collapsed)       
  ├── 20 Mar ●─── Framing + Roofing (expanded) ▾    
  │         ┌────────────────────────────────────┐  
  │         │  ▶  Install Trusses   [In Progress] │  
  │         └────────────────────────────────────┘  
```

---

## 6. Test Plan

### Unit tests (`__tests__/unit/`)

| Test | File | Assertion |
|------|------|-----------|
| `getDependencyStatusDisplay` returns correct label+icon for all 5 statuses | `TaskDependencySection.test.tsx` (new) | All 5 status → expected label |
| `groupTasksByDay` with past/future dates | `useProjectTimeline.test.ts` (existing — extend) | Extend existing tests |
| `expandedGroups` initialisation: past dates → false, future → true | `ProjectDetail.unit.test.tsx` (new) | Snapshot of initial state |
| `openProgressLog=true` param → modal visible after load | `TaskDetailsPage.unit.test.tsx` (new) | Modal `visible` prop is `true` |
| `openDocument=true` param → `handleAddDocument` called once | `TaskDetailsPage.unit.test.tsx` (new) | Mock called exactly once |

### Integration tests (`__tests__/integration/`)

| Test | File | Assertion |
|------|------|-----------|
| Existing collapse/expand test continues to pass after `TimelineDayGroup` becomes controlled | `ProjectDetail.integration.test.tsx` (existing) | No regression |
| "Collapse All" button hides all task cards | `ProjectDetail.integration.test.tsx` (extend) | All `task-N` testIDs removed from tree |
| "Expand All" button restores all task cards | `ProjectDetail.integration.test.tsx` (extend) | All `task-N` testIDs present |
| Header shows project name not "Project Details" | `ProjectDetail.integration.test.tsx` (extend) | Text "Smith Residence" in header `testID` |

---

## 7. Open Questions

- **5B loading state**: Should the heading show `"Loading…"` or a narrow grey skeleton view? A text placeholder is simplest and consistent with the body (ActivityIndicator is already shown there). ***Answer**: "Loading…" text for simplicity and consistency with body loading state.*
- **Quick Actions — inline modal vs. navigation**: The current `handleAddProgressLog` handler navigates to `TaskDetails` with `openProgressLog: true`. An alternative is to render `AddProgressLogModal` inline in `ProjectDetail` (no navigation, faster UX). This design keeps the navigation approach to avoid re-implementing modal + state management in `ProjectDetail`; if the team prefers the inline modal approach, scope will expand. ***Answer**: Keep the navigation approach for now to limit scope; we can revisit inline modals in a future iteration focused on UX improvements.*
- **Auto-collapse boundary**: "prior to today" — should this use the device local date or UTC? The existing `useProjectTimeline` helpers use UTC (`T00:00:00Z`); the auto-collapse logic should follow the same convention for consistency. ***Answer**: Use local date for consistency with existing helpers, and we need to update other places so they are using UTC as well.*
