# Design: Issue #108 — Task Detail: Documents, Dependencies, Subcontractor & Delay Reasons

**Status**: APPROVED — ready for implementation  
**Author**: Copilot  
**Date**: 2026-03-03  
**GitHub Issue**: https://github.com/yhua045/builder-assistant/issues/108  
**Parent**: #107

---

## 1. User Story

As a builder, I want to:
- **Attach documents** (plans, permits, invoices, photos) to a Task. A task can have multiple documents.
- **Declare dependency tasks** that must be completed before this Task can start or progress.
- **Associate a subcontractor** (contact with contractor role) with the Task and see their contact info.
- **Record delay reasons** (free-text + optional duration/date) against a Task. A task can have multiple delay entries.
- **View all of the above** on the Task Detail screen.

---

## 2. Acceptance Criteria

| # | Criterion |
|---|---|
| AC-1 | Task Detail screen shows attached documents with thumbnail/preview and an action to download/view. |
| AC-2 | Task Detail screen lists dependency tasks with their current status; each is a link to its own detail. |
| AC-3 | Task Detail screen shows subcontractor name, trade and phone/email. |
| AC-4 | Task Detail screen shows a chronological delay history (reason, actor, date). |
| AC-5 | A task with incomplete dependencies shows a `blocked` indicator in the UI. |
| AC-6 | CRUD (add/remove document, add/remove dependency, set/clear subcontractor, add delay entry) persists via Drizzle-backed repositories. |
| AC-7 | Unit tests cover all new use cases; integration tests cover repository persistence. |
| AC-8 | No TypeScript strict-mode errors. |

---

## 3. Current State Analysis

### What already exists

| Concern | Current state |
|---|---|
| `documents` table | Exists; has `task_id TEXT` column and index. Documents can already be linked to tasks. |
| `Task` domain entity | Has `dependencies?: string[]` (JSON, domain-only) and `assignedTo?: string` (contactId). Neither is persisted properly: `tasks` DB table has no `dependencies` column and no `subcontractor_id`. |
| `TaskRepository` interface | Basic CRUD only — no methods for dependency or delay management. |
| `contacts` table | Exists; `trade` column present. Subcontractors are modelled as contacts with role `'subcontractor'` or `'contractor'`. |
| `TaskDetailsPage` | Minimal — shows title, status, dates. No documents, dependencies, subcontractor, or delays. |

### Gaps to fill

1. Schema: `tasks` table missing `subcontractor_id` column.
2. Schema: no `task_dependencies` join table in DB (currently only a JSON array on the entity that is never persisted).
3. Schema: no `task_delay_reasons` table.
4. Domain entity: `Task` missing `subcontractorId`, `delayReasons` array.
5. Repository interface: no methods for delays or dependencies.
6. Use cases: none for delay management.
7. UI: `TaskDetailsPage` needs complete rebuild.

---

## 4. Database Changes

### 4.1 Alter `tasks` table — add `subcontractor_id`

> SQLite `ALTER TABLE … ADD COLUMN` is safe for nullable columns with no default.

**New column:**

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `subcontractor_id` | `TEXT` | nullable | FK (soft) to `contacts.id`. Subcontractor assigned to this task. |

### 4.2 New table: `task_dependencies`

Junction table tracking which tasks must complete before another.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `local_id` | `INTEGER` | PK AUTOINCREMENT | |
| `task_id` | `TEXT` | NOT NULL | The task that **has** the dependency. |
| `depends_on_task_id` | `TEXT` | NOT NULL | The task that must complete **first**. |
| `created_at` | `INTEGER` | | Unix ms. |

**Index**: `(task_id)` for fast lookup of all dependencies for a task.  
**Unique constraint**: `(task_id, depends_on_task_id)` — no duplicate edges.

> **Rationale for a join table over JSON array**: Queryability (find all tasks that depend on a given task), integrity (each dependency is a first-class row), and uniform Drizzle access pattern. The JSON array in `Task.dependencies` will be kept as a computed/runtime convenience but will no longer be the source of truth.

### 4.3 New table: `delay_reason_types` (lookup / reference data)

A seed table of predefined delay reason options presented to the user in the UI. Keeping these in a DB table (rather than hardcoding in the app) allows them to be extended without a code release.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `TEXT` | PK | Short stable code e.g. `'WEATHER'`. |
| `label` | `TEXT` | NOT NULL | Human-readable label e.g. `'Bad weather'`. |
| `display_order` | `INTEGER` | NOT NULL | Sort order for picker list. |
| `is_active` | `INTEGER` (boolean) | NOT NULL DEFAULT 1 | Soft-disable without deleting. |

