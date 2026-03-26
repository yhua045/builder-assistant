# Design: Issue #181 — Safe 'Mark as Complete' Validation for Tasks

**Status**: DRAFT — pending approval  
**Author**: Copilot  
**Date**: 2026-03-26  
**GitHub Issue**: https://github.com/yhua045/builder-assistant/issues/181

---

## 1. User Stories

| # | Story |
|---|---|
| US-1 | As a Builder, when I tap "Mark as Completed" on a task, I want the app to detect any unresolved Quotations still attached to that task so I am not surprised by dangling paperwork. |
| US-2 | As a Builder, if one or more Quotations are in an unresolved state (`draft` / `sent`), I want a clear blocking dialog that names the Quotations so I know exactly which ones need action. |
| US-3 | As a Builder, if all linked Quotations are `accepted` or `declined` (or no Quotations exist), I want completion to proceed without any extra steps. |
| US-4 | As a Builder, the validation must work entirely offline against local SQLite data so there is no network dependency. |

---

## 2. Acceptance Criteria

| # | Criterion |
|---|---|
| AC-1 | `TaskCompletionValidator.validate(taskId)` returns `{ ok: true }` when the task has no linked `Quotation` records. |
| AC-2 | `TaskCompletionValidator.validate(taskId)` returns `{ ok: true }` when all linked `Quotation` records have status `'accepted'` or `'declined'`. |
| AC-3 | `TaskCompletionValidator.validate(taskId)` returns `{ ok: false, reason: 'PENDING_QUOTATIONS', pendingQuotations: [...] }` when one or more linked `Quotation` records have status `'draft'` or `'sent'`. |
| AC-4 | `CompleteTaskUseCase.execute(taskId)` calls the validator and throws a typed `TaskCompletionValidationError` when the validation fails (i.e., returns `ok: false`). |
| AC-5 | `CompleteTaskUseCase.execute(taskId)` sets `task.status = 'completed'` and `task.completedAt = ISO timestamp` and persists the change via `TaskRepository.update()` when validation passes. |
| AC-6 | `CompleteTaskUseCase.execute(taskId)` throws `TaskNotFoundError` when the task id does not exist. |
| AC-7 | The UI hook exposes a `completeTask(taskId)` function that catches `TaskCompletionValidationError` and shows a React Native `Alert` dialog listing the blocking Quotation references (e.g. "QT-2026-001, QT-2026-002 are not yet resolved"). |
| AC-8 | The "Mark as Completed" `Pressable` in `TaskDetailsPage` is wired to `completeTask(taskId)` and is disabled (with a visual indicator) while the async operation is in flight. |
| AC-9 | Unit tests cover all validator branches (no quotations / all resolved / one+ pending) using in-memory mocks. |
| AC-10 | Unit tests cover `CompleteTaskUseCase` for: task-not-found, validation-fails (throws), and successful completion path. |
| AC-11 | Integration tests cover `CompleteTaskUseCase` against `DrizzleQuotationRepository` and `DrizzleTaskRepository` backed by `better-sqlite3 :memory:`. |
| AC-12 | TypeScript strict mode passes with zero new errors (`npx tsc --noEmit`). |

---

## 3. Domain Model Analysis

### 3.1 The Two "Quote" Concepts — Disambiguation

The codebase currently has **two** related but distinct constructs:

| Construct | Entity file | DB table | `taskId` FK | Statuses |
|---|---|---|---|---|
| **`Quotation`** | `src/domain/entities/Quotation.ts` | `quotations` | `quotation.taskId` (soft FK, indexed) | `draft`, `sent`, `accepted`, `declined` |
| `tasks.quoteStatus` | `src/domain/entities/Task.ts` | `tasks.quote_status` | n/a (on the task itself) | `pending`, `issued`, `accepted`, `rejected` |

