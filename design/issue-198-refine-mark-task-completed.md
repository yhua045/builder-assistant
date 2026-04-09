# Design: Issue #198 — Refine "Mark Task Completed"

**Status**: DRAFT — awaiting "LGTB" approval  
**Author**: Copilot (Architect)  
**Date**: 2026-04-09  
**GitHub Issue**: issue-198-refine-mark-task-completed  
**Branch**: `issue-198-refine-mark-task-completed`

---

## 1. User Stories

| # | Story |
|---|---|
| US-1 | As a Builder, when I tap "Mark as Completed" on a task, I want the app to detect any unpaid payments linked to accepted quotations for that task and prompt me to settle them first. |
| US-2 | As a Builder, when unpaid payments are found, I want to choose: "Mark as Paid & Complete" (marks all pending payments as paid, then completes the task) or "Cancel" (leaves task and payments unchanged). |

---

## 2. Acceptance Criteria

### Feature 1 — Payment Validation on Task Completion

| # | Criterion |
|---|---|
| AC-1 | `TaskPaymentValidator.validate(task)` returns `{ ok: true, pendingPayments: [] }` when `task.quoteInvoiceId` is not set (no linked invoice). |
| AC-2 | `TaskPaymentValidator.validate(task)` returns `{ ok: true, pendingPayments: [] }` when the linked invoice has no payments with `status: 'pending'`. |
| AC-3 | `TaskPaymentValidator.validate(task)` returns `{ ok: false, pendingPayments: [...] }` when the linked invoice has one or more payments with `status: 'pending'`. |
| AC-4 | `CompleteTaskUseCase.execute(taskId)` throws `PendingPaymentsForTaskError` (containing the pending payment records) when the task has unsettled payments. This check occurs **after** the existing quotation validation. |
| AC-5 | `CompleteTaskAndSettlePaymentsUseCase.execute(taskId)` settles all pending payments via `MarkPaymentAsPaidUseCase`, then calls `CompleteTaskUseCase` to mark the task completed. |
| AC-6 | The UI `handleComplete` in `TaskDetailsPage` catches `PendingPaymentsForTaskError` and presents a 2-button `Alert`: "Mark as Paid & Complete" and "Cancel". |
| AC-7 | Pressing "Mark as Paid & Complete" calls `completeTaskAndSettlePayments(taskId)`, which resolves with the task navigating back on success. |
| AC-8 | Pressing "Cancel" dismisses the dialog; task and payments remain unchanged. |
| AC-9 | Unit tests cover all `TaskPaymentValidator` branches (no invoice / all settled / one+ pending). |
| AC-10 | Unit tests cover `CompleteTaskUseCase` for: no payments (no throw), pending payments (throws `PendingPaymentsForTaskError`). |
| AC-11 | Unit tests cover `CompleteTaskAndSettlePaymentsUseCase`: settles payments and completes the task. |
| AC-12 | Integration test: full flow — pending payment on accepted-quotation invoice → `CompleteTaskAndSettlePaymentsUseCase` → task completed and payment settled in SQLite. |
| AC-13 | TypeScript strict mode passes with zero new errors (`npx tsc --noEmit`). |

---

## 3. Domain Analysis

### 3.1 Payment-to-Task Linkage Chain

```
Task.quoteInvoiceId  (set by AcceptQuotationUseCase on quotation acceptance)
        │
        ▼
Invoice.id  ←──  Payment.invoiceId  (Payment.status: 'pending' | 'settled' | ...)
```

- `task.quoteInvoiceId` is the **canonical** link from a task to its accepted-quotation invoice.
- `PaymentRepository.findByInvoice(invoiceId)` already exists — we filter by `status === 'pending'`.
- No schema change required.

> **Limitation (known)**: `task.quoteInvoiceId` stores only the most recently accepted quotation's invoice. This is an existing architectural constraint and is sufficient for the MVP.

### 3.2 Error Taxonomy Extension

```
TaskCompletionErrors.ts (existing + new)
├── TaskNotFoundError               ← existing
├── TaskCompletionValidationError   ← existing (pending quotations)
└── PendingPaymentsForTaskError     ← NEW (pending payments on quoteInvoice)
```

---

## 4. Architecture

