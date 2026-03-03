# Design Plan: Issue #111 — Finish Task Details: Subcontractor Lookup, Dependency Picker, Document Upload, UX Refactor, Cascade Deletes

**Date**: 2026-03-03  
**Branch**: `issue-111`  
**Parent**: Issue #108 (`issue-108-task-detail`)  
**Status**: COMPLETED — 2026-03-03

---

## 1. User Story

As a builder/site manager, I want the Task Details page to be fully functional so that I can:
- See a subcontractor's name, trade, and contact details (not a raw ID)
- Pick existing tasks as dependencies via a UI picker
- Attach documents to a task and have them persisted
- Get a clear confirmation dialog before destructive actions (e.g. removing a dependency)
- Trust that deleting a task will not leave orphaned rows in the database

---

## 2. Sub-tasks & Acceptance Criteria

### 2.1 Subcontractor Contact Lookup

**Problem**: `TaskDetailsPage` passes `task.subcontractorId` (raw string) to `TaskSubcontractorSection` which cannot resolve human-readable details.

**Solution**:
- Resolve the `ContactRepository` in `TaskDetailsPage` (via `container.resolve<ContactRepository>('ContactRepository')`).
- After loading task detail, call `contactRepository.findById(task.subcontractorId)` and filter to contacts with roles containing `'CONTRACTOR'` or `'SUBCONTRACTOR'` per design OQ-5.
- Map the resolved `Contact` to the `SubcontractorInfo` interface already expected by `TaskSubcontractorSection` (`{ id, name, trade, phone, email }`).
- Display "Assign subcontractor" when `subcontractorId` is null/unresolvable.

**Files touched**:
- `src/pages/tasks/TaskDetailsPage.tsx` — add `ContactRepository` resolution + `useState<Contact | null>` for resolved contact; pass resolved data to `<TaskSubcontractorSection />`

**Tests**:
- `__tests__/unit/TaskDetailsPage.subcontractor.test.tsx` — unit test with mocked `ContactRepository`; assert card renders name/trade/phone/email when subcontractorId is set, and shows "Assign subcontractor" when null or not found.

**Acceptance**:
- [x] Subcontractor card shows `name`, optional `trade`, `phone`, `email` if `subcontractorId` resolves.
- [x] Falls back to "Assign subcontractor" if `subcontractorId` is absent or lookup fails.

---

### 2.2 "Add Dependency" Task Picker

**Problem**: The Add button in `TaskDependencySection` calls `onAddDependency` but no picker is wired.

**Solution**:
Create `src/pages/tasks/TaskPickerModal.tsx` — a bottom-sheet-style `Modal` that:
- Accepts `projectId`, `excludeTaskId` (self), `onSelect(taskId: string)`, `onClose` props.
- Calls `useTasks(projectId)` to load all tasks in the project.
- Filters out `excludeTaskId` and tasks already present as dependencies.
- Renders a `FlatList` of tasks with title + status badge; tapping a row calls `onSelect` and closes.
- Shows a search input to filter by title.

Wire in `TaskDetailsPage`:
- Add `useState<boolean>` for `showTaskPicker`.
- Pass `onAddDependency={() => setShowTaskPicker(true)}` to `<TaskDependencySection />`.
- In picker's `onSelect`, call `addDependency(taskId, selectedTaskId)` then `loadData()`.
- Use case guards (circular dependency, self-dependency) handle rejection — surface via `Alert.alert` on error.

**Files touched**:
- `src/pages/tasks/TaskPickerModal.tsx` *(new)*
- `src/pages/tasks/TaskDetailsPage.tsx` — wire picker modal + state

**Tests**:
- `__tests__/unit/TaskPickerModal.test.tsx` — renders tasks, excludes self, calls `onSelect`.
- `__tests__/integration/TaskDependencyPicker.integration.test.ts` — add + remove dependency full flow; no phantoms.

**Acceptance**:
- [x] Tapping "Add" opens picker listing project tasks (self excluded).
- [x] Selecting a task calls `addDependency` and refreshes detail view.
- [x] If use case rejects (circular/self), an error is shown and current deps unchanged.

---

### 2.3 Document Upload Flow

**Problem**: "Add" button in `TaskDocumentSection` has no handler implementation.

**Solution**:
Create `src/application/usecases/document/AddTaskDocumentUseCase.ts`:
```
interface AddTaskDocumentInput {
  taskId: string;
  projectId?: string;
  sourceUri: string;
  filename: string;
  mimeType?: string;
  size?: number;
}
```
- Uses `IFileSystemAdapter.copyToAppStorage(sourceUri, filename)` → `localPath`.
- Creates `DocumentEntity` with `status: 'local-only'`, `taskId`, `localPath`, `filename`, `source: 'import'`.
- Persists via `DocumentRepository.save(document)`.
- Returns the new `Document`.

