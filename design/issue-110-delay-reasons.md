# Design: Issue #110 — Capture Task Delay Reasons

**Status**: DRAFT — Awaiting Approval  
**Date**: 2026-03-03  
**Branch**: `issue-110-delay-reasons`  
**Parent issue**: #107

---

## 1. User Story

> As a builder, I can record one or more delay reasons for a Task so that the project history reflects why work was postponed.  
> As a manager, I can view the delay history on the Task Detail screen and understand the most common causes of delays.  
> As a scheduler, I can mark a Task as "postponed" with a primary reason and optional mitigation notes.

---

## 2. Current State (What Already Exists)

| Area | Current state |
|---|---|
| `Task.status` | `'pending' \| 'in_progress' \| 'completed' \| 'blocked' \| 'cancelled'` — **no `postponed` status** |
| `TaskDelay` entity | **Does not exist** |
| `task_delays` table | **Does not exist** |
| `ITaskDelayRepository` | **Does not exist** |
| Delay-related use cases | **None** |
| UI components | **None** |
| Latest migration | `0011_add_property_coords` → next is `0012` |

Everything in this design is **net-new**. No existing code will be removed; only additive changes are made.

---

## 3. Domain Model

### 3.1 `DelayReason` enum

A canonical string-enum defined in the domain layer. This is the **exhaustive catalog** described in the issue; `OTHER` enables free-text fallback.

```typescript
// src/domain/entities/TaskDelay.ts
export type DelayReason =
  | 'WEATHER'
  | 'SICKNESS'
  | 'MATERIAL_SHORTAGE'
  | 'SUPPLY_CHAIN'
  | 'UTILITY_DISCOVERY'
  | 'NO_SHOW'
  | 'REGULATORY_HOLD'
  | 'CLIENT_DECISION_DELAY'
  | 'INSPECTION_FAILURE'
  | 'EQUIPMENT_FAILURE'
  | 'ACCESS_RESTRICTION'
  | 'SAFETY_INCIDENT'
  | 'DESIGN_CHANGE'
  | 'LABOR_SHORTAGE'
  | 'TRANSPORT_DISRUPTION'
  | 'FINANCIAL_ISSUE'
  | 'THEFT_VANDALISM'
  | 'ENVIRONMENTAL_DISCOVERY'
  | 'ARCHAEOLOGICAL_FIND'
  | 'PUBLIC_HOLIDAY'
  | 'EPIDEMIC'
  | 'OTHER';
```

A human-readable label mapping (`DELAY_REASON_LABELS`) will also be exported for UI display.

### 3.2 `TaskDelay` entity

```typescript
export interface TaskDelay {
  id: string;
  localId?: number;            // SQLite autoincrement PK
  taskId: string;              // FK → tasks.id
  reason: DelayReason;
  reasonDetails?: string;      // free-text; required when reason = 'OTHER'
  reportedBy?: string;         // contactId or free-text name
  reportedAt: string;          // ISO timestamp — defaults to now()
  estimatedDelayDays?: number; // optional forecast
  resolvedAt?: string;         // ISO timestamp — filled when delay is lifted
  mitigationNotes?: string;    // optional resolution / workaround notes
  createdAt?: string;
  updatedAt?: string;
}
```

A task can have **many** `TaskDelay` records (one per delay event).

### 3.3 `Task` status extension

Add `'postponed'` to the existing status union:

```typescript
// src/domain/entities/Task.ts
status: 'pending' | 'in_progress' | 'completed' | 'blocked' | 'cancelled' | 'postponed';
```

A task is set to `postponed` when `PostponeTaskUseCase` is called. It transitions back to the previous active status (or `pending`) when a delay is resolved.

---

## 4. Repository Interface

```typescript
// src/domain/repositories/ITaskDelayRepository.ts
export interface ITaskDelayRepository {
  save(delay: TaskDelay): Promise<void>;
  findByTaskId(taskId: string): Promise<TaskDelay[]>;
  findById(id: string): Promise<TaskDelay | null>;
  update(delay: TaskDelay): Promise<void>;
  delete(id: string): Promise<void>;
  findUnresolved(taskId: string): Promise<TaskDelay[]>;
  summarizeByReason(taskId?: string): Promise<{ reason: DelayReason; count: number }[]>;
}
```