**Seeded rows (inserted in the migration):**

| id | label | order |
|---|---|---|
| `WEATHER` | Bad weather | 1 |
| `MATERIAL_DELAY` | Material / supply delay | 2 |
| `SUBCONTRACTOR` | Subcontractor unavailability | 3 |
| `PERMIT` | Permit / approval delay | 4 |
| `DESIGN_CHANGE` | Design change | 5 |
| `EQUIPMENT` | Equipment breakdown | 6 |
| `ACCESS` | Site access issue | 7 |
| `LABOUR` | Labour shortage | 8 |
| `CLIENT` | Client decision pending | 9 |
| `OTHER` | Other | 10 |

### 4.4 New table: `task_delay_reasons`

One task can have multiple delay entries (ordered by creation time). Each entry references a `delay_reason_types` row so the UI can present a structured picker; an optional `notes` column allows free-text supplemental detail.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `local_id` | `INTEGER` | PK AUTOINCREMENT | |
| `id` | `TEXT` | NOT NULL UNIQUE | UUID-style app-generated. |
| `task_id` | `TEXT` | NOT NULL | Owning task. |
| `reason_type_id` | `TEXT` | NOT NULL | FK (soft) to `delay_reason_types.id`. The selected reason. |
| `notes` | `TEXT` | nullable | Optional free-text supplemental detail. |
| `delay_duration_days` | `REAL` | nullable | Optional estimated delay in days. |
| `delay_date` | `INTEGER` | nullable | Unix ms — when the delay started/was recorded. |
| `actor` | `TEXT` | nullable | Who recorded it (contact id or free text name). |
| `created_at` | `INTEGER` | NOT NULL | Wall-clock insert time (Unix ms). |

**Index**: `(task_id)` for fast lookup of all delay entries for a task.

### 4.5 Migration tag

`0012_task_detail_extensions`

SQL statements (in order):
1. `ALTER TABLE tasks ADD COLUMN subcontractor_id TEXT`
2. `CREATE TABLE task_dependencies …`
3. `CREATE TABLE delay_reason_types …`
4. Seed `delay_reason_types` with 10 rows (INSERT OR IGNORE)
5. `CREATE TABLE task_delay_reasons …`

---

## 5. Domain Layer Changes

### 5.1 `Task` entity (`src/domain/entities/Task.ts`)

Add fields:

```ts
subcontractorId?: string;      // contactId of assigned subcontractor
delayReasons?: DelayReason[];   // populated by repository; not persisted in column
// Note: `dependencies` stays as string[] but now backed by task_dependencies table
```

New types:

```ts
export interface DelayReasonType {
  id: string;          // e.g. 'WEATHER'
  label: string;       // e.g. 'Bad weather'
  displayOrder: number;
  isActive: boolean;
}

export interface DelayReason {
  id: string;
  taskId: string;
  reasonTypeId: string;        // FK to DelayReasonType.id
  reasonTypeLabel?: string;    // denormalised label for display (populated by repo)
  notes?: string;              // optional supplemental free text
  delayDurationDays?: number;
  delayDate?: string;          // ISO date string
  actor?: string;
  createdAt: string;
}
```

### 5.2 `TaskRepository` interface additions (`src/domain/repositories/TaskRepository.ts`)

```ts
// Dependencies
addDependency(taskId: string, dependsOnTaskId: string): Promise<void>;
removeDependency(taskId: string, dependsOnTaskId: string): Promise<void>;
findDependencies(taskId: string): Promise<Task[]>;       // tasks this task depends on
findDependents(taskId: string): Promise<Task[]>;          // tasks that depend on this

// Delay reasons
addDelayReason(entry: Omit<DelayReason, 'id' | 'createdAt'>): Promise<DelayReason>;
removeDelayReason(delayReasonId: string): Promise<void>;
findDelayReasons(taskId: string): Promise<DelayReason[]>;
```

> **`findById` augmentation**: When fetching a single task, the repository should hydrate `dependencies` (string[] of task IDs), `delayReasons`, and `subcontractorId`. List queries (`findAll`, `findByProjectId`) return shallow tasks **without** these associations for performance.

---

## 6. Application Layer (Use Cases)

New use cases in `src/application/usecases/task/`:

