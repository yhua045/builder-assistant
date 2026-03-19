# Design: Audit Log Feature — Issue #145

**Date**: 2026-03-19  
**Status**: Awaiting approval  
**Branch**: `145-audit-log`

---

## 1. User Story

> As a builder or owner, I want to see a chronological log of all actions taken on a Project and each Task, so I can trace what changed, when, and from which screen — without needing to compare field-by-field diffs.

---

## 2. Acceptance Criteria

- [ ] Every Create, Update, and Delete on a Task via the Task Form creates an audit log entry.
- [ ] Each entry stores: UTC timestamp, source (e.g. `"Task Form"`), action description, `projectId` (required), and optional `taskId`.
- [ ] An `AuditLogSection` component renders a scrollable list of entries below each Task detail view.
- [ ] An `AuditLogSection` component renders a scrollable list of entries on the Project detail view (all project-level entries, cross-task).
- [ ] Entries are displayed newest-first.
- [ ] The `auditLogs` table is persisted via Drizzle ORM + SQLite.
- [ ] Unit tests cover all three use cases.
- [ ] One integration test covers `DrizzleAuditLogRepository`.

---

## 3. Architecture Overview (Clean Architecture Layers)

```
Domain      → AuditLog entity + AuditLogRepository interface
Application → CreateAuditLogEntryUseCase
              GetAuditLogsByProjectUseCase
              GetAuditLogsByTaskUseCase
Infra       → auditLogs table (schema.ts)
              DrizzleAuditLogRepository
              DI registration (registerServices.ts)
UI          → useAuditLog hook (read)
              useCreateAuditLog hook (write)
              AuditLogSection component
              Wired into: useTaskForm, TaskDetailsPage, ProjectDetail
```

---

## 4. Domain Layer

### 4.1 Entity — `AuditLog`

**File**: `src/domain/entities/AuditLog.ts` *(new)*

```ts
export type AuditLogSource =
  | 'Task Form'
  | 'Payment'
  | 'Dashboard'
  | string; // extensible for future sources

export interface AuditLog {
  id: string;
  localId?: number;           // SQLite autoincrement PK
  projectId: string;          // required FK → projects.id
  taskId?: string;            // optional FK → tasks.id
  timestampUtc: string;       // ISO 8601 UTC string (new Date().toISOString())
  source: AuditLogSource;     // which screen/feature fired the event
  action: string;             // human-readable description, e.g. "Created task 'Frame walls'"
}
```

**Design decisions:**
- `AuditLog` records are **append-only** — no update or delete by application code. Retention/housekeeping is out of scope for #145.
- `timestampUtc` is stored as an ISO string in the domain layer but as a Unix-ms `INTEGER` in the database (consistent with all other timestamps in the schema).
- No `AuditLogEntity` class is needed (no business rules live here), only the plain interface.

### 4.2 Repository Interface

**File**: `src/domain/repositories/AuditLogRepository.ts` *(new)*

```ts
import { AuditLog } from '../entities/AuditLog';

export interface AuditLogRepository {
  save(entry: AuditLog): Promise<void>;
  findByProjectId(projectId: string): Promise<AuditLog[]>;
  findByTaskId(taskId: string): Promise<AuditLog[]>;
}
```

**Why no `update` / `delete`?** Audit logs are immutable records by definition. Exposing mutation methods would be a design smell and a compliance risk.

---

## 5. Database Schema Addition

**File modified**: `src/infrastructure/database/schema.ts`

Add this block at the end, after the `quotations` table:

```ts
// Audit Logs Table (issue #145)
export const auditLogs = sqliteTable('audit_logs', {
  localId: integer('local_id').primaryKey({ autoIncrement: true }),
  id: text('id').notNull().unique(),
  projectId: text('project_id').notNull(),
  taskId: text('task_id'),                     // nullable
  timestampUtc: integer('timestamp_utc').notNull(), // Unix ms
  source: text('source').notNull(),
  action: text('action').notNull(),
}, (table) => ({
  projectIdx: index('idx_audit_logs_project').on(table.projectId),
  taskIdx:    index('idx_audit_logs_task').on(table.taskId),
  tsIdx:      index('idx_audit_logs_ts').on(table.timestampUtc),
}));
```

**Migration**: After schema change, run `npm run db:generate`. Drizzle will output `drizzle/migrations/0020_audit_logs.sql` (exact name auto-generated). The migration SQL will be:

