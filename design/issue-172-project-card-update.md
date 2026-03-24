# Issue #172 — Project Card Updates After Task Detail Changes

**Date**: 2026-03-24  
**Branch**: `feature/issue-172-blocker`  
**Status**: Design phase

---

## User Story

As a builder,  
When I add an invoice or record a payment on a task,  
I want the Project Card on the dashboard to immediately reflect the updated pending payment amount,  
So I never see stale financial totals when navigating back to the project list.

---

## Problem Statement

The `ProjectOverviewCard` (dashboard) renders `overview.totalPendingPayment` from the `projectsOverview` React-Query cache (`queryKeys.projectsOverview()`). Several mutation paths that affect payment totals do **not** include `queryKeys.projectsOverview()` in their invalidation sets, resulting in stale totals until a full refetch.

---

## Root Cause Analysis

### Data Flow
```
Task mutation (invoice / payment / status change)
        ↓
  invalidations.xxx(ctx)  ← returns array of query keys to bust
        ↓
  queryClient.invalidateQueries(key) × N
        ↓
  useProjectsOverview() refetches → ProjectOverviewCard re-renders
```

### Gaps Found (what's missing from the invalidation registry)

| Invalidation event | Currently missing key | Impact |
|---|---|---|
| `invoiceMutated` | `queryKeys.projectsOverview()` | New invoice / invoice update / delete doesn't refresh the pending payment badge |
| `paymentRecorded` | `queryKeys.projectsOverview()` | Payment creation or mark-as-paid doesn't refresh the pending payment badge |
| `TaskDetailsPage.handleStatusChange` | No invalidation called at all | Task status change from the quick-edit UI doesn't propagate to project overview |
| `TaskDetailsPage.handlePriorityChange` | No invalidation called at all | Task priority change from the quick-edit UI doesn't propagate to project overview |

### What Is Already Correct (no change needed)
- `taskEdited` ✓ — includes `projectsOverview`; used by `useTaskForm.submit()` and `useTaskTimeline`
- `acceptQuotation` / `rejectQuotation` ✓ — include `projectsOverview`
- `tasksCreated` / `projectCreated` ✓ — include `projectsOverview`

---

## Acceptance Criteria

- [ ] When a new invoice is issued (create/update/delete) on a task, the Project Card's pending payment badge updates after the mutation completes.
- [ ] When a payment is recorded or marked as paid, the pending payment badge updates.
- [ ] When task status or priority is changed from `TaskDetailsPage`, the project overview (including `overallStatus` and progress) refreshes.
- [ ] Unit tests confirm `invoiceMutated`, `paymentRecorded`, and `taskEdited` all return `queryKeys.projectsOverview()`.
- [ ] Integration test: task edit (status change + invoice creation) → navigate back → Project Card shows correct `totalPendingPayment`.

---

## Component / File Map

```
src/hooks/queryKeys.ts                    ← invalidation registry (primary change)
src/pages/tasks/TaskDetailsPage.tsx       ← handleStatusChange / handlePriorityChange
__tests__/unit/queryKeys.invalidations.test.ts   ← NEW unit test
__tests__/integration/ProjectCardPendingPaymentUpdate.integration.test.tsx  ← NEW integration test
```

---

## Contracts / Interfaces (no changes needed)

The `InvoiceCtx` and `PaymentCtx` types in `queryKeys.ts` already provide `projectId`; no new fields are required. The `TaskEditCtx` type already exists and is sufficient.

---

## Detailed Change Descriptions

### Change 1 — `queryKeys.ts`: Add `projectsOverview` to `invoiceMutated`

```ts
// Before
invoiceMutated: (ctx: InvoiceCtx) => [
  queryKeys.paymentsAll(),
  queryKeys.invoices(ctx.projectId),
  ...(ctx.taskId ? [queryKeys.taskDetail(ctx.taskId)] : []),
],

// After
invoiceMutated: (ctx: InvoiceCtx) => [
  queryKeys.projectsOverview(),          // ← ADD
  queryKeys.paymentsAll(),
  queryKeys.invoices(ctx.projectId),
  ...(ctx.taskId ? [queryKeys.taskDetail(ctx.taskId)] : []),
],
```