Wire in `TaskDetailsPage`:
- Add `uploading` boolean state for in-progress feedback (shows `<ActivityIndicator />`).
- When "Add Document" pressed:
  1. Call `IFilePickerAdapter.pickDocument()`.
  2. If not cancelled → set `uploading = true` → `AddTaskDocumentUseCase.execute(...)`.
  3. On completion → reload documents list; set `uploading = false`.
  4. On error → `Alert.alert('Error', …)`.

Pass `onAddDocument` and `uploadingDocument` (bool) to `TaskDocumentSection` so the Add button shows a spinner during upload.

**Files touched**:
- `src/application/usecases/document/AddTaskDocumentUseCase.ts` *(new)*
- `src/pages/tasks/TaskDetailsPage.tsx` — resolve adapters + wire `onAddDocument`
- `src/components/tasks/TaskDocumentSection.tsx` — accept `uploading?: boolean` prop; disable Add + show spinner

**Tests**:
- `__tests__/unit/AddTaskDocumentUseCase.test.ts` — mock adapters; assert `copyToAppStorage` called, `DocumentRepository.save` called with correct `taskId` + `status: 'local-only'`.
- `__tests__/integration/TaskDocumentUpload.integration.test.ts` — full flow; persisted doc has `taskId`.

**Acceptance**:
- [x] Add Document triggers file picker → file is copied → `Document` persisted with `taskId` set.
- [x] Document list updates without full page reload.
- [x] Upload-in-progress state shown (spinner on Add button).
- [x] Cancelled picker does nothing.

---

### 2.4 Remove Dependency Confirmation UX (`useConfirm`)

**Problem**: Inline `Alert.alert` in `TaskDetailsPage` for removing dependencies is not reusable.

**Solution**:
Create a lightweight hook `src/hooks/useConfirm.ts`:
```ts
interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;  // default 'Confirm'
  cancelLabel?: string;   // default 'Cancel'
  destructive?: boolean;  // default false
}

export function useConfirm() {
  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      Alert.alert(options.title, options.message, [
        { text: options.cancelLabel ?? 'Cancel', style: 'cancel', onPress: () => resolve(false) },
        {
          text: options.confirmLabel ?? 'Confirm',
          style: options.destructive ? 'destructive' : 'default',
          onPress: () => resolve(true),
        },
      ]);
    });
  }, []);
  return { confirm };
}
```

Replace the raw `Alert.alert` in `TaskDetailsPage.handleRemoveDependency` with `confirm(...)`.  
Also refactor `handleDelete` to use `useConfirm` for consistency.

**Files touched**:
- `src/hooks/useConfirm.ts` *(new)*
- `src/pages/tasks/TaskDetailsPage.tsx` — replace inline `Alert.alert` calls with `useConfirm`

**Tests**:
- `__tests__/unit/useConfirm.test.ts` — assert hook calls `Alert.alert` with correct args; resolves `true` on confirm, `false` on cancel.

**Acceptance**:
- [x] `TaskDetailsPage` uses `useConfirm` for remove dependency confirmation.
- [x] `handleDelete` also uses `useConfirm`.

---

### 2.5 Cascade Delete for Task-Related Rows

**Problem**: Deleting a task currently may leave orphaned rows in `task_dependencies` and `task_delay_reasons`.

**Solution (preferred — application-level cascade in `DeleteTaskUseCase`)**:

The current `task_dependencies` table uses raw SQL `INSERT OR IGNORE` without FK constraints declared with `REFERENCES ... ON DELETE CASCADE`. Adding `ON DELETE CASCADE` in SQLite requires recreating the table. Given that SQLite migration complexity is high and `pragma foreign_keys` may be unreliable in the current setup, we prefer application-level cleanup in `DeleteTaskUseCase`.

Update `DeleteTaskUseCase`:
```ts
async execute(id: string): Promise<void> {
  await this.taskRepository.deleteDependenciesByTaskId(id);
  await this.taskRepository.deleteDelayReasonsByTaskId(id);
  await this.taskRepository.delete(id);
}
```

Add two methods to `TaskRepository` interface:
- `deleteDependenciesByTaskId(taskId: string): Promise<void>`
- `deleteDelayReasonsByTaskId(taskId: string): Promise<void>`

Implement both in `DrizzleTaskRepository` using raw SQL `DELETE WHERE task_id = ?` (also covers the `depends_on_task_id = ?` direction for reverse dependencies).

**Note on DB-level CASCADE**: A separate migration (`0013_cascade_deletes.sql`) can be added in a future ticket once the migration tooling supports table recreation safely. This is documented as a technical debt item.

**Files touched**:
- `src/domain/repositories/TaskRepository.ts` — add `deleteDependenciesByTaskId`, `deleteDelayReasonsByTaskId`
- `src/application/usecases/task/DeleteTaskUseCase.ts` — cascade before delete
- `src/infrastructure/repositories/DrizzleTaskRepository.ts` — implement two new methods
- All test mocks of `TaskRepository` — add stub implementations