---

## 5. Database Schema

### 5.1 `task_delays` table (new)

```typescript
// Addition to src/infrastructure/database/schema.ts
export const taskDelays = sqliteTable('task_delays', {
  localId: integer('local_id').primaryKey({ autoIncrement: true }),
  id: text('id').notNull().unique(),
  taskId: text('task_id').notNull(),
  reason: text('reason').notNull(),         // DelayReason string
  reasonDetails: text('reason_details'),
  reportedBy: text('reported_by'),
  reportedAt: integer('reported_at').notNull(), // Unix timestamp ms
  estimatedDelayDays: real('estimated_delay_days'),
  resolvedAt: integer('resolved_at'),           // Unix timestamp ms, nullable
  mitigationNotes: text('mitigation_notes'),
  createdAt: integer('created_at'),
  updatedAt: integer('updated_at'),
}, (table) => ({
  taskIdx: index('idx_task_delays_task').on(table.taskId),
  reasonIdx: index('idx_task_delays_reason').on(table.reason),
  resolvedIdx: index('idx_task_delays_resolved').on(table.resolvedAt),
}));
```

### 5.2 `tasks` table — `'postponed'` status column update

SQLite `text` columns with `enum` metadata are enforced only at the application layer; no migration DDL is needed to add a new status string. However, we document the expected migration entry (a no-op migration) to preserve migration alignment across environments.

### 5.3 Migration `0012_add_task_delays`

```sql
CREATE TABLE `task_delays` (
  `local_id` INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `id` TEXT NOT NULL,
  `task_id` TEXT NOT NULL,
  `reason` TEXT NOT NULL,
  `reason_details` TEXT,
  `reported_by` TEXT,
  `reported_at` INTEGER NOT NULL,
  `estimated_delay_days` REAL,
  `resolved_at` INTEGER,
  `mitigation_notes` TEXT,
  `created_at` INTEGER,
  `updated_at` INTEGER
);
CREATE UNIQUE INDEX `task_delays_id_unique` ON `task_delays` (`id`);
CREATE INDEX `idx_task_delays_task` ON `task_delays` (`task_id`);
CREATE INDEX `idx_task_delays_reason` ON `task_delays` (`reason`);
CREATE INDEX `idx_task_delays_resolved` ON `task_delays` (`resolved_at`);
```

---

## 6. Use Cases

All in `src/application/usecases/task/`.

### 6.1 `RecordTaskDelayUseCase`

