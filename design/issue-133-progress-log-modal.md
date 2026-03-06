# Design: Issue #133 — Progress Log Modal, UI Mapping & E2E Tests

**Branch**: `issue-133-progress-log-modal`  
**Related PR**: #132 (Issue #129 — Task Detail Redesign & Progress Logs)  
**Status**: IMPLEMENTED

---

## 1. User Story

> As a builder, when I am on a task detail page, I want to tap **+ Add Log** to open a modal where I can record a progress event (type, notes, optional photos, optional actor), so that the timeline is updated immediately and persisted to the database.

---

## 2. Scope

### Included
- `AddProgressLogModal` component wired into `TaskProgressSection`.
- `logType` → visual badge mapping in `TaskProgressSection`.
- Human-friendly relative `createdAt` display.
- Integration test verifying full add-flow (modal → use case → DB → timeline refresh).

### Not Included
- Schema changes (no new tables or columns needed).
- Full photo upload pipeline (photos stored as URI strings only, consistent with `ProgressLog.photos?: string[]`).

---

## 3. Architecture Mapping (Clean Architecture)

```
UI: AddProgressLogModal (new)
        ↓ calls onSubmit(data)
UI: TaskProgressSection (update)
        ↓ calls hook
Hook: useTasks.addProgressLog()          ← already exists, no change
        ↓
Use Case: AddProgressLogUseCase          ← already exists, no change
        ↓
Repository: TaskRepository.addProgressLog() ← already exists, no change
```

No new domain, use-case, or infrastructure code is required — this is purely a UI deliverable.

---

## 4. Component: `AddProgressLogModal`

**File**: `src/components/tasks/AddProgressLogModal.tsx`

Used for both **creating** and **editing** a progress log. When `initialValues` is supplied the modal operates in edit mode (title changes to "Edit Progress Log", submit label changes to "Save Changes").

### Props Interface

```typescript
export interface AddProgressLogFormData {
  logType: ProgressLog['logType'];   // required
  notes?: string;                    // optional multiline
  photos?: string[];                 // optional, image URIs
  actor?: string;                    // optional text
}

interface Props {
  visible: boolean;
  /** When supplied the modal opens in edit mode pre-populated with these values */
  initialValues?: AddProgressLogFormData & { id: string };
  onSubmit(data: AddProgressLogFormData): void;
  onClose(): void;
}
```

### UI Sketch

```
┌─────────────────────────────────────────┐
│  Add Progress Log                  [✕]  │
│─────────────────────────────────────────│
│  Log Type *                             │
│  ┌──────┐ ┌──────────┐ ┌──────┐        │
│  │ info │ │inspection│ │delay │ …       │
│  └──────┘ └──────────┘ └──────┘        │
│                                         │
│  Notes                                  │
│  ┌─────────────────────────────────┐    │
│  │ Add any details here…           │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Actor (optional)                       │
│  ┌─────────────────────────────────┐    │
│  │ e.g. Mike Johnson               │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Photos (optional)                      │
│  [+ Add Photo(s)]  [thumb] [thumb] …   │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │           Add Log               │    │  ← disabled if no logType
│  └─────────────────────────────────┘    │
└─────────────────────────────────────────┘
```

- Modal pattern: `animationType="slide"`, bottom-sheet style (identical to `AddDelayReasonModal`).
- `logType` picker: horizontal chip/badge row — tapping a chip selects it; selected chip uses `bg-primary/10 border-primary` styling.
- `notes`: multiline `TextInput`, 3 visual rows.
- `actor`: single-line `TextInput`.
- Photos: uses `react-native-image-picker` (already a project dependency & mocked) — `launchImageLibrary` with `selectionLimit: 5`. Selecting adds URIs to local state; tapping a thumbnail removes it.
- Submit button disabled when no `logType` selected.
- In **edit mode**: form is pre-populated from `initialValues`; submit calls `onSubmit` with the updated data.
- On successful submit: form state reset + `onClose()` called.

---

## 5. Component Updates: `TaskProgressSection`

**File**: `src/components/tasks/TaskProgressSection.tsx`

### 5a. Wire `onAddLog`, `onEditLog`, `onDeleteLog` callbacks

Update props:
```typescript
{
  progressLogs?: ProgressLog[];
  onAddLog?: () => void;
  onEditLog?: (log: ProgressLog) => void;
  onDeleteLog?: (logId: string) => void;
}
```

Each log card gains a kebab-menu icon (⋮) in its top-right corner. Tapping it reveals two inline action buttons: **Edit** and **Delete**. Tapping **Edit** calls `onEditLog(log)`; tapping **Delete** shows a native `Alert.alert` confirmation before calling `onDeleteLog(log.id)`.

Currently the `+ Add Log` `Pressable` has no `onPress`. Update it to call `onAddLog?.()`.

### 5b. Remove mock data fallback

Replace the `(progressLogs && progressLogs.length > 0 ? progressLogs : mockProgressLogs)` fallback with just `progressLogs`. Show an empty-state message when no logs exist.