**Tests**:
- `__tests__/unit/DeleteTaskUseCase.test.ts` — assert cascade methods called before `delete`.
- `__tests__/integration/DeleteTaskCascade.integration.test.ts` — create task with deps + delay reasons, delete task, assert no orphans.

**Acceptance**:
- [x] Deleting a task removes all `task_dependencies` rows (both `task_id` and `depends_on_task_id`).
- [x] Deleting a task removes all `task_delay_reasons` rows.
- [x] Integration test asserts no orphan rows.

---

## 3. Architecture Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Cascade delete | Application-level in use case | Avoids SQLite table-recreation migration; transparent and testable |
| Contact lookup | `contactRepository.findById` in page | Keeps `TaskSubcontractorSection` display-only; resolver lives in page layer |
| Task picker | Modal overlay (not new screen) | Keeps navigation stack clean; picker is lightweight short-lived UI |
| Document use case | New `AddTaskDocumentUseCase` | Clean architecture: file I/O and persistence logic belongs in application layer |
| `useConfirm` | Promise-based hook wrapping `Alert.alert` | Reusable across pages; async/await friendly; easy to mock in tests |

---

## 4. File Change Summary

### New files
| File | Purpose |
|---|---|
| `src/pages/tasks/TaskPickerModal.tsx` | Task picker modal for dependency selection |
| `src/application/usecases/document/AddTaskDocumentUseCase.ts` | Document upload use case |
| `src/hooks/useConfirm.ts` | Reusable confirmation dialog hook |
| `__tests__/unit/TaskPickerModal.test.tsx` | Unit tests for picker |
| `__tests__/unit/AddTaskDocumentUseCase.test.ts` | Unit tests for doc upload use case |
| `__tests__/unit/useConfirm.test.ts` | Unit tests for confirm hook |
| `__tests__/unit/DeleteTaskUseCase.test.ts` | Unit tests for cascade delete |
| `__tests__/integration/TaskDependencyPicker.integration.test.ts` | Integration: add/remove dependency |
| `__tests__/integration/TaskDocumentUpload.integration.test.ts` | Integration: document upload persists |
| `__tests__/integration/DeleteTaskCascade.integration.test.ts` | Integration: cascade delete orphan check |

### Modified files
| File | Change |
|---|---|
| `src/pages/tasks/TaskDetailsPage.tsx` | Subcontractor resolver, picker wiring, doc upload wiring, `useConfirm` |
| `src/components/tasks/TaskDocumentSection.tsx` | Accept `uploading?: boolean` prop |
| `src/domain/repositories/TaskRepository.ts` | Add `deleteDependenciesByTaskId`, `deleteDelayReasonsByTaskId` |
| `src/application/usecases/task/DeleteTaskUseCase.ts` | Cascade before delete |
| `src/infrastructure/repositories/DrizzleTaskRepository.ts` | Implement cascade delete methods |
| All `TaskRepository` mock implementations in tests | Add stub methods |

---

## 5. Test Acceptance Criteria Summary

- [ ] All existing 558+ tests continue to pass
- [ ] `npx tsc --noEmit` clean
- [ ] Subcontractor card shows resolved contact data
- [ ] TaskPicker opens, lists project tasks (excluding self), selects and wires dependency
- [ ] Add Document results in persisted `Document` with `taskId` set; list updates
- [ ] `useConfirm` used for remove dependency and delete task confirmations
- [ ] Deleting a task → no orphan rows in `task_dependencies` or `task_delay_reasons`
- [ ] Integration tests added for picker + document upload + cascade

---

## 6. Open Questions

- **OQ-1**: Should `onEditSubcontractor` in `TaskSubcontractorSection` open a contact picker or navigate to a contact form? ***A*** open a contact picker (reusing existing contact list UI) for simplicity; separate ticket can add "Create new contact" flow if needed.
- **OQ-2**: For the task picker, should already-selected dependencies be shown (greyed out) or hidden entirely? ***A*** hidden for simplicity.
- **OQ-3**: Should the document "Add" also support camera capture directly (bypassing file picker), or is file-picker-only sufficient for this ticket? ***A*** file-picker-only (camera flow is separate, see issue #63).
- **OQ-4**: For `deleteDependenciesByTaskId` — should we also clean up reverse dependencies (where `depends_on_task_id = id`)? ***A*** YES, to avoid dangling references in dependents list.

---

## 7. Implementation Order

1. `useConfirm` hook (small, no dependencies)
2. Cascade delete (domain + infra + use case update)
3. Subcontractor contact lookup (no new files, just wire in page)
4. Task picker modal + wiring
5. Document upload use case + wiring

---

*Implementation complete. All 586 tests passing. `npx tsc --noEmit` clean.*