### 4.1 Layer Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│  UI Layer                                                         │
│  TaskDetailsPage.tsx — catches PendingPaymentsForTaskError       │
├──────────────────────────────────────────────────────────────────┤
│  Hooks Layer                                                      │
│  useTasks — completeTask / completeTaskAndSettlePayments         │
├──────────────────────────────────────────────────────────────────┤
│  Application Layer                                               │
│  CompleteTaskUseCase (extends: + payment check)                  │
│  CompleteTaskAndSettlePaymentsUseCase (NEW)                      │
│  TaskPaymentValidator (NEW)                                      │
├──────────────────────────────────────────────────────────────────┤
│  Domain Layer                                                    │
│  PendingPaymentsForTaskError (NEW — application/errors/)         │
├──────────────────────────────────────────────────────────────────┤
│  Infrastructure Layer                                            │
│  PaymentRepository.findByInvoice ← unchanged, already exists    │
└──────────────────────────────────────────────────────────────────┘
```

### 4.2 Feature 1 — New/Modified Files

| File | Change |
|------|--------|
| `src/application/errors/TaskCompletionErrors.ts` | Add `PendingPaymentsForTaskError` |
| `src/application/usecases/task/TaskPaymentValidator.ts` | **NEW** — validates pending payments |
| `src/application/usecases/task/CompleteTaskUseCase.ts` | Inject optional `PaymentRepository`; compose `TaskPaymentValidator`; throw `PendingPaymentsForTaskError` |
| `src/application/usecases/task/CompleteTaskAndSettlePaymentsUseCase.ts` | **NEW** — orchestrates settle-then-complete |
| `src/hooks/useTasks.ts` | Add `completeTaskAndSettlePayments(taskId)` to the return type and hook body |
| `src/pages/tasks/TaskDetailsPage.tsx` | Extend `handleComplete` to handle `PendingPaymentsForTaskError` with two-button dialog |


---

## 5. Detailed Contracts

### 5.1 `PendingPaymentsForTaskError`

```ts
// src/application/errors/TaskCompletionErrors.ts (addition)
export class PendingPaymentsForTaskError extends Error {
  readonly code = 'PENDING_PAYMENTS_FOR_TASK' as const;
  readonly pendingPayments: Pick<Payment, 'id' | 'amount' | 'contractorName' | 'dueDate'>[];

  constructor(payments: Pick<Payment, 'id' | 'amount' | 'contractorName' | 'dueDate'>[]) {
    super(`Cannot complete task: ${payments.length} unpaid payment(s) on linked invoice`);
    this.name = 'PendingPaymentsForTaskError';
    this.pendingPayments = payments;
  }
}
```

### 5.2 `TaskPaymentValidator`

```ts
// src/application/usecases/task/TaskPaymentValidator.ts
export interface PaymentValidationResult {
  ok: boolean;
  pendingPayments: Pick<Payment, 'id' | 'amount' | 'contractorName' | 'dueDate'>[];
}

export class TaskPaymentValidator {
  constructor(private readonly paymentRepo: PaymentRepository) {}

