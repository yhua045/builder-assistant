# Design: Issue #114 — Extend Task Form (Attachments, Subcontractor, Dependencies)

**Status**: DRAFT — awaiting approval  
**Author**: Copilot  
**Date**: 2026-03-03  
**GitHub Issue**: https://github.com/yhua045/builder-assistant/issues/114  
**Parent**: #107 / #108

---

## 1. User Stories

| # | Story |
|---|---|
| US-1 | As a builder, I can add, view, and remove documents (plans, photos, permits) while **creating or editing** a Task. |
| US-2 | As a builder, I can select or add a subcontractor for the Task within the Task Form. |
| US-3 | As a builder, I can specify one or more dependency Tasks from within the Task Form. |
| US-4 | As a builder, I can record or edit delay reasons from the form when postponing a Task. |
| US-5 | As a builder, saving the Task from the form persists all fields so they are immediately visible on the Task Detail screen. |

---

## 2. Acceptance Criteria

| # | Criterion |
|---|---|
| AC-1 | `TaskForm` UI includes a **Documents** section — pick a file (from camera roll, files, or camera), list attached docs with name/type, and a remove action per doc. |
| AC-2 | `TaskForm` UI includes a **Subcontractor** section — opens a `ContactPickerModal` filtered to `contractor`/`subcontractor` roles; shows selected contact name + trade. |
| AC-3 | `TaskForm` UI includes a **Dependencies** section — opens a `TaskPickerModal` to add tasks; lists added dependencies; allows removal. |
| AC-4 | `TaskForm` UI includes a **Delay Reason** section (only visible when status is `blocked`) — powered by the existing `AddDelayReasonModal`. |
| AC-5 | Form validation: title required; duplicate dependency guard; circular-dependency guard (task cannot depend on itself). |
| AC-6 | `useTaskForm` hook encapsulates all form state and save orchestration (create / update path). |
| AC-7 | `AddTaskDocumentUseCase` implemented in `src/application/usecases/document/` — already has a passing unit test spec. |
| AC-8 | `RemoveTaskDocumentUseCase` implemented and unit-tested. |
| AC-9 | On **create**: Task is saved first, then documents are attached (taskId needed for doc FK). |
| AC-10 | On **update** (editing existing task): documents are attached/removed in-place; changes to subcontractor and dependencies are persisted immediately via existing use-cases. |
| AC-11 | Integration tests verify create-then-detail and update-then-detail round-trips showing all new fields. |
| AC-12 | No TypeScript strict-mode errors (`npx tsc --noEmit` passes). |

---

## 3. Current State Analysis

### What already exists (from #108 / #111)

| Concern | State |
|---|---|
| `Document` entity & `DocumentRepository` interface | Exists; `findByTaskId` present |
| `documents` table | Has `task_id TEXT` column and `idx_documents_project` index |
| `Task` entity | Has `subcontractorId?`, `dependencies?: string[]`, `delayReasons?: DelayReason[]` |
| `tasks` table | Has `subcontractor_id TEXT` column |
| `task_dependencies` join table | Exists with unique constraint `(task_id, depends_on_task_id)` |
| `task_delay_reasons` table | Exists |
| `TaskRepository` interface | Has `addDependency`, `removeDependency`, `findDependencies`, delay CRUD |
| Sub-components | `TaskDocumentSection`, `TaskSubcontractorSection`, `TaskDependencySection`, `TaskDelaySection`, `AddDelayReasonModal` all exist |
| Task use-cases | `AddTaskDependencyUseCase`, `RemoveTaskDependencyUseCase`, `AddDelayReasonUseCase`, `RemoveDelayReasonUseCase`, `ResolveDelayReasonUseCase` all exist |
| `AddTaskDocumentUseCase` **test** | Exists at `__tests__/unit/AddTaskDocumentUseCase.test.ts` — but **implementation file is missing** |
| `useTaskForm` hook | **Not implemented** |
| `TaskForm.tsx` | Exists but only handles `title`, `notes`, `projectId`, `dueDate`, `status`, `priority` |

### Gaps to fill (for #114)

1. **`AddTaskDocumentUseCase`** — implement the missing file at `src/application/usecases/document/AddTaskDocumentUseCase.ts`.
2. **`RemoveTaskDocumentUseCase`** — new use-case + unit test.
3. **`useTaskForm` hook** — new hook at `src/hooks/useTaskForm.ts`.
4. **`TaskForm.tsx`** — extend to include Documents, Subcontractor, Dependencies, optional Delay sections using existing sub-components.
5. **`SubcontractorPickerModal`** — inline picker component (no new page needed; reuse `ContactSelector`).
6. **`TaskPickerModal`** — inline picker for selecting dependency tasks (reuse `TaskPickerModal` if it already exists, otherwise create it).
7. **Integration tests** — create/update round-trips at `__tests__/integration/`.

> **No database schema changes are required.** All tables and columns needed already exist.

---

## 4. Architecture & Component Sketches

### 4.1 Layer overview (Clean Architecture)