### 5c. logType → Badge Mapping

| `logType`    | Badge colour (NativeWind class)        | Label        |
|-------------|----------------------------------------|--------------|
| `info`       | `bg-muted text-muted-foreground`       | Info         |
| `general`    | `bg-muted text-muted-foreground`       | General      |
| `inspection` | `bg-blue-100 text-blue-700`            | Inspection   |
| `delay`      | `bg-amber-100 text-amber-700`          | Delay        |
| `issue`      | `bg-red-100 text-red-700`              | Issue        |
| `completion` | `bg-green-100 text-green-700`          | Completion   |
| `other`      | `bg-muted text-muted-foreground`       | Other        |

Each row renders a small `<View>` badge containing the icon and label. `accessibilityLabel` set to e.g. `"log type: inspection"`.

### 5d. Relative `createdAt` display

Helper: `formatRelativeTime(ts: number): string`  
— Uses plain JS date arithmetic (no external library):  
- < 1 min → "just now"  
- < 60 min → "X min ago"  
- < 24 h → "X hours ago"  
- < 7 d → "X days ago"  
- else → `"DD Mon YYYY"` (e.g. "22 Dec 2024")

---

## 6. Hook Changes: `useTasks`

Two new methods required:

```typescript
updateProgressLog(taskId: string, logId: string, input: Omit<AddProgressLogInput, 'taskId'>): Promise<ProgressLog>;
deleteProgressLog(taskId: string, logId: string): Promise<void>;
```

These delegate to new use cases `UpdateProgressLogUseCase` and `DeleteProgressLogUseCase` (see §6a below). `addProgressLog` already exists — no change.

### 6a. New Use Cases

**`UpdateProgressLogUseCase`** — `src/application/usecases/task/UpdateProgressLogUseCase.ts`
```typescript
export interface UpdateProgressLogInput {
  taskId: string;
  logId: string;
  logType: ProgressLog['logType'];
  notes?: string;
  photos?: string[];
  actor?: string;
}
export class UpdateProgressLogUseCase {
  constructor(private readonly taskRepository: TaskRepository) {}
  async execute(input: UpdateProgressLogInput): Promise<ProgressLog> { … }
}
```

**`DeleteProgressLogUseCase`** — `src/application/usecases/task/DeleteProgressLogUseCase.ts`
```typescript
export interface DeleteProgressLogInput { taskId: string; logId: string; }
export class DeleteProgressLogUseCase {
  constructor(private readonly taskRepository: TaskRepository) {}
  async execute(input: DeleteProgressLogInput): Promise<void> { … }
}
```

### 6b. Repository Interface Extension

Add to `TaskRepository` in `src/domain/repositories/TaskRepository.ts`:
```typescript
updateProgressLog(input: UpdateProgressLogInput): Promise<ProgressLog>;
deleteProgressLog(taskId: string, logId: string): Promise<void>;
```

Drizzle implementation (`DrizzleTaskRepository`) adds:
- `updateProgressLog`: `UPDATE task_progress_logs SET … WHERE id = :logId AND task_id = :taskId`
- `deleteProgressLog`: `DELETE FROM task_progress_logs WHERE id = :logId AND task_id = :taskId`

---

## 7. Wiring in `TaskDetailsPage`

**File**: `src/pages/tasks/TaskDetailsPage.tsx` (or wherever `TaskProgressSection` is rendered)

Add local state:
```typescript
const [showAddLog, setShowAddLog] = useState(false);
const [editingLog, setEditingLog] = useState<ProgressLog | null>(null);
```

Pass to `TaskProgressSection`:
```tsx
<TaskProgressSection
  progressLogs={taskDetail?.progressLogs ?? []}
  onAddLog={() => setShowAddLog(true)}
  onEditLog={(log) => setEditingLog(log)}
  onDeleteLog={async (logId) => {
    await deleteProgressLog(taskId, logId);
    await refreshTaskDetail();
  }}
/>

{/* Create */}
<AddProgressLogModal
  visible={showAddLog}
  onClose={() => setShowAddLog(false)}
  onSubmit={async (data) => {
    await addProgressLog(taskId, data);
    setShowAddLog(false);
    await refreshTaskDetail();
  }}
/>

{/* Edit */}
<AddProgressLogModal
  visible={editingLog !== null}
  initialValues={editingLog ? { id: editingLog.id, logType: editingLog.logType, notes: editingLog.notes, photos: editingLog.photos, actor: editingLog.actor } : undefined}
  onClose={() => setEditingLog(null)}
  onSubmit={async (data) => {
    if (!editingLog) return;
    await updateProgressLog(taskId, editingLog.id, data);
    setEditingLog(null);
    await refreshTaskDetail();
  }}
/>
```

`refreshTaskDetail` is a local callback that re-calls `getTaskDetail(taskId)` and updates local state — already available or trivially added.

---

## 8. Migration Notes

**No schema changes.** The `task_progress_logs` table and `addProgressLog` repository method are already wired from Issue #129. No `npm run db:generate` step is needed.

---

## 9. Test Plan