  async validate(task: Task): Promise<PaymentValidationResult> {
    if (!task.quoteInvoiceId) {
      return { ok: true, pendingPayments: [] };
    }
    const payments = await this.paymentRepo.findByInvoice(task.quoteInvoiceId);
    const pending = payments
      .filter(p => p.status === 'pending')
      .map(({ id, amount, contractorName, dueDate }) => ({ id, amount, contractorName, dueDate }));
    return { ok: pending.length === 0, pendingPayments: pending };
  }
}
```

### 5.3 `CompleteTaskUseCase` — Updated Constructor

```ts
constructor(
  private readonly taskRepository: TaskRepository,
  quotationRepository: QuotationRepository,
  paymentRepository?: PaymentRepository,   // optional for backward compat with existing tests
) {
  this.validator = new TaskCompletionValidator(quotationRepository);
  this.paymentValidator = paymentRepository
    ? new TaskPaymentValidator(paymentRepository)
    : null;
}
```

Updated `execute()`:
```ts
async execute(taskId: string): Promise<void> {
  const task = await this.taskRepository.findById(taskId);
  if (!task) throw new TaskNotFoundError(taskId);
  if (task.status === 'completed') return;

  // 1. Quotation check (existing)
  const quotationResult = await this.validator.validate(taskId);
  if (!quotationResult.ok) throw new TaskCompletionValidationError(quotationResult.pendingQuotations);

  // 2. Payment check (new)
  if (this.paymentValidator) {
    const paymentResult = await this.paymentValidator.validate(task);
    if (!paymentResult.ok) throw new PendingPaymentsForTaskError(paymentResult.pendingPayments);
  }

  const now = new Date().toISOString();
  await this.taskRepository.update({ ...task, status: 'completed', completedAt: now, updatedAt: now });
}
```

### 5.4 `CompleteTaskAndSettlePaymentsUseCase`

```ts
// src/application/usecases/task/CompleteTaskAndSettlePaymentsUseCase.ts
export class CompleteTaskAndSettlePaymentsUseCase {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly paymentRepository: PaymentRepository,
    private readonly invoiceRepository: InvoiceRepository,
    private readonly quotationRepository: QuotationRepository,
  ) {}

  async execute(taskId: string): Promise<void> {
    const task = await this.taskRepository.findById(taskId);
    if (!task) throw new TaskNotFoundError(taskId);

    // Settle all pending payments linked to the task's quote invoice
    if (task.quoteInvoiceId) {
      const payments = await this.paymentRepository.findByInvoice(task.quoteInvoiceId);
      const markPaid = new MarkPaymentAsPaidUseCase(this.paymentRepository, this.invoiceRepository);
      for (const p of payments.filter(p => p.status === 'pending')) {
        await markPaid.execute({ paymentId: p.id });
      }
    }

    // Complete task (payment check now passes since payments are settled)
    const completeTask = new CompleteTaskUseCase(
      this.taskRepository,
      this.quotationRepository,
      this.paymentRepository,
    );
    await completeTask.execute(taskId);
  }
}
```

---

## 6. UI Design

### 6.1 Feature 1 — Task Completion Dialog (Pending Payments)

**Trigger**: `handleComplete` in `TaskDetailsPage` catches `PendingPaymentsForTaskError`.

**Dialog design** (React Native `Alert.alert`):

```
┌─────────────────────────────────────────────┐
│ Unpaid Payment Detected                     │
├─────────────────────────────────────────────┤
│ This task has an unpaid payment:            │
│                                             │
│ • $X,XXX — [Contractor Name]               │
│   Due: [Due Date]                           │
│                                             │
│ Mark the payment as paid and complete       │
│ this task?                                  │
├─────────────────────────────────────────────┤
│  [ Cancel ]      [ Mark as Paid & Complete ]│
└─────────────────────────────────────────────┘
```

- "Cancel" → dismisses; task stays in current state.
- "Mark as Paid & Complete" → calls `completeTaskAndSettlePayments(taskId)` → on success, `navigation.goBack()`.
- Uses existing `useConfirm` pattern where possible, but needs two custom button labels — use direct `Alert.alert` with two buttons.

*Collaborating with **mobile-ui** agent on exact button style, color, and accessibility requirements.*

---

## 7. Test Plan

### 7.1 Unit Tests (new files in `__tests__/unit/`)

| Test file | Covers |
|-----------|--------|
| `TaskPaymentValidator.test.ts` | AC-1, AC-2, AC-3 |
| `CompleteTaskUseCase.payment.test.ts` | AC-4 (extends existing `CompleteTaskUseCase.test.ts`) |
| `CompleteTaskAndSettlePaymentsUseCase.test.ts` | AC-5, AC-11 |

### 7.2 Integration Tests (new files in `__tests__/integration/`)

| Test file | Covers |
|-----------|--------|
| `CompleteTaskWithPendingPayments.integration.test.ts` | AC-12 — full flow: accepted quotation → pending payment → settle → complete, all against `better-sqlite3 :memory:` |

---

## 8. Migration & Schema

No database schema changes are required.

All data is already accessible via:
- `Task.quoteInvoiceId` (existing column)
- `Payment.invoiceId` (existing column)
- `ProgressLog.taskId` / `ProgressLog.createdAt` (existing columns)

---

## 9. Dependency Injection

The following container registrations need to be checked/confirmed in `src/infrastructure/di/registerServices.ts`:

- `'PaymentRepository'` — already registered ✅
- `'InvoiceRepository'` — already registered ✅
- `'TaskRepository'` — already registered ✅
- `'QuotationRepository'` — already registered ✅

The `CompleteTaskAndSettlePaymentsUseCase` is instantiated inline in `useTasks` hook (same as `CompleteTaskUseCase`) — no new DI token needed.

---

## 10. Risks & Constraints

| Risk | Mitigation |
|------|-----------|
| `task.quoteInvoiceId` only tracks the last accepted quotation's invoice | Documented as known limitation; sufficient for MVP |
| Making `paymentRepository` optional in `CompleteTaskUseCase` constructor | Backward-compatible; existing tests unaffected; validated via TypeScript strict mode |

---

## 11. Open Questions for `mobile-ui` Agent

1. Should the "Unpaid Payments" dialog use native `Alert.alert` (two buttons) or a custom bottom sheet modal for richer content (e.g., payment amount and contractor name prominently displayed)?

---

## 12. Handoff to Developer

Once this plan is approved ("LGTB"), the developer agent should:

1. Write **failing tests** first for all acceptance criteria above (AC-1 through AC-13) — TDD red phase.
2. Implement `TaskPaymentValidator`, extend `CompleteTaskUseCase`, and add `CompleteTaskAndSettlePaymentsUseCase` — TDD green phase.
3. Update `TaskDetailsPage.handleComplete` to handle `PendingPaymentsForTaskError` with the two-button dialog.
4. Run `npx tsc --noEmit` and `npm test` to verify zero regressions.