```sql
CREATE TABLE `audit_logs` (
  `local_id`       INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
  `id`             TEXT NOT NULL UNIQUE,
  `project_id`     TEXT NOT NULL,
  `task_id`        TEXT,
  `timestamp_utc`  INTEGER NOT NULL,
  `source`         TEXT NOT NULL,
  `action`         TEXT NOT NULL
);
CREATE INDEX `idx_audit_logs_project` ON `audit_logs` (`project_id`);
CREATE INDEX `idx_audit_logs_task` ON `audit_logs` (`task_id`);
CREATE INDEX `idx_audit_logs_ts` ON `audit_logs` (`timestamp_utc`);
```

---

## 6. Application Layer — Use Cases

### 6.1 `CreateAuditLogEntryUseCase`

**File**: `src/application/usecases/auditlog/CreateAuditLogEntryUseCase.ts` *(new)*

```ts
import { AuditLog, AuditLogSource } from '../../../domain/entities/AuditLog';
import { AuditLogRepository } from '../../../domain/repositories/AuditLogRepository';

export interface CreateAuditLogEntryParams {
  projectId: string;
  taskId?: string;
  source: AuditLogSource;
  action: string;
}

export class CreateAuditLogEntryUseCase {
  constructor(private readonly repo: AuditLogRepository) {}

  async execute(params: CreateAuditLogEntryParams): Promise<AuditLog> {
    const entry: AuditLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      projectId: params.projectId,
      taskId: params.taskId,
      timestampUtc: new Date().toISOString(),
      source: params.source,
      action: params.action,
    };
    await this.repo.save(entry);
    return entry;
  }
}
```

### 6.2 `GetAuditLogsByProjectUseCase`

**File**: `src/application/usecases/auditlog/GetAuditLogsByProjectUseCase.ts` *(new)*

```ts
import { AuditLog } from '../../../domain/entities/AuditLog';
import { AuditLogRepository } from '../../../domain/repositories/AuditLogRepository';

export class GetAuditLogsByProjectUseCase {
  constructor(private readonly repo: AuditLogRepository) {}

  async execute(projectId: string): Promise<AuditLog[]> {
    const logs = await this.repo.findByProjectId(projectId);
    return logs.sort((a, b) =>
      new Date(b.timestampUtc).getTime() - new Date(a.timestampUtc).getTime()
    );
  }
}
```

### 6.3 `GetAuditLogsByTaskUseCase`

**File**: `src/application/usecases/auditlog/GetAuditLogsByTaskUseCase.ts` *(new)*

```ts
import { AuditLog } from '../../../domain/entities/AuditLog';
import { AuditLogRepository } from '../../../domain/repositories/AuditLogRepository';

export class GetAuditLogsByTaskUseCase {
  constructor(private readonly repo: AuditLogRepository) {}

  async execute(taskId: string): Promise<AuditLog[]> {
    const logs = await this.repo.findByTaskId(taskId);
    return logs.sort((a, b) =>
      new Date(b.timestampUtc).getTime() - new Date(a.timestampUtc).getTime()
    );
  }
}
```

**Design note on sorting**: The repository returns rows in DB order; the use case sorts newest-first. This keeps the repository dumb and the use case intention explicit. If performance becomes a concern, the repository can be enhanced to `ORDER BY timestamp_utc DESC`.

---

## 7. Infrastructure Layer

### 7.1 `DrizzleAuditLogRepository`

**File**: `src/infrastructure/repositories/DrizzleAuditLogRepository.ts` *(new)*

Pattern follows `DrizzlePaymentRepository` (raw `db.executeSql`, `initDatabase()`, row mapper).