```
UI (TaskForm.tsx)
    └── useTaskForm hook
            ├── CreateTaskUseCase           (existing)
            ├── UpdateTaskUseCase           (existing)
            ├── AddTaskDocumentUseCase      ← new implementation
            ├── RemoveTaskDocumentUseCase   ← new
            ├── AddTaskDependencyUseCase    (existing)
            ├── RemoveTaskDependencyUseCase (existing)
            └── DocumentRepository / TaskRepository (existing Drizzle impls)
```

### 4.2 `useTaskForm` hook contract

```ts
interface UseTaskFormOptions {
  initialTask?: Partial<Task>;     // undefined → create mode
  projectId?: string;
  onSuccess?: (task: Task) => void;
}

interface UseTaskFormReturn {
  // Basic fields
  title: string; setTitle(v: string): void;
  notes: string; setNotes(v: string): void;
  projectId: string; setProjectId(v: string): void;
  dueDate: Date | null; setDueDate(v: Date | null): void;
  status: Task['status']; setStatus(v: Task['status']): void;
  priority: Task['priority']; setPriority(v: Task['priority']): void;

  // Subcontractor
  subcontractorId: string | undefined;
  setSubcontractorId(id: string | undefined): void;

  // Documents (pending — not yet saved to DB)
  pendingDocuments: PendingDocument[];       // docs added during this session
  addPendingDocument(doc: PendingDocument): void;
  removePendingDocument(uri: string): void;
  // Already-saved docs (edit mode)
  savedDocuments: Document[];
  removeSavedDocument(docId: string): Promise<void>;

  // Dependencies
  dependencyTaskIds: string[];
  addDependencyTaskId(id: string): void;
  removeDependencyTaskId(id: string): void;

  // Delay reasons (only created after task exists)
  // Expose existing useTasks.addDelayReason when in edit mode.

  // Submit
  isSubmitting: boolean;
  validationError: string | null;
  submit(): Promise<void>;
}

interface PendingDocument {
  uri: string;         // local file URI
  filename: string;
  mimeType: string;
  size?: number;
}
```

**Save orchestration** (`submit()`):

_Create mode:_
1. Validate (title non-empty, no self-dependency).
2. `CreateTaskUseCase.execute(...)` → get new `task.id`.
3. For each `pendingDocument`: `AddTaskDocumentUseCase.execute({ taskId, ...doc })`.
4. For each `dependencyTaskId`: `AddTaskDependencyUseCase.execute(taskId, depId)`.
5. Call `onSuccess(task)`.

_Update mode (task already has an id):_
1. Validate.
2. `UpdateTaskUseCase.execute(updatedTask)` (reflects subcontractorId changes).
3. For each new `pendingDocument`: `AddTaskDocumentUseCase.execute(...)`.
4. Removals already applied eagerly (optimistic) via `removeSavedDocument`.
5. Dependency adds/removes already applied eagerly.
6. Call `onSuccess(task)`.

### 4.3 `TaskForm.tsx` layout (updated)

```
<ScrollView>
  ── Title *
  ── Project (Optional)
  ── Due Date [date picker]
  ── Status  [pill selector]
  ── Priority [pill selector]
  ── Notes (multiline)
  ── SUBCONTRACTOR section         ← TaskSubcontractorSection (tappable → SubcontractorPickerModal)
  ── DOCUMENTS section             ← TaskDocumentSection (Add → file picker; row × remove button)
  ── DEPENDENCIES section          ← TaskDependencySection (Add → TaskPickerModal; row × remove)
  ── DELAY REASON section          ← shown only when status === 'blocked'
  ── [Cancel]  [Save]
</ScrollView>
```

### 4.4 `AddTaskDocumentUseCase` (implementation)

```ts
// src/application/usecases/document/AddTaskDocumentUseCase.ts
export class AddTaskDocumentUseCase {
  constructor(
    private readonly documentRepo: DocumentRepository,
    private readonly fs: IFileSystemAdapter,
  ) {}

  async execute(input: {
    taskId: string;
    sourceUri: string;
    filename: string;
    mimeType?: string;
    size?: number;
    projectId?: string;
  }): Promise<Document> {
    const localPath = await this.fs.copyToAppStorage(input.sourceUri, input.filename);
    const doc = DocumentEntity.create({
      taskId: input.taskId,
      projectId: input.projectId,
      filename: input.filename,
      mimeType: input.mimeType,
      size: input.size,
      localPath,
      source: 'import',
      status: 'local-only',
    });
    await this.documentRepo.save(doc.data());
    return doc.data();
  }
}
```

### 4.5 `RemoveTaskDocumentUseCase`

```ts
// src/application/usecases/document/RemoveTaskDocumentUseCase.ts
export class RemoveTaskDocumentUseCase {
  constructor(
    private readonly documentRepo: DocumentRepository,
    private readonly fs: IFileSystemAdapter,
  ) {}

  async execute(documentId: string): Promise<void> {
    const doc = await this.documentRepo.findById(documentId);
    if (doc?.localPath) {
      await this.fs.deleteFile(doc.localPath).catch(() => { /* best-effort */ });
    }
    await this.documentRepo.delete(documentId);
  }
}
```