| Use Case | Input | Key Behaviour |
|---|---|---|
| `AddTaskDependencyUseCase` | `{ taskId, dependsOnTaskId }` | Validates both tasks exist; rejects self-dependency; rejects circular dependency (depth-limited BFS/DFS up to 10 hops); calls `repo.addDependency`. |
| `RemoveTaskDependencyUseCase` | `{ taskId, dependsOnTaskId }` | Calls `repo.removeDependency`. |
| `AddDelayReasonUseCase` | `{ taskId, reasonTypeId, notes?, delayDurationDays?, delayDate?, actor? }` | Validates `reasonTypeId` is non-empty and exists in `delay_reason_types`; generates `id`; calls `repo.addDelayReason`; if task status is not `blocked`, sets it to `blocked`. |
| `RemoveDelayReasonUseCase` | `{ delayReasonId, taskId }` | Calls `repo.removeDelayReason`. |
| `GetTaskDetailUseCase` | `{ taskId }` | Returns `Task` with `dependencies` (hydrated as `Task[]`), `delayReasons`, and `subcontractorId` populated. Returns `null` if not found. |

Existing use case updates:

- `UpdateTaskUseCase` — pass `subcontractorId` through (already stored on task, no special logic needed).

---

## 7. Infrastructure Layer (Repository & Mapper)

### 7.1 `DrizzleDelayReasonTypeRepository`

New lightweight read-only repository in `src/infrastructure/repositories/`:

- `findAll(): Promise<DelayReasonType[]>` — returns all active types ordered by `display_order`.

Interface defined at `src/domain/repositories/DelayReasonTypeRepository.ts`.

### 7.2 `DrizzleTaskRepository`

Implement the six new interface methods:

- `addDependency`/`removeDependency` — insert/delete from `task_dependencies`.
- `findDependencies` — JOIN `task_dependencies` to `tasks` on `depends_on_task_id`.
- `findDependents` — JOIN `task_dependencies` to `tasks` on `task_id`.
- `addDelayReason`/`removeDelayReason`/`findDelayReasons` — CRUD on `task_delay_reasons`.
- Update `findById` to LEFT JOIN `task_delay_reasons` and fetch dependency IDs, then hydrate both on the returned entity.
- Update `save`/`update` to persist `subcontractorId → subcontractor_id`.

### 7.3 Mapper

Update `TaskMapper` (or inline mapper in `DrizzleTaskRepository`) to map:
- `subcontractor_id` → `subcontractorId`
- Include delay reason rows (joined with `delay_reason_types` to populate `reasonTypeLabel`) → `DelayReason[]`
- Include dependency IDs → `string[]`

---

## 8. Hooks

### 8.1 `useTasks` hook extensions

Add methods:

```ts
getTaskDetail(taskId: string): Promise<TaskDetail>;
addDependency(taskId: string, dependsOnTaskId: string): Promise<void>;
removeDependency(taskId: string, dependsOnTaskId: string): Promise<void>;
addDelayReason(taskId: string, input: AddDelayReasonInput): Promise<void>;
removeDelayReason(taskId: string, delayReasonId: string): Promise<void>;
```

### 8.2 New hook: `useDelayReasonTypes`

A simple hook that resolves `DelayReasonTypeRepository` and returns the list of active types for populating pickers:

```ts
const { delayReasonTypes } = useDelayReasonTypes();
// returns DelayReasonType[]
```

### 8.3 New type `TaskDetail`

```ts
export interface TaskDetail extends Task {
  dependencyTasks: Task[];       // full Task objects for each dependency
  delayReasons: DelayReason[];
  subcontractor?: Contact;       // hydrated contact if subcontractorId is set
}
```

---

## 9. UI Layer

### 9.1 `TaskDetailsPage` (complete rebuild)

Sections:

1. **Header** — title, status badge, priority chip, edit/delete buttons.
2. **Core Info** — project link, due date, scheduled date, assigned to.
3. **Subcontractor** — card showing name, trade, phone, email. Tap to edit (opens a contact-picker).
4. **Documents** — horizontal scroll of document chips (icon + filename). Tap → OS file preview. "Add Document" button triggers file picker → `processInvoiceUpload`-style flow (just file copy + Document record linked to task).
5. **Dependencies** — list of dependency tasks with status badge. Blocked indicator if any are incomplete. "Add Dependency" button opens task-picker.
6. **Delay Log** — chronological list of `DelayReason` entries. "Add Delay" button opens a modal form.