**This feature operates on `Quotation` records** — standalone quotation documents linked to a task via `Quotation.taskId`. The per-task `quoteStatus` field is a legacy shorthand for the single-quote workflow (Issue #141) and is **not** used by this validator.

### 3.2 Status Mapping

The issue requirements use informal terms. The canonical mapping to existing domain status values is:

| Issue requirement term | Domain mapping (`Quotation.status`) |
|---|---|
| "pending" (blocks completion) | `'draft'` **or** `'sent'` |
| "approved" (allows completion) | `'accepted'` |
| "rejected" (allows completion) | `'declined'` |

A `Quotation` with `deletedAt` set (soft-deleted) is excluded from validation (not considered linked).

### 3.3 No Schema Changes Required

All necessary data is already present:
- `quotations.task_id` column and `idx_quotations_task` index exist.
- `QuotationRepository.findByTask(taskId)` is already declared in `src/domain/repositories/QuotationRepository.ts`.
- `tasks.status` accepts `'completed'`; no migration is needed.

---

## 4. Architecture

### 4.1 Layer Responsibilities

```
┌─────────────────────────────────────────────────────┐
│  UI Layer (pages/tasks/TaskDetailsPage.tsx)          │
│  • Calls hook: useTasks().completeTask(taskId)       │
│  • Catches TaskCompletionValidationError             │
│  • Renders Alert dialog with blocking quotation refs │
└────────────────────────┬────────────────────────────┘
                         │ calls
┌────────────────────────▼────────────────────────────┐
│  Hook Layer (hooks/useTasks.ts)                      │
│  • Instantiates CompleteTaskUseCase via DI           │
│  • Exposes completeTask(taskId): Promise<void>       │
│  • On success → invalidates queryKeys.tasks(...)     │
└────────────────────────┬────────────────────────────┘
                         │ delegates to
┌────────────────────────▼────────────────────────────┐
│  Application Layer                                   │
│  ├─ CompleteTaskUseCase                              │
│  │   • Orchestrates: fetch task → validate → update │
│  │   • Throws TaskCompletionValidationError          │
│  │   • Throws TaskNotFoundError                     │
│  └─ TaskCompletionValidator                         │
│      • Pure validation logic                         │
│      • Accepts TaskRepository + QuotationRepository  │
│      • Returns typed ValidationResult               │
└───────────┬────────────────────┬───────────────────┘
            │                    │
┌───────────▼──────┐  ┌──────────▼──────────────────┐
│  Domain Layer     │  │  Domain Layer                │
│  TaskRepository   │  │  QuotationRepository         │
│  (interface)      │  │  (interface)                 │
└───────────┬──────┘  └──────────┬───────────────────┘
            │                    │
┌───────────▼────────────────────▼───────────────────┐
│  Infrastructure Layer                               │
│  DrizzleTaskRepository + DrizzleQuotationRepository │
└─────────────────────────────────────────────────────┘
```

### 4.2 New Files

| File | Layer | Purpose |
|---|---|---|
| `src/application/usecases/task/TaskCompletionValidator.ts` | Application | Pure validation logic; injectable, testable in isolation |
| `src/application/usecases/task/CompleteTaskUseCase.ts` | Application | Orchestrates fetch + validate + persist |
| `src/application/errors/TaskCompletionErrors.ts` | Application | Typed error classes |
| `__tests__/unit/TaskCompletionValidator.test.ts` | Test | Unit tests — all validator branches |
| `__tests__/unit/CompleteTaskUseCase.test.ts` | Test | Unit tests — use case orchestration |
| `__tests__/integration/CompleteTaskUseCase.integration.test.ts` | Test | Integration tests — real Drizzle shim |

### 4.3 Modified Files

| File | Change |
|---|---|
| `src/hooks/useTasks.ts` | Add `completeTask` to `UseTasksReturn`; wire to `CompleteTaskUseCase` |
| `src/pages/tasks/TaskDetailsPage.tsx` | Wire "Mark as Completed" button; handle `TaskCompletionValidationError` |

---

## 5. Detailed Interface Contracts

### 5.1 Typed Error Classes
**`src/application/errors/TaskCompletionErrors.ts`**

```typescript
import type { Quotation } from '../../domain/entities/Quotation';

export class TaskNotFoundError extends Error {
  constructor(taskId: string) {
    super(`Task not found: ${taskId}`);
    this.name = 'TaskNotFoundError';
  }
}

export class TaskCompletionValidationError extends Error {
  readonly code = 'PENDING_QUOTATIONS' as const;
  readonly pendingQuotations: Pick<Quotation, 'id' | 'reference' | 'status'>[];

  constructor(pendingQuotations: Pick<Quotation, 'id' | 'reference' | 'status'>[]) {
    const refs = pendingQuotations.map(q => q.reference).join(', ');
    super(`Cannot complete task: unresolved quotations [${refs}]`);
    this.name = 'TaskCompletionValidationError';
    this.pendingQuotations = pendingQuotations;
  }
}
```

### 5.2 TaskCompletionValidator
**`src/application/usecases/task/TaskCompletionValidator.ts`**

```typescript
import type { QuotationRepository } from '../../../domain/repositories/QuotationRepository';
import type { Quotation } from '../../../domain/entities/Quotation';

/** Statuses that block task completion (quotation not yet resolved). */
const BLOCKING_STATUSES: Quotation['status'][] = ['draft', 'sent'];

export interface ValidationResult {
  ok: boolean;
  pendingQuotations: Pick<Quotation, 'id' | 'reference' | 'status'>[];
}

export class TaskCompletionValidator {
  constructor(private readonly quotationRepository: QuotationRepository) {}

  async validate(taskId: string): Promise<ValidationResult> {
    const quotations = await this.quotationRepository.findByTask(taskId);

    // Exclude soft-deleted records
    const activeQuotations = quotations.filter(q => !q.deletedAt);

    const pending = activeQuotations
      .filter(q => BLOCKING_STATUSES.includes(q.status))
      .map(({ id, reference, status }) => ({ id, reference, status }));

    return {
      ok: pending.length === 0,
      pendingQuotations: pending,
    };
  }
}
```

### 5.3 CompleteTaskUseCase
**`src/application/usecases/task/CompleteTaskUseCase.ts`**

```typescript
import type { TaskRepository } from '../../../domain/repositories/TaskRepository';
import type { QuotationRepository } from '../../../domain/repositories/QuotationRepository';
import { TaskCompletionValidator } from './TaskCompletionValidator';
import { TaskNotFoundError, TaskCompletionValidationError } from '../../errors/TaskCompletionErrors';

export class CompleteTaskUseCase {
  private readonly validator: TaskCompletionValidator;

  constructor(
    private readonly taskRepository: TaskRepository,
    quotationRepository: QuotationRepository,
  ) {
    this.validator = new TaskCompletionValidator(quotationRepository);
  }

  async execute(taskId: string): Promise<void> {
    const task = await this.taskRepository.findById(taskId);
    if (!task) {
      throw new TaskNotFoundError(taskId);
    }

    // Guard: already completed tasks are a no-op
    if (task.status === 'completed') {
      return;
    }

    const result = await this.validator.validate(taskId);
    if (!result.ok) {
      throw new TaskCompletionValidationError(result.pendingQuotations);
    }

    await this.taskRepository.update({
      ...task,
      status: 'completed',
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
}
```

### 5.4 Hook Extension
**`src/hooks/useTasks.ts`** — additions to `UseTasksReturn` interface and hook body:

```typescript
// Interface addition
completeTask: (taskId: string) => Promise<void>;

// Hook body addition
const completeTaskUseCase = useMemo(() => {
  const quotationRepository = container.resolve<QuotationRepository>('QuotationRepository');
  return new CompleteTaskUseCase(taskRepository, quotationRepository);
}, [taskRepository]);

const completeTask = useCallback(async (taskId: string) => {
  await completeTaskUseCase.execute(taskId);
  await queryClient.invalidateQueries({ queryKey: queryKeys.tasks(projectId) });
}, [completeTaskUseCase, queryClient, projectId]);
```

### 5.5 UI Wiring (TaskDetailsPage)

The existing stub `onPress={() => {}}` on the "Mark as Completed" `Pressable` is replaced:

```typescript
const [completing, setCompleting] = useState(false);
const { completeTask } = useTasks(task?.projectId);

const handleComplete = useCallback(async () => {
  if (!task) return;
  setCompleting(true);
  try {
    await completeTask(task.id);
    navigation.goBack();
  } catch (err) {
    if (err instanceof TaskCompletionValidationError) {
      const refs = err.pendingQuotations.map(q => q.reference).join('\n• ');
      Alert.alert(
        'Cannot Mark as Complete',
        `The following quotations are still unresolved:\n\n• ${refs}\n\nPlease accept or decline each quotation before completing this task.`,
        [{ text: 'OK' }],
      );
    } else {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    }
  } finally {
    setCompleting(false);
  }
}, [task, completeTask, navigation]);
```

---

## 6. Transactional Boundary

SQLite via `react-native-sqlite-storage` does not expose an explicit transaction API in the current Drizzle connection helper (`src/infrastructure/database/connection.ts`). The completion sequence is:

1. `taskRepository.findById(taskId)` — read
2. `quotationRepository.findByTask(taskId)` — read
3. `taskRepository.update(completedTask)` — single write

Step 3 is a single-row `UPDATE` and is inherently atomic at the SQLite level. No multi-statement transaction boundary is required for correctness. The reads in steps 1–2 are pre-condition checks and their data does not persist. If a concurrent write changes quotation status between step 2 and step 3, the validator will re-run on the next user action, which is acceptable for a mobile offline-first context.

> **Note**: If future requirements add side-effects (e.g., auto-archiving invoices), revisit wrapping steps 2–3 in a Drizzle transaction.

---

## 7. Test Specification

### 7.1 Unit Tests — `TaskCompletionValidator`
**`__tests__/unit/TaskCompletionValidator.test.ts`**

| # | Test description | Setup | Expected outcome |
|---|---|---|---|
| T-1 | No quotations → `ok: true` | `findByTask` returns `[]` | `{ ok: true, pendingQuotations: [] }` |
| T-2 | All quotations `accepted` → `ok: true` | `findByTask` returns `[{ status: 'accepted' }]` | `{ ok: true, pendingQuotations: [] }` |
| T-3 | All quotations `declined` → `ok: true` | `findByTask` returns `[{ status: 'declined' }]` | `{ ok: true, pendingQuotations: [] }` |
| T-4 | Mixed `accepted` + `declined` → `ok: true` | Two quotations, both terminal statuses | `{ ok: true, pendingQuotations: [] }` |
| T-5 | One `draft` quotation → `ok: false` | `findByTask` returns `[{ status: 'draft' }]` | `{ ok: false, pendingQuotations: [{ status: 'draft', ... }] }` |
| T-6 | One `sent` quotation → `ok: false` | `findByTask` returns `[{ status: 'sent' }]` | `{ ok: false, pendingQuotations: [{ status: 'sent', ... }] }` |
| T-7 | Mix `draft` + `accepted` → `ok: false` | Two quotations with one pending | `pendingQuotations` contains only the `draft` one |
| T-8 | Soft-deleted `draft` is ignored → `ok: true` | `findByTask` returns `[{ status: 'draft', deletedAt: '...' }]` | `{ ok: true, pendingQuotations: [] }` |
| T-9 | Multiple pending quotations → `ok: false` with all listed | `findByTask` returns 2 × `draft` quotations | `pendingQuotations.length === 2` |

### 7.2 Unit Tests — `CompleteTaskUseCase`
**`__tests__/unit/CompleteTaskUseCase.test.ts`**

| # | Test description | Setup | Expected outcome |
|---|---|---|---|
| T-10 | Task not found → throws `TaskNotFoundError` | `findById` returns `null` | `throw TaskNotFoundError` |
| T-11 | Task already completed → no-op (no update call) | `task.status = 'completed'`; validator passes | `taskRepository.update` not called |
| T-12 | Validation fails → throws `TaskCompletionValidationError` | Validator returns `ok: false` | `throw TaskCompletionValidationError`; `update` not called |
| T-13 | `TaskCompletionValidationError` carries blocking quotation refs | Validator returns 2 pending quotations | `error.pendingQuotations` has both quotations |
| T-14 | Successful completion → `update` called with `status: 'completed'` | Validator returns `ok: true` | `taskRepository.update` called with `status: 'completed'` |
| T-15 | Successful completion → `update` called with `completedAt` set | Validator returns `ok: true` | Updated task has non-null `completedAt` ISO string |

### 7.3 Integration Tests — `CompleteTaskUseCase`
**`__tests__/integration/CompleteTaskUseCase.integration.test.ts`**

Uses the same `better-sqlite3 :memory:` shim established in `DrizzleQuotationRepository.integration.test.ts`.

| # | Test description | DB state | Expected outcome |
|---|---|---|---|
| T-16 | No quotations linked to task → completes successfully | Task in DB; no quotations for task | Task `status = 'completed'` after use case |
| T-17 | All quotations `accepted` → completes successfully | Task + 2 `accepted` quotations linkd via `taskId` | Task `status = 'completed'` after use case |
| T-18 | One `draft` quotation → throws `TaskCompletionValidationError` | Task + 1 `draft` quotation linked via `taskId` | Throw; task `status` unchanged in DB |
| T-19 | One `sent` quotation → throws `TaskCompletionValidationError` | Task + 1 `sent` quotation linked via `taskId` | Throw; task `status` unchanged in DB |
| T-20 | Soft-deleted `draft` quotation is ignored → completes | Task + 1 `draft` quotation with `deletedAt` set | Task `status = 'completed'` after use case |

---

## 8. Component / UI Sketch

```
┌─ Task Details Page (TaskDetailsPage.tsx) ──────────────┐
│                                                         │
│  [Task title and metadata ...]                          │
│                                                         │
│  ┌─ Quotations section (TaskQuotationSection) ─────┐   │
│  │  QT-2026-001  [DRAFT]   Vendor: ABC Plumbing    │   │
│  │  QT-2026-002  [ACCEPTED] Vendor: XYZ Electrical │   │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
│  ══════════════════ Bottom action bar ══════════════    │
│  [ ✓ Mark as Completed ]  ← disabled + spinner         │
│                            during async operation       │
└─────────────────────────────────────────────────────────┘

On tap (success path):
  → task.status = 'completed' → navigate back

On tap (blocked path):
  → Alert ────────────────────────────────────────────────
  │ Cannot Mark as Complete                               │
  │                                                       │
  │ The following quotations are still unresolved:        │
  │                                                       │
  │ • QT-2026-001 (draft)                                │
  │                                                       │
  │ Please accept or decline each quotation before        │
  │ completing this task.                                 │
  │                                    [ OK ]             │
  └───────────────────────────────────────────────────────
```

### 8.1 Mobile-UI Considerations

- The `Pressable` must expose `testID="mark-as-complete-button"` for integration test targeting.
- While `completing === true`, render an `ActivityIndicator` inside the button and set `disabled={true}` with reduced opacity (`opacity-50` NativeWind class) to prevent double-taps.
- The `Alert` body text should be scrollable if there are many quotations; on iOS/Android `Alert` truncates at ~4 lines — consider a `Modal` fallback if more than 3 blocking quotations are detected. (Out of scope for this issue; flag as a follow-up.)
- Wording uses "accept or decline" (matching the `Quotation.status` vocabulary) rather than "approve or reject" to stay consistent with existing UI copy in `TaskQuotationSection`.

---

## 9. Open Questions

| # | Question | Owner | Resolution |
|---|---|---|---|
| OQ-1 | Should a task that is `cancelled` also be blocked if it has pending quotations, or only `completed`? | Product | Assume `completed` only for v1; `cancelled` path is not surfaced in TaskDetailsPage. | **Answer** the `cancelled` task should not be blocked and allow to be completed. All pending tasks should be changed to `rejected` when the task is cancelled.
| OQ-2 | Should the validator also check the per-task `quoteStatus` field (`tasks.quote_status = 'pending'`)? | Product | **No** — `quoteStatus` on the task is the old single-quote shorthand (Issue #141). This validator targets standalone `Quotation` records only. |
| OQ-3 | Should completing a task auto-decline any remaining `draft` quotations? | Product | **Yes** — Completing a task will automatically decline any remaining `draft` quotations. |
| OQ-4 | Is a `Modal` needed instead of `Alert` for > 3 blocking quotations? | UX | Flag as follow-up. Alert is sufficient for v1. | **Answer** alert is sufficient for v1;

---

## 10. Implementation Checklist (for `developer` agent)

- [ ] Create `src/application/errors/TaskCompletionErrors.ts`
- [ ] Create `src/application/usecases/task/TaskCompletionValidator.ts`
- [ ] Create `src/application/usecases/task/CompleteTaskUseCase.ts`
- [ ] Add `completeTask` to `UseTasksReturn` interface in `src/hooks/useTasks.ts`
- [ ] Wire `CompleteTaskUseCase` in `src/hooks/useTasks.ts`
- [ ] Wire "Mark as Completed" button in `src/pages/tasks/TaskDetailsPage.tsx`
- [ ] Write `__tests__/unit/TaskCompletionValidator.test.ts` (T-1 → T-9, red first)
- [ ] Write `__tests__/unit/CompleteTaskUseCase.test.ts` (T-10 → T-15, red first)
- [ ] Write `__tests__/integration/CompleteTaskUseCase.integration.test.ts` (T-16 → T-20)
- [ ] Run `npx tsc --noEmit` — zero errors
- [ ] Run `npm test` — all tests green

---

## 11. Files Reference (for both `mobile-ui` and `developer` agents)

| Path | Relevance |
|---|---|
| `src/domain/entities/Task.ts` | `Task` interface — `status`, `completedAt` fields |
| `src/domain/entities/Quotation.ts` | `Quotation` interface — `status`, `taskId`, `deletedAt`, `reference` |
| `src/domain/repositories/QuotationRepository.ts` | `findByTask(taskId)` already declared |
| `src/domain/repositories/TaskRepository.ts` | `findById`, `update` used by use case |
| `src/infrastructure/database/schema.ts` | `quotations.task_id` index; `tasks.status` enum |
| `src/infrastructure/repositories/DrizzleQuotationRepository.ts` | Concrete `findByTask` implementation |
| `src/infrastructure/repositories/DrizzleTaskRepository.ts` | Concrete `update` implementation |
| `src/hooks/useTasks.ts` | Hook to extend with `completeTask` |
| `src/pages/tasks/TaskDetailsPage.tsx` | Page to wire the button |
| `src/hooks/useConfirm.ts` | Existing `Alert`-based confirm helper (reference pattern) |
| `__tests__/integration/DrizzleQuotationRepository.integration.test.ts` | Reference for `better-sqlite3` shim setup |
| `__tests__/unit/CreateTaskUseCase.test.ts` | Reference for mock repo setup pattern |