### 4.6 Picker modals (new lightweight components)

**`SubcontractorPickerModal`** — wraps the existing `ContactSelector` component (already in `src/components/inputs/`), filtered to roles `contractor` / `subcontractor`. Props:

```ts
interface SubcontractorPickerModalProps {
  visible: boolean;
  selectedId?: string;
  onSelect(contactId: string | undefined): void;
  onClose(): void;
}
```

**`TaskPickerModal`** — a flat list of tasks (from `useTasks`), filtered by `projectId`. Allows selecting one task at a time and calling `onSelect`. Check `__tests__/unit/TaskPickerModal.test.tsx` — this file already exists with tests so we must check if the component also exists.

---

## 5. File Inventory

### New files

| Path | Description |
|---|---|
| `src/application/usecases/document/AddTaskDocumentUseCase.ts` | Use case — copy file to storage, create `Document` linked to task |
| `src/application/usecases/document/RemoveTaskDocumentUseCase.ts` | Use case — delete doc record + local file |
| `src/hooks/useTaskForm.ts` | Hook — encapsulates all TaskForm state + save orchestration |
| `src/components/tasks/SubcontractorPickerModal.tsx` | Modal picker for subcontractor contact |
| `__tests__/unit/RemoveTaskDocumentUseCase.test.ts` | Unit test |
| `__tests__/unit/useTaskForm.test.tsx` | Unit test for hook (mocked repos) |
| `__tests__/integration/TaskForm.integration.test.ts` | Integration test — create/update round-trips |

### Modified files

| Path | Change |
|---|---|
| `src/components/tasks/TaskForm.tsx` | Extend with Subcontractor, Documents, Dependencies, Delay sections; wire to `useTaskForm` |

> **Note**: `TaskPickerModal` — confirmed to exist at `src/pages/tasks/TaskPickerModal.tsx`. Import from there; do not create a duplicate.

---

## 6. Test Acceptance Criteria

### Unit tests

| Test file | Scenario |
|---|---|
| `AddTaskDocumentUseCase.test.ts` | ✅ Already exists — must pass after implementation |
| `RemoveTaskDocumentUseCase.test.ts` | Deletes doc from repo; calls `fs.deleteFile` when `localPath` present |
| `RemoveTaskDocumentUseCase.test.ts` | Skips `fs.deleteFile` when doc has no `localPath` (graceful) |
| `useTaskForm.test.tsx` | Create mode: submit calls `CreateTaskUseCase` then `AddTaskDocumentUseCase` for each pending doc |
| `useTaskForm.test.tsx` | Create mode: adds dependencies after task created |
| `useTaskForm.test.tsx` | Update mode: calls `UpdateTaskUseCase` with new `subcontractorId` |
| `useTaskForm.test.tsx` | Validation: rejects empty title |
| `useTaskForm.test.tsx` | Validation: prevents self-dependency |

### Integration tests

| Test file | Scenario |
|---|---|
| `TaskForm.integration.test.ts` | Create task with document → `findByTaskId` returns the document |
| `TaskForm.integration.test.ts` | Create task with dependency → `findDependencies` returns the dep task |
| `TaskForm.integration.test.ts` | Update task subcontractorId → `findById` returns updated `subcontractorId` |
| `TaskForm.integration.test.ts` | Remove saved document → `findByTaskId` no longer includes it |

---

## 7. Out of Scope (for #114)

- Cloud/remote upload of documents (status stays `local-only`; this is a future story).
- Optimistic document upload progress bar (deferred; noted in issue but marked as "consider").
- Editing delay reasons in the form (delay reasons are added post-create via Task Detail — keeping existing pattern).
- Circular-dependency detection beyond self-reference (deeper cycle detection is a future enhancement).

---

## 8. Migration Notes

**No new database migrations are required.** All required tables and columns (`subcontractor_id` on `tasks`, `task_dependencies`, `documents.task_id`) were added in prior issues (#108). No `db:generate` or `db:push` needed.

---

## 9. Open Questions

1. ~~**`TaskPickerModal`**: Does `src/components/tasks/TaskPickerModal.tsx` already exist?~~ **Resolved**: found at `src/pages/tasks/TaskPickerModal.tsx` — import from there.
2. **Delay reasons in form**: The issue description says "record or edit delay reasons from the form when postponing a Task (if applicable)". Should this be in-form (status → `blocked` shows inline delay section) or always delegated to the Task Detail screen after save? **Proposed default**: show the `AddDelayReasonModal` inline when status is changed to `blocked`, matching the friction-reduction pattern from issue #110.
3. **Document picker library**: Should documents be picked via `react-native-document-picker` (already mocked in `__mocks__/`) or the existing camera/image-picker? **Proposed**: use `react-native-document-picker` for general docs and image-picker for photos, consistent with existing patterns.

---

## 10. Approval Checklist

- [ ] Design document reviewed
- [ ] Open questions resolved
- [ ] Proceed with TDD implementation