```ts
import { AuditLog } from '../../domain/entities/AuditLog';
import { AuditLogRepository } from '../../domain/repositories/AuditLogRepository';
import { initDatabase } from '../database/connection';

export class DrizzleAuditLogRepository implements AuditLogRepository {
  private rowToEntity(row: any): AuditLog {
    return {
      id: row.id,
      localId: row.local_id,
      projectId: row.project_id,
      taskId: row.task_id ?? undefined,
      timestampUtc: new Date(row.timestamp_utc).toISOString(),
      source: row.source,
      action: row.action,
    };
  }

  async save(entry: AuditLog): Promise<void> {
    const { db } = await initDatabase();
    await db.executeSql(
      `INSERT INTO audit_logs (id, project_id, task_id, timestamp_utc, source, action)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        entry.id,
        entry.projectId,
        entry.taskId ?? null,
        new Date(entry.timestampUtc).getTime(),
        entry.source,
        entry.action,
      ],
    );
  }

  async findByProjectId(projectId: string): Promise<AuditLog[]> {
    const { db } = await initDatabase();
    const [res] = await db.executeSql(
      `SELECT * FROM audit_logs WHERE project_id = ? ORDER BY timestamp_utc DESC`,
      [projectId],
    );
    const items: AuditLog[] = [];
    for (let i = 0; i < res.rows.length; i++) {
      items.push(this.rowToEntity(res.rows.item(i)));
    }
    return items;
  }

  async findByTaskId(taskId: string): Promise<AuditLog[]> {
    const { db } = await initDatabase();
    const [res] = await db.executeSql(
      `SELECT * FROM audit_logs WHERE task_id = ? ORDER BY timestamp_utc DESC`,
      [taskId],
    );
    const items: AuditLog[] = [];
    for (let i = 0; i < res.rows.length; i++) {
      items.push(this.rowToEntity(res.rows.item(i)));
    }
    return items;
  }
}
```

### 7.2 DI Registration

**File modified**: `src/infrastructure/di/registerServices.ts`

Add to the `container.registerSingleton` block:

```ts
import { DrizzleAuditLogRepository } from '../repositories/DrizzleAuditLogRepository';
// ...
container.registerSingleton('AuditLogRepository', DrizzleAuditLogRepository);
```

---

## 8. Query Keys & Cache Invalidation

**File modified**: `src/hooks/queryKeys.ts`

Add to `queryKeys`:

```ts
/** Audit logs scoped to a project (all entries) */
auditLogsByProject: (projectId: string) =>
  ['auditLogs', 'project', projectId] as const,

/** Audit logs scoped to a task */
auditLogsByTask: (taskId: string) =>
  ['auditLogs', 'task', taskId] as const,
```

Add to `invalidations`:

```ts
/**
 * A task was created, updated, or deleted (audit side-effect).
 * Invalidate audit log views for the project and (if known) the task.
 */
auditLogWritten: (ctx: { projectId: string; taskId?: string }) => [
  queryKeys.auditLogsByProject(ctx.projectId),
  ...(ctx.taskId ? [queryKeys.auditLogsByTask(ctx.taskId)] : []),
],
```

Also add context type:
```ts
export type AuditLogCtx = { projectId: string; taskId?: string };
```

---

## 9. Hooks (UI→Application Connectors)

### 9.1 `useAuditLog` — Read

**File**: `src/hooks/useAuditLog.ts` *(new)*

```ts
import { useQuery } from '@tanstack/react-query';
import { container } from 'tsyringe';
import { queryKeys } from './queryKeys';
import { AuditLogRepository } from '../domain/repositories/AuditLogRepository';
import { GetAuditLogsByProjectUseCase } from '../application/usecases/auditlog/GetAuditLogsByProjectUseCase';
import { GetAuditLogsByTaskUseCase } from '../application/usecases/auditlog/GetAuditLogsByTaskUseCase';

/** Fetch all audit logs for a project (cross-task view). */
export function useAuditLogsByProject(projectId: string) {
  return useQuery({
    queryKey: queryKeys.auditLogsByProject(projectId),
    queryFn: async () => {
      const repo = container.resolve<AuditLogRepository>('AuditLogRepository');
      return new GetAuditLogsByProjectUseCase(repo).execute(projectId);
    },
    enabled: Boolean(projectId),
  });
}