**Why**: Every invoice mutation (create, update, delete, cancel, mark-as-paid) may change whether a Payment record exists with `status: 'pending'`, which drives `totalPendingPayment`.

### Change 2 — `queryKeys.ts`: Add `projectsOverview` to `paymentRecorded`

```ts
// Before
paymentRecorded: (ctx: PaymentCtx) => [
  queryKeys.paymentsAll(),
  queryKeys.invoices(ctx.projectId),
  ...(ctx.projectId ? [queryKeys.projectPayments(ctx.projectId)] : []),
],

// After
paymentRecorded: (ctx: PaymentCtx) => [
  queryKeys.projectsOverview(),          // ← ADD
  queryKeys.paymentsAll(),
  queryKeys.invoices(ctx.projectId),
  ...(ctx.projectId ? [queryKeys.projectPayments(ctx.projectId)] : []),
],
```

**Why**: Recording a payment or marking it as paid changes `Payment.status` from `pending` → `paid`, directly affecting `totalPendingPayment`.

### Change 3 — `TaskDetailsPage.tsx`: Call `taskEdited` invalidations after status/priority updates

`handleStatusChange` and `handlePriorityChange` currently call `updateTask()` with no cache invalidation. Add `invalidations.taskEdited(...)` after success:

```ts
// handleStatusChange (and symmetrically handlePriorityChange)
const updated: Task = { ...task, status };
setTask(updated);
try {
  await updateTask(updated);
  await Promise.all(
    invalidations.taskEdited({ projectId: task.projectId ?? '', taskId: task.id })
      .map(key => queryClient.invalidateQueries({ queryKey: key }))
  );
} catch {
  setTask(task); // revert on failure
}
```

**Why**: Status changes affect `overallStatus`, `progressPercent`, and `blockedTasks` on the `ProjectOverviewCard`. Without invalidation, the card shows stale data until forced refresh.

---

## Test Acceptance Criteria

### Unit Tests — `__tests__/unit/queryKeys.invalidations.test.ts`

1. `invalidations.taskEdited({ projectId: 'p1', taskId: 't1' })` includes `queryKeys.projectsOverview()`
2. `invalidations.invoiceMutated({ projectId: 'p1' })` includes `queryKeys.projectsOverview()`
3. `invalidations.paymentRecorded({ projectId: 'p1' })` includes `queryKeys.projectsOverview()`
4. `invalidations.invoiceMutated({ taskId: 't1' })` (no projectId) includes `queryKeys.projectsOverview()`
5. `invalidations.paymentRecorded({})` (no projectId) includes `queryKeys.projectsOverview()`

### Integration Test — `__tests__/integration/ProjectCardPendingPaymentUpdate.integration.test.tsx`

Setup:
- In-memory SQLite / mock repositories
- Pre-existing project + task  
- React Query `QueryClient` with `gcTime: 0` to prevent stale reads

Scenarios:
1. **Invoice created → project card refreshes**  
   `useInvoices.createInvoice(...)` → assert `queryKeys.projectsOverview()` was invalidated
2. **Payment recorded → project card refreshes**  
   `paymentRecorded` invalidation keys include `projectsOverview`  
3. **Status change → project card refreshes**  
   `handleStatusChange('completed')` in TaskDetailsPage → assert `projectsOverview` is invalidated

---

## Migration Notes

No schema changes. No new domain entities. No new use cases. Changes are confined to:
- Cache invalidation registry (`queryKeys.ts` — 2 new lines)
- One page component (`TaskDetailsPage.tsx` — 2 handlers gain `invalidateQueries` calls)
- New test files

---

## Trade-offs

| Option | Pros | Cons | Decision |
|---|---|---|---|
| Add `projectsOverview` to invalidation map entries | Minimal change, fully consistent with existing pattern | Extra refetch on each mutation | ✅ Chosen |
| Optimistic cache update of `projectsOverview` | Zero latency, no refetch | Complex, error-prone with concurrent mutations | ❌ Deferred |
| Navigation-based refetch (refetch on focus) | Simple | Already present via `navigation.addListener('focus', loadData)` but only refreshes local `loadData`, not the shared React Query cache | ❌ Insufficient alone |

---

## Open Questions

- None currently. All decisions are clear from codebase analysis.