### Unit Tests (new file: `__tests__/unit/AddProgressLogModal.test.tsx`)

| # | Test | Assertion |
|---|------|-----------|
| 1 | Renders without crashing | component tree exists |
| 2 | Submit button disabled with no logType | `disabled` prop is truthy |
| 3 | Submit button enabled after logType selected | `disabled` prop is falsy |
| 4 | `onSubmit` called with correct data | logType, notes, actor in payload |
| 5 | `onClose` called on ✕ press | mock called once |
| 6 | Form state resets after submit | fields cleared || 7 | Edit mode: form pre-populated from `initialValues` | inputs show existing values |
| 8 | Edit mode: title shows "Edit Progress Log" | header text correct |
| 9 | Edit mode: `onSubmit` called with updated data | updated fields in payload |
### Unit Tests (new addition: `__tests__/unit/TaskProgressSection.test.tsx`)

| # | Test | Assertion |
|---|------|-----------|
| 10 | Badge rendered for each logType | correct text for all 7 types |
| 11 | `onAddLog` called when `+ Add Log` pressed | mock called once |
| 12 | Empty-state shown when no logs | "No progress logs yet" or similar |
| 13 | `createdAt` displayed as relative time | e.g. "just now" for fresh timestamp |
| 14 | Edit button triggers `onEditLog` with correct log | mock called with log object |
| 15 | Delete button shows confirmation alert | `Alert.alert` invoked |
| 16 | Delete confirmation calls `onDeleteLog` with log id | mock called with correct id |

### Integration Test (new file: `__tests__/integration/TaskProgressFlow.integration.test.tsx`)

Full flow using in-memory Drizzle shim (pattern established by `TaskPage.voice.integration.test.tsx`):

| # | Test | Steps | Assertion |
|---|------|-------|-----------|
| 17 | Add inspection log end-to-end | 1. Seed DB with a task<br>2. Render `TaskDetailsPage` with in-memory repo<br>3. Press `+ Add Log`<br>4. Select `inspection` logType<br>5. Enter notes "Foundation checked"<br>6. Tap Submit | DB row present in `task_progress_logs`; timeline contains "Foundation checked"; badge shows "inspection" |
| 18 | Add log with photo URIs | Same flow with photo URIs added | `photos` array persisted in DB row |
| 19 | Edit an existing log | 1. Seed DB with a task + 1 progress log<br>2. Render page<br>3. Tap ⋮ on the log → Edit<br>4. Change notes to "Updated note"<br>5. Tap Save | DB row updated; timeline reflects new notes |
| 20 | Delete a log | 1. Seed DB with a task + 1 progress log<br>2. Render page<br>3. Tap ⋮ → Delete → Confirm | DB row removed; timeline shows empty state |
| 21 | Empty state before any logs | Render page with no logs | Empty-state message shown; "Add Log" button present |

---

## 10. Acceptance Criteria

- [x] Modal opens from the `+ Add Log` button  
- [x] Validates required input (`logType` must be selected)  
- [x] Submits to `AddProgressLogUseCase` via `useTasks.addProgressLog()`  
- [x] Closes on success; newly created log appears in timeline without full page reload  
- [x] Each log row shows correct badge/label based on `logType`; all 7 types covered  
- [x] Unit tests cover badge mapping for all types  
- [x] Integration test verifies DB insert + UI timeline update for at least one log type (`inspection`)  
- [x] Edit button on each log row opens modal pre-populated with existing data  
- [x] Saving edits updates the DB row and reflects the change in the timeline  
- [x] Delete button triggers a confirmation alert before removing the log  
- [x] Confirming delete removes the DB row and removes the entry from the timeline  

---

## 11. Files Touched

| File | Change |
|------|--------|
| `src/components/tasks/AddProgressLogModal.tsx` | **New** — create + edit mode |
| `src/components/tasks/TaskProgressSection.tsx` | Wire `onAddLog`/`onEditLog`/`onDeleteLog`, remove mock fallback, badges, relative time, kebab menu |
| `src/pages/tasks/TaskDetailsPage.tsx` | Add modal state for create + edit + delete wiring |
| `src/application/usecases/task/UpdateProgressLogUseCase.ts` | **New** |
| `src/application/usecases/task/DeleteProgressLogUseCase.ts` | **New** |
| `src/domain/repositories/TaskRepository.ts` | Add `updateProgressLog` + `deleteProgressLog` to interface |
| `src/infrastructure/repositories/DrizzleTaskRepository.ts` | Implement `updateProgressLog` + `deleteProgressLog` |
| `src/hooks/useTasks.ts` | Expose `updateProgressLog` + `deleteProgressLog` |
| `__tests__/unit/AddProgressLogModal.test.tsx` | **New** — 9 unit tests |
| `__tests__/unit/TaskProgressSection.test.tsx` | **New** — 7 unit tests |
| `__tests__/integration/TaskProgressFlow.integration.test.tsx` | **New** — 5 integration tests |

No schema changes.

---

*Please review and approve before implementation proceeds.*