/** Fetch audit logs scoped to a single task. */
export function useAuditLogsByTask(taskId: string) {
  return useQuery({
    queryKey: queryKeys.auditLogsByTask(taskId),
    queryFn: async () => {
      const repo = container.resolve<AuditLogRepository>('AuditLogRepository');
      return new GetAuditLogsByTaskUseCase(repo).execute(taskId);
    },
    enabled: Boolean(taskId),
  });
}
```

### 9.2 `useCreateAuditLog` — Write

**File**: `src/hooks/useCreateAuditLog.ts` *(new)*

This hook returns a stable `createEntry` callback (similar to how `useTaskForm` constructs its use cases with `useMemo`). It does **not** use `useMutation` to avoid coupling the write call to the task save lifecycle — callers simply `await createEntry(...)` inside their own mutation callback, then invalidate.

```ts
import { useCallback, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { container } from 'tsyringe';
import { AuditLogRepository } from '../domain/repositories/AuditLogRepository';
import { CreateAuditLogEntryUseCase, CreateAuditLogEntryParams } from '../application/usecases/auditlog/CreateAuditLogEntryUseCase';
import { invalidations } from './queryKeys';
import '../infrastructure/di/registerServices';

export function useCreateAuditLog() {
  const queryClient = useQueryClient();
  const repo = useMemo(
    () => container.resolve<AuditLogRepository>('AuditLogRepository'),
    [],
  );
  const useCase = useMemo(() => new CreateAuditLogEntryUseCase(repo), [repo]);

  const createEntry = useCallback(
    async (params: CreateAuditLogEntryParams) => {
      const entry = await useCase.execute(params);
      await Promise.all(
        invalidations.auditLogWritten({ projectId: params.projectId, taskId: params.taskId })
          .map(key => queryClient.invalidateQueries({ queryKey: key }))
      );
      return entry;
    },
    [useCase, queryClient],
  );

  return { createEntry };
}
```

---

## 10. Where Audit Events Fire in the Task Form

**File modified**: `src/hooks/useTaskForm.ts`

The `submit()` function has two branches — **create** and **update**. After each succeeds, fire a `createEntry` call. The `createEntry` function is obtained from `useCreateAuditLog()` injected into `useTaskForm`.

### 10.1 Create path (inside `submit`, after `createTaskUseCase.execute`)

```ts
await createAuditEntry({
  projectId: task.projectId!,
  taskId: task.id,
  source: 'Task Form',
  action: `Created task "${task.title}"`,
});
```

### 10.2 Update path (inside `submit`, after `updateTaskUseCase.execute`)

```ts
await createAuditEntry({
  projectId: updatedTask.projectId!,
  taskId: updatedTask.id,
  source: 'Task Form',
  action: `Updated task "${updatedTask.title}"`,
});
```

### 10.3 Delete path

`DeleteTaskUseCase` is called from `useTaskForm` (or from page-level handlers). We modify `DeleteTaskUseCase` to accept an optional `AuditLogRepository` so it can write a log entry as part of the delete operation, preserving the last known task title:

**File modified**: `src/application/usecases/task/DeleteTaskUseCase.ts`

```ts
import { TaskRepository } from '../../../domain/repositories/TaskRepository';
import { AuditLogRepository } from '../../../domain/repositories/AuditLogRepository';
import { CreateAuditLogEntryUseCase } from '../auditlog/CreateAuditLogEntryUseCase';

export class DeleteTaskUseCase {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly auditLogRepository?: AuditLogRepository,
  ) {}

  async execute(id: string): Promise<void> {
    // Capture task data before deletion
    const task = this.auditLogRepository
      ? await this.taskRepository.findById(id)
      : null;

    await this.taskRepository.deleteDependenciesByTaskId(id);
    await this.taskRepository.deleteDelayReasonsByTaskId(id);
    await this.taskRepository.delete(id);

    if (task && this.auditLogRepository && task.projectId) {
      await new CreateAuditLogEntryUseCase(this.auditLogRepository).execute({
        projectId: task.projectId,
        taskId: task.id,
        source: 'Task Form',
        action: `Deleted task "${task.title}"`,
      });
    }
  }
}
```

**Design note**: Making `auditLogRepository` optional keeps backward compatibility with all existing tests that construct `DeleteTaskUseCase` with only `taskRepository`. The DI container will pass both.

---

## 11. UI Components

### 11.1 `AuditLogSection` (reusable)

**File**: `src/components/tasks/AuditLogSection.tsx` *(new)*

Props:
```ts
interface AuditLogSectionProps {
  logs: AuditLog[];
  isLoading: boolean;
  /** Optional max visible entries before "Show all" collapse */
  maxVisible?: number;
}
```

Renders:
- Section header: `"Activity Log"` with entry count badge
- A `FlatList` / `ScrollView` of `AuditLogRow` items (newest-first, already sorted by use case)
- Each row: timestamp formatted as `"DD MMM YYYY, HH:mm"` + source badge + action text
- Collapse/expand when more than `maxVisible` (default: `5`) entries
- Empty state: `"No activity recorded yet."`
- Loading skeleton (3 placeholder rows)

### 11.2 Integration into `TaskDetailsPage`

**File modified**: `src/pages/tasks/TaskDetailsPage.tsx`

```tsx
const { data: auditLogs = [], isLoading: logsLoading } = useAuditLogsByTask(task.id);