### 9.2 New components

| Component | Location | Purpose |
|---|---|---|
| `TaskDocumentSection` | `src/components/tasks/` | Documents list + add button |
| `TaskDependencySection` | `src/components/tasks/` | Dependencies list + blocked badge + add button |
| `TaskSubcontractorSection` | `src/components/tasks/` | Subcontractor card + picker |
| `TaskDelaySection` | `src/components/tasks/` | Delay reason history + add form |
| `AddDelayReasonModal` | `src/components/tasks/` | Modal: **reason type picker** (required, list from `useDelayReasonTypes`), optional notes text input, optional duration (numeric), optional date picker |

### 9.3 Blocked-state rule

A task is shown as `blocked` in the UI if:
- Its status is `'blocked'`, **or**
- It has at least one dependency task whose status is not `'completed'`.

The `blocked` visual does not automatically change the persisted `status` field — that remains a manual user action (or `AddDelayReasonUseCase`).

---

## 10. Test Plan

### Unit tests (`__tests__/unit/`)

| File | Tests |
|---|---|
| `AddTaskDependencyUseCase.test.ts` | valid add, self-dependency rejected, circular rejected, task-not-found rejected |
| `RemoveTaskDependencyUseCase.test.ts` | happy path |
| `AddDelayReasonUseCase.test.ts` | valid add, unknown reasonTypeId rejected, empty reasonTypeId rejected, task not found rejected |
| `RemoveDelayReasonUseCase.test.ts` | happy path |
| `GetTaskDetailUseCase.test.ts` | returns hydrated task (dependencies, delay reasons, subcontractor id) |

### Integration tests (`__tests__/integration/`)

| File | Tests |
|---|---|
| `DrizzleTaskRepository.dependencies.integration.test.ts` | add dependency, remove dependency, find dependencies, find dependents |
| `DrizzleTaskRepository.delayReasons.integration.test.ts` | add delay, remove delay, find delay reasons |
| `DrizzleTaskRepository.subcontractor.integration.test.ts` | save with subcontractorId, findById returns subcontractorId |

### UI tests (light, `__tests__/unit/`)

| File | Tests |
|---|---|
| `TaskDetailsPage.test.tsx` | renders sections when task detail is returned, shows blocked indicator when dependency is incomplete |

---

## 11. Migration Plan

Migration file: `drizzle/migrations/` (generated by `npm run db:generate` after schema update).  
Bundled migration entry: `0012_task_detail_extensions` added to `src/infrastructure/database/migrations.ts`.

Since all new columns / tables are additive:
- No data loss risk.
- `ALTER TABLE tasks ADD COLUMN subcontractor_id TEXT` is a no-op on existing rows (value = NULL).
- Two new tables are created fresh — no row migration needed.

---

## 12. Open Questions

| # | Question | Proposed Answer |
|---|---|---|
| OQ-1 | Should removing all delay reasons auto-clear the `blocked` status? | No — status change is always user-driven. The UI can surface a prompt but not auto-change. |
| OQ-2 | Circular dependency detection depth? | BFS up to 4 hops. Deeper chains are unlikely and silently accepted to avoid expensive DB traversals. |
| OQ-3 | Document upload flow — same as invoice upload, or simpler? | Simpler: just file-copy to app storage + `Document` record with `taskId`. No OCR needed. Reuse `IFilePickerAdapter` + `IFileSystemAdapter`. |
| OQ-4 | Should `findAll` / `findByProjectId` hydrate delay reasons? | No — only `GetTaskDetailUseCase` (single task) hydrates the full detail. List views use shallow tasks for performance. |
| OQ-5 | Subcontractor picker — full contact list or filtered to contractor/subcontractor roles? | Filtered. Only contacts whose `roles` array contains `'contractor'` or `'subcontractor'`. |

---

## 13. Implementation Order (TDD sequence)

1. Schema changes + migration generation.
2. `DelayReason` type + `Task` entity update.
3. `TaskRepository` interface additions.
4. ❌ Write failing unit tests for all new use cases.
5. ✅ Implement use cases (green).
6. ❌ Write failing integration tests for `DrizzleTaskRepository`.
7. ✅ Implement `DrizzleTaskRepository` additions (green).
8. Update `useTasks` hook.
9. Build UI sections/components.
10. Rebuild `TaskDetailsPage`.
11. TypeCheck (`npx tsc --noEmit`).
12. Full test run.