**Input**: `{ taskId, reason, reasonDetails?, reportedBy?, reportedAt?, estimatedDelayDays?, mitigationNotes? }`  
**Behaviour**:
- Validates that `taskId` resolves to an existing task.
- Validates `reasonDetails` is non-empty when `reason === 'OTHER'`.
- Creates a `TaskDelay` record and persists via `ITaskDelayRepository.save()`.
- Does **not** auto-change task status (status change is `PostponeTaskUseCase`'s concern).

### 6.2 `PostponeTaskUseCase`

**Input**: `{ taskId, reason, reasonDetails?, reportedBy?, estimatedDelayDays?, mitigationNotes? }`  
**Behaviour**:
- Changes `Task.status` to `'postponed'` via `TaskRepository.update()`.
- Creates a `TaskDelay` record (calls `RecordTaskDelayUseCase` internally or inline).
- Idempotent: calling on an already-postponed task records an additional delay entry without error.

### 6.3 `ResolveTaskDelayUseCase`

**Input**: `{ delayId, resolvedAt?, mitigationNotes? }`  
**Behaviour**:
- Sets `TaskDelay.resolvedAt` and optionally `mitigationNotes`.
- If all delays for the task are resolved, optionally transitions the task's status back to `pending` (configurable flag `resumeTask: boolean`, default `true`).

### 6.4 `ListTaskDelaysUseCase`

**Input**: `{ taskId }`  
**Output**: `TaskDelay[]` ordered by `reportedAt` descending.

### 6.5 `GetDelayStatisticsUseCase`

**Input**: `{ taskId?: string }` — omitting `taskId` returns global summary.  
**Output**: `{ reason: DelayReason; label: string; count: number }[]` sorted by count descending.  
Used by the reporting / analytics screen.

---

## 7. Hook

```typescript
// src/hooks/useTaskDelays.ts
export interface UseTaskDelaysReturn {
  delays: TaskDelay[];
  loading: boolean;
  recordDelay: (input: RecordDelayInput) => Promise<void>;
  postponeTask: (input: PostponeInput) => Promise<void>;
  resolveDelay: (delayId: string, opts?: ResolveOptions) => Promise<void>;
  refresh: () => Promise<void>;
}

export function useTaskDelays(taskId: string): UseTaskDelaysReturn { ... }
```

---

## 8. UI Components

### 8.1 `TaskDelayHistoryList`

- `src/components/tasks/TaskDelayHistoryList.tsx`
- Renders an ordered list of `TaskDelay` entries: reason label + optional details, reporter, date, resolved badge.
- Empty state: "No delays recorded."

### 8.2 `RecordDelayModal`

- `src/components/tasks/RecordDelayModal.tsx`
- Full-screen modal (RN `Modal`) or bottom sheet.
- Fields: reason picker (scrollable list or dropdown), details text input (required for OTHER), reporter name field, estimated delay days, mitigation notes.
- CTA: "Record Delay" (calls `recordDelay`) and "Postpone Task" (calls `postponeTask`).

### 8.3 Task Detail integration

- In the task detail / edit page (`src/pages/tasks/EditTaskPage.tsx`), add:
  - "Add Delay" button → opens `RecordDelayModal`.
  - `<TaskDelayHistoryList taskId={task.id} />` section beneath task details.
  - Task status badge renders `postponed` with a distinct colour (e.g. amber).

### 8.4 Task Card (optional — nice-to-have)

- Show a small "🚫 Postponed" chip on the task list card when `status === 'postponed'`.

---

## 9. DI Registration

```typescript
// src/infrastructure/di/registerServices.ts additions
container.registerSingleton('TaskDelayRepository', DrizzleTaskDelayRepository);
```

---

## 10. Test Plan

### Unit tests (`__tests__/unit/`)

| File | Coverage |
|---|---|
| `RecordTaskDelayUseCase.test.ts` | Validates `OTHER` requires details; creates delay; rejects unknown taskId. |
| `PostponeTaskUseCase.test.ts` | Sets status to `postponed`; records delay; idempotent second call. |
| `ResolveTaskDelayUseCase.test.ts` | Sets `resolvedAt`; resumes task if all delays resolved; respects `resumeTask: false`. |
| `GetDelayStatisticsUseCase.test.ts` | Groups by reason, sorts by count, includes unresolved only option. |
| `useTaskDelays.test.tsx` | Hook state transitions; `recordDelay`, `postponeTask`, `resolveDelay` calls. |

### Integration tests (`__tests__/integration/`)

| File | Coverage |
|---|---|
| `DrizzleTaskDelayRepository.integration.test.ts` | Migration applied; save→findByTaskId roundtrip; `summarizeByReason`; unresolved filter. |
| `TaskDelayFlow.integration.test.tsx` | Full postpone → resolve flow through hooks + in-memory DB. |

---

## 11. Out of Scope (This Ticket)

- Export / reporting screen UI (delay summary report) — schema supports it; UI deferred.
- Push notifications when a task is postponed.
- Delay reason seeding from a remote catalog — local enum is sufficient.
- Cascade delete of `task_delays` when a task is deleted — documented as a follow-up.

---

## 12. Implementation Order (TDD)

1. `TaskDelay` entity + `DelayReason` enum + `DELAY_REASON_LABELS` map.
2. `ITaskDelayRepository` interface.
3. Unit tests (red) for all four use cases.
4. `DrizzleTaskDelayRepository` implementation + migration `0012`.
5. Integration test for repository (red → green).
6. Use case implementations (green all unit tests).
7. `useTaskDelays` hook + hook unit tests.
8. `TaskDelayHistoryList` + `RecordDelayModal` components.
9. Wire into `EditTaskPage`.
10. Full Jest run + `npx tsc --noEmit` clean.

---

## 13. Open Questions

*None — all acceptance criteria from the issue are addressed above.*

---

**APPROVAL REQUIRED before implementation begins.**