// Inside the ScrollView, after TaskProgressSection or TaskDocumentSection:
<AuditLogSection logs={auditLogs} isLoading={logsLoading} maxVisible={5} />
```

### 11.3 Integration into `ProjectDetail`

**File modified**: `src/pages/projects/ProjectDetail.tsx`

```tsx
const { data: auditLogs = [], isLoading: logsLoading } = useAuditLogsByProject(project.id);

// Inside the project detail tab or at the bottom of the project detail ScrollView:
<AuditLogSection logs={auditLogs} isLoading={logsLoading} maxVisible={10} />
```

---

## 12. File-by-File Change Summary

### New Files

| File | Description |
|------|-------------|
| `src/domain/entities/AuditLog.ts` | `AuditLog` interface + `AuditLogSource` type |
| `src/domain/repositories/AuditLogRepository.ts` | Repository interface (save, findByProjectId, findByTaskId) |
| `src/application/usecases/auditlog/CreateAuditLogEntryUseCase.ts` | Creates and saves a log entry |
| `src/application/usecases/auditlog/GetAuditLogsByProjectUseCase.ts` | Fetches + sorts logs for a project |
| `src/application/usecases/auditlog/GetAuditLogsByTaskUseCase.ts` | Fetches + sorts logs for a task |
| `src/infrastructure/repositories/DrizzleAuditLogRepository.ts` | SQLite-backed repository implementation |
| `src/hooks/useAuditLog.ts` | `useAuditLogsByProject` + `useAuditLogsByTask` read hooks |
| `src/hooks/useCreateAuditLog.ts` | `useCreateAuditLog` write hook with cache invalidation |
| `src/components/tasks/AuditLogSection.tsx` | Reusable list component (task + project views) |

### Modified Files

| File | Change |
|------|--------|
| `src/infrastructure/database/schema.ts` | Add `auditLogs` table definition |
| `src/infrastructure/di/registerServices.ts` | Register `DrizzleAuditLogRepository` as `'AuditLogRepository'` |
| `src/hooks/queryKeys.ts` | Add `auditLogsByProject`, `auditLogsByTask` keys + `auditLogWritten` invalidation |
| `src/hooks/useTaskForm.ts` | Inject `useCreateAuditLog`, fire events on create/update |
| `src/application/usecases/task/DeleteTaskUseCase.ts` | Accept optional `AuditLogRepository`, fire delete event |
| `src/pages/tasks/TaskDetailsPage.tsx` | Mount `AuditLogSection` with `useAuditLogsByTask` |
| `src/pages/projects/ProjectDetail.tsx` | Mount `AuditLogSection` with `useAuditLogsByProject` |

### Auto-generated on `npm run db:generate`

| File | Description |
|------|-------------|
| `drizzle/migrations/0020_audit_logs.sql` | CREATE TABLE + indexes (filename auto-assigned by Drizzle) |
| `drizzle/migrations/meta/_journal.json` | Updated by Drizzle |

---

## 13. Test Plan

### Unit Tests (new files in `__tests__/unit/`)

| File | Tests |
|------|-------|
| `__tests__/unit/CreateAuditLogEntryUseCase.test.ts` | ① Saves entry with all required fields; ② Generates unique `id`; ③ `timestampUtc` is a valid ISO string; ④ `projectId` is required (no save if empty) |
| `__tests__/unit/GetAuditLogsByProjectUseCase.test.ts` | ① Returns logs sorted newest-first; ② Returns empty array when no logs; ③ Delegates correctly to `findByProjectId` |
| `__tests__/unit/GetAuditLogsByTaskUseCase.test.ts` | ① Returns logs sorted newest-first; ② Returns empty array when no logs; ③ Delegates correctly to `findByTaskId` |
| `__tests__/unit/DeleteTaskUseCase.auditlog.test.ts` | ① Records delete event with task title when `auditLogRepository` provided; ② Does NOT call `auditLogRepository` when not provided (backward compat); ③ Captures title before deletion |

**Mock pattern** (consistent with `AddDelayReasonUseCase.test.ts`):

```ts
function makeMockAuditLogRepo(overrides: Partial<AuditLogRepository> = {}): AuditLogRepository {
  return {
    save: jest.fn().mockResolvedValue(undefined),
    findByProjectId: jest.fn().mockResolvedValue([]),
    findByTaskId: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}
```

### Integration Tests (new file in `__tests__/integration/`)

| File | Tests |
|------|-------|
| `__tests__/integration/DrizzleAuditLogRepository.integration.test.ts` | ① `save` + `findByProjectId` round-trip; ② `findByTaskId` scopes correctly; ③ `findByProjectId` returns multiple entries in DESC timestamp order; ④ Entry without `taskId` is stored and retrieved correctly |

Uses the **same `better-sqlite3 :memory:` mock** pattern as `DrizzleTaskRepository.integration.test.ts`.

---

## 14. Design Decisions & Trade-offs

### 14.1 Append-only logs (no update/delete in repository)
**Decision**: The `AuditLogRepository` has only `save`, `findByProjectId`, `findByTaskId`.  
**Rationale**: Audit logs derive their value from immutability. Exposing mutation APIs enables accidental or intentional data tampering. If soft-deletion or retention policies are needed in future, that is a separate issue.

### 14.2 Optional `AuditLogRepository` in `DeleteTaskUseCase`
**Decision**: `auditLogRepository` is optional in `DeleteTaskUseCase`.  
**Rationale**: All existing unit tests pass `DeleteTaskUseCase` with only `taskRepository`. Making it optional preserves backward compatibility with a zero-change test update burden.

### 14.3 Fire events in the hook layer, not the use case layer
**Decision**: `useTaskForm` calls `createAuditEntry` directly after `createTaskUseCase.execute()` / `updateTaskUseCase.execute()`, rather than coupling the use cases to `AuditLogRepository`.  
**Rationale**: This keeps `CreateTaskUseCase` and `UpdateTaskUseCase` single-responsibility and side-effect-free. The hook layer already orchestrates multiple use case calls (documents, dependencies, etc.) — audit logging fits naturally here. **Exception for delete**: delete happens in the use case itself (before data expiry) to safely capture the task title before it is erased.

### 14.4 Not using Drizzle query builder
**Decision**: `DrizzleAuditLogRepository` uses raw `db.executeSql` (not `drizzle(...).insert / .select`).  
**Rationale**: All existing repository implementations in this codebase use raw SQL via the SQLite proxy. This is consistent with the established implementation pattern and avoids introducing a second query style.

### 14.5 Action string is free text, not a typed enum
**Decision**: `action` is a plain `string`, not a discriminated union.  
**Rationale**: Free-text descriptions are human-readable and flexible. A typed enum would add ceremony without benefit at this scale. A `source` union type (`AuditLogSource`) is typed because it drives UI filtering in future.

### 14.6 Sorting happens in the use case, not the repository
**Decision**: Both `GetAuditLogs*` use cases sort newest-first in JS code (not via SQL `ORDER BY`).  
**Rationale**: The repository already queries `ORDER BY timestamp_utc DESC` for performance. The use case sort is a safety net that adds negligible cost for small datasets. If the repository guarantees order, the sort is effectively a no-op.

### 14.7 No real-time / live subscription
**Decision**: Logs are fetched with TanStack Query (`useQuery`), not a live subscription.  
**Rationale**: SQLite does not support pub/sub. Cache invalidation via `queryClient.invalidateQueries` after a write is the established, correct pattern in this codebase.

---

## 15. Out of Scope (Issue #145)

- Audit logs for entities other than Tasks (payments, invoices, quotations) — future issues.
- Log retention / pruning policy.
- Audit log export / email.
- User attribution (no `userId` field — single-user app at this stage).
- Server-side sync of audit logs.

---

## 16. Handoff

**Label**: Start TDD  
**Agent**: developer  
**Prompt**: "Plan approved. Write failing tests for these requirements."

> Begin with unit test files listed in §13, then the integration test, then implement in order:  
> Domain → Application → Infrastructure (schema + migration + repository + DI) → Hooks → UI components → Wire into TaskDetailsPage + ProjectDetail.
