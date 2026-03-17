# Design: UI Invalidation Logic Review — Invoices, Payments, Documents & Images
**Issue**: [#152](https://github.com/yhua045/builder-assistant/issues/152)  
**Date**: 2026-03-17  
**Status**: Awaiting approval — do NOT implement until approved

---

## 1. Problem Summary

The app has partially migrated to TanStack Query. Only `usePayments` fully participates in the cache. All other data hooks (`useInvoices`, `useQuotations`, `useTasks`, `useContacts`, `useTaskDetail`) use local `useState`/`useEffect` patterns. This means:

- Cross-domain invalidations called today are **no-ops** (e.g., `invalidateQueries({ queryKey: ['invoices'] })` in `useAcceptQuote` never triggers a refetch because `useInvoices` doesn't use TanStack Query).
- After a mutation in one domain (e.g., task update, progress log change, invoice deletion), **related screens silently go stale**.

---

## 2. Current State Audit

### 2.1 Hook Inventory

| Hook | TanStack Query? | Notes |
|------|-----------------|-------|
| `usePayments` | ✅ `useQuery` + `useQueryClient` | Only hook with active cache |
| `useAcceptQuote` | ⚠️ `useQueryClient` side-effects only | Invalidates `['payments']` and `['invoices']` (second is a no-op) |
| `useTasks` | ❌ `useState`/`useEffect` | Imports `useQueryClient` but **never calls it** |
| `useInvoices` | ❌ `useState`/`useEffect` | Target of dead invalidation from `useAcceptQuote` |
| `useQuotations` | ❌ `useState` only | No refresh strategy |
| `useTaskDetail` | ❌ `useEffect` only | No invalidation possible |
| `useContacts` | ❌ `useState`/`useEffect` | No invalidation possible |
| `useTaskForm` | ❌ form state only | Calls `AcceptQuotationUseCase` directly, bypassing `useAcceptQuote` invalidations |

### 2.2 Known Bugs

| # | Bug | Impact |
|---|-----|--------|
| B1 | `invalidateQueries({ queryKey: ['invoices'] })` in `useAcceptQuote` is a no-op — `useInvoices` is not TanStack Query-backed | Invoice list never auto-refreshes after quote acceptance |
| B2 | `useTasks` holds a dead `useQueryClient` reference — `loadTasks()` re-fetches local state only | Payments screen goes stale after task mutations |
| B3 | `useTaskForm.submit()` calls `AcceptQuotationUseCase` directly — all invalidations in `useAcceptQuote` are skipped for task-form path | Same stale-payment issue via a different code path |
| B4 | No hooks for progress logs use TanStack Query — adding/removing progress log attachments never refreshes the Documents/Images tab | Documents/Images tab requires manual refresh |

---

## 3. Proposed Solution

### 3.1 Strategy

Rather than incrementally patching individual hooks, adopt a **two-phase approach**:

**Phase A — Introduce a central query key registry and migrate all data hooks to TanStack Query.**  
This is the prerequisite for all correct cross-domain invalidations.

**Phase B — Add explicit `invalidateQueries` calls at every mutation point once the caches exist.**

This document covers design for both phases, but the implementation milestone for this issue is Phase B only if Phase A already exists, or a combined Phase A+B if starting fresh.

---

### 3.2 Central Query Key Registry + Invalidation Map

Both the query key factories **and** the "what to invalidate per mutation" relationships live in a single file: `src/hooks/queryKeys.ts`.

The rationale: if you ever rename a key, add a new query to a domain, or rethink a dependency, there is exactly one file to update. Every hook that performs a mutation imports `invalidations.xxx(ctx)` from here rather than spelling out key arrays inline.

**`src/hooks/queryKeys.ts`:**

```ts
// ─── Key factories ────────────────────────────────────────────────────────────
// Rules:
//  • Always use these factories — never write raw string arrays in hook code.
//  • Prefix-only variants (no extra segment) act as "invalidate whole domain".

export const queryKeys = {
  // Payments
  payments: (mode: 'firefighter' | 'site_manager', param: string) =>
    ['payments', mode, param] as const,
  paymentsAll: () => ['payments'] as const,

  // Invoices
  invoices: (projectId?: string) =>
    projectId ? ['invoices', projectId] : (['invoices'] as const),

  // Quotations
  quotations: (taskId?: string) =>
    taskId ? ['quotations', taskId] : (['quotations'] as const),

  // Tasks
  tasks: (projectId?: string) =>
    projectId ? ['tasks', projectId] : (['tasks'] as const),
  taskDetail: (taskId: string) => ['taskDetail', taskId] as const,

  // Progress Logs
  progressLogs: (taskId: string) => ['progressLogs', taskId] as const,

  // Documents
  documents: (taskId: string) => ['documents', taskId] as const,

  // Contacts
  contacts: () => ['contacts'] as const,
};

// ─── Invalidation map ─────────────────────────────────────────────────────────
// Single source of truth for cross-domain side-effects.
//
// Reading guide: "when mutation X succeeds, call
//   queryClient.invalidateQueries for each key in invalidations.X(ctx)"
//
// Maintenance rule: if you add a new query key above, update every entry
// below that should cascade to it — the compiler will not catch omissions,
// so the comment block is the dependency graph.

type AcceptQuotationCtx = { projectId: string; taskId: string };
type RejectQuotationCtx = { projectId: string; taskId: string };
type InvoiceCtx         = { projectId: string; taskId?: string };
type PaymentCtx         = { projectId: string };
type ProgressLogCtx     = { taskId: string };
type DocumentCtx        = { taskId: string };
type TaskEditCtx        = { projectId: string; taskId: string; affectsPayments?: boolean };
type ContactCtx         = Record<string, never>;

export const invalidations = {
  /**
   * Accept quotation → creates Invoice, updates Task.quoteStatus.
   * Affects: payment totals, invoice list, task status badge, quote badge.
   */
  acceptQuotation: (ctx: AcceptQuotationCtx) => [
    queryKeys.paymentsAll(),
    queryKeys.invoices(ctx.projectId),
    queryKeys.tasks(ctx.projectId),
    queryKeys.taskDetail(ctx.taskId),
    queryKeys.quotations(ctx.taskId),
  ],

  /**
   * Reject quotation → updates Task.quoteStatus only.
   * Does NOT affect payments or invoices.
   */
  rejectQuotation: (ctx: RejectQuotationCtx) => [
    queryKeys.tasks(ctx.projectId),
    queryKeys.taskDetail(ctx.taskId),
    queryKeys.quotations(ctx.taskId),
  ],

  /**
   * Create / update / delete invoice.
   * Affects: payment totals, invoice list, task detail (linked invoice status).
   */
  invoiceMutated: (ctx: InvoiceCtx) => [
    queryKeys.paymentsAll(),
    queryKeys.invoices(ctx.projectId),
    ...(ctx.taskId ? [queryKeys.taskDetail(ctx.taskId)] : []),
  ],

  /**
   * Record payment or mark payment as paid.
   * Affects: payment list/amounts, invoice status (partially/fully paid).
   */
  paymentRecorded: (ctx: PaymentCtx) => [
    queryKeys.paymentsAll(),
    queryKeys.invoices(ctx.projectId),
  ],

  /**
   * Add / update / remove a progress log entry.
   * Affects: progress log list, task detail metadata.
   */
  progressLogMutated: (ctx: ProgressLogCtx) => [
    queryKeys.progressLogs(ctx.taskId),
    queryKeys.taskDetail(ctx.taskId),
  ],

  /**
   * Upload or remove a document/image attached to a progress log.
   * Affects: document list, progress log list (thumbnail/count), task detail.
   */
  documentMutated: (ctx: DocumentCtx) => [
    queryKeys.documents(ctx.taskId),
    queryKeys.progressLogs(ctx.taskId),
    queryKeys.taskDetail(ctx.taskId),
  ],

  /**
   * Edit task fields (status, trade type, assigned subcontractor, etc.).
   * Pass affectsPayments=true only if a payment-linked field changes
   * (e.g., subcontractor reassignment on a task with an active invoice).
   */
  taskEdited: (ctx: TaskEditCtx) => [
    queryKeys.tasks(ctx.projectId),
    queryKeys.taskDetail(ctx.taskId),
    ...(ctx.affectsPayments ? [queryKeys.paymentsAll()] : []),
  ],

  /**
   * Add or update a contact/subcontractor.
   * Affects: contact picker, invoice issuer display.
   */
  contactMutated: (_ctx: ContactCtx) => [
    queryKeys.contacts(),
    queryKeys.invoices(), // issuer name may appear on any invoice
  ],
};
```

**Usage in a hook:**
```ts
import { queryKeys, invalidations } from './queryKeys';

const queryClient = useQueryClient();
await acceptQuotationUseCase.execute(taskId);
await Promise.all(
  invalidations.acceptQuotation({ projectId, taskId })
    .map(key => queryClient.invalidateQueries({ queryKey: key }))
);
```

This pattern means that if, say, `taskDetail` is renamed or a new `cockpit` query should also be refreshed on quote acceptance, there is exactly one line to change in `queryKeys.ts`.

All hooks and mutation sites **must** import key factories and invalidation arrays from this file. No raw string-array literals in hook code.

---

### 3.3 Hooks to Migrate to TanStack Query

The following hooks must be migrated from `useState`/`useEffect` to `useQuery`:

| Hook | New Query Key(s) |
|------|-----------------|
| `useInvoices` | `queryKeys.invoices(projectId?)` |
| `useQuotations` | `queryKeys.quotations(taskId?)` |
| `useTasks` | `queryKeys.tasks(projectId?)` |
| `useTaskDetail` | `queryKeys.taskDetail(taskId)` |
| `useContacts` | `queryKeys.contacts()` |

Migration pattern (example for `useInvoices`):
```ts
// Before:
const [invoices, setInvoices] = useState<Invoice[]>([]);
useEffect(() => { listInvoicesUseCase.execute().then(setInvoices); }, []);

// After:
const { data: invoices = [] } = useQuery({
  queryKey: queryKeys.invoices(projectId),
  queryFn: () => listInvoicesUseCase.execute(projectId),
  staleTime: 30_000,
});
```

---

### 3.4 Invalidation Matrix

> These relationships are encoded directly in `invalidations` object in `queryKeys.ts` (§ 3.2). The table below is a human-readable view of that same data for review purposes.

| Mutation | `invalidations` entry | Keys invalidated |
|----------|----------------------|-----------------|
| Accept quotation | `acceptQuotation` | `payments`, `invoices[projectId]`, `tasks[projectId]`, `taskDetail[taskId]`, `quotations[taskId]` |
| Reject quotation | `rejectQuotation` | `tasks[projectId]`, `taskDetail[taskId]`, `quotations[taskId]` |
| Create/update/delete invoice | `invoiceMutated` | `payments`, `invoices[projectId]`, `taskDetail[taskId]` (if known) |
| Record payment / mark paid | `paymentRecorded` | `payments`, `invoices[projectId]` |
| Add/update/remove progress log | `progressLogMutated` | `progressLogs[taskId]`, `taskDetail[taskId]` |
| Upload/remove document or image | `documentMutated` | `documents[taskId]`, `progressLogs[taskId]`, `taskDetail[taskId]` |
| Edit task fields | `taskEdited` | `tasks[projectId]`, `taskDetail[taskId]`, `payments` (if payment-linked fields) |
| Add/update contact | `contactMutated` | `contacts`, `invoices` (issuer display on any invoice) |

**Hook assignment** (where each invalidation should live):

| `invalidations` entry | Hook responsible |
|-----------------------|-----------------|
| `acceptQuotation` | `useAcceptQuote.acceptQuote()` |
| `rejectQuotation` | `useAcceptQuote.rejectQuote()` |
| `invoiceMutated` | Invoice mutation hooks (wherever `CreateInvoiceUseCase`, `UpdateInvoiceUseCase`, `DeleteInvoiceUseCase` are called) |
| `paymentRecorded` | Payment mutation hooks (`RecordPaymentUseCase`, `MarkPaymentAsPaidUseCase`) |
| `progressLogMutated` | `useTasks.addProgressLog()`, `updateProgressLog()`, `deleteProgressLog()` |
| `documentMutated` | Wherever `AddTaskDocumentUseCase` / `RemoveTaskDocumentUseCase` are called |
| `taskEdited` | `useTasks.updateTask()` |
| `contactMutated` | Contact mutation hooks |

**Also fix**: `useTaskForm.submit()` for variation tasks must route through `useAcceptQuote` (or call `invalidations.acceptQuotation` directly) — currently bypasses all invalidations.

---

### 3.5 staleTime / refetchOnWindowFocus Recommendations

| Query | Recommended staleTime | refetchOnWindowFocus |
|-------|----------------------|---------------------|
| `payments` | 30 s | `true` (financial data should stay fresh) |
| `invoices` | 60 s | `true` |
| `quotations` | 60 s | `false` |
| `tasks` | 30 s | `true` |
| `taskDetail` | 30 s | `true` |
| `progressLogs` | 60 s | `false` |
| `documents` | 120 s | `false` |
| `contacts` | 5 min | `false` (changes rarely on mobile) |

---

### 3.6 Invalidation Implementation Pattern

Always use the `invalidations` map from `queryKeys.ts` — never write key arrays inline inside a hook. Use `Promise.all` to fire all invalidations concurrently:

```ts
import { invalidations } from '../hooks/queryKeys';

// Example: accept quotation
const queryClient = useQueryClient();
await acceptQuotationUseCase.execute(taskId);
await Promise.all(
  invalidations.acceptQuotation({ projectId, taskId })
    .map(key => queryClient.invalidateQueries({ queryKey: key }))
);
```

If you later need to also refresh the cockpit or blocker bar when a quotation is accepted, you update **only `invalidations.acceptQuotation` in `queryKeys.ts`** — every hook that calls it picks up the change automatically.

Prefer adding invalidation logic in the **lowest-level dedicated hook** (e.g., `useAcceptQuote`, not in the component), so that any consumer of the hook benefits automatically.

---

## 4. Affected Screens Checklist

The following screens **must respond** (auto-refresh without manual navigation) after the listed operations:

| Operation | Affected Screens |
|-----------|-----------------|
| Accept quotation | Payments, Invoice list, Invoice detail, Task detail (quote status badge), Task list |
| Reject quotation | Task detail (quote status badge), Task list |
| Upload document/image to progress log | Task detail → Documents tab, Task detail → Images tab |
| Add/remove progress log | Task detail → Progress tab, Task detail metadata |
| Record payment / mark paid | Payments, Invoice detail (payment status) |
| Create / update / delete invoice | Payments, Invoice list, Invoice detail, Task detail |
| Edit task fields | Task list, Task detail, Cockpit (blocker/delay counts) |
| Add / update contact | Invoice detail (issuer name), Subcontractor picker |

---

## 5. Test Plan

### 5.1 Unit Tests — `__tests__/unit/hooks/`

For each mutating hook, assert that after calling the mutation method, `queryClient.invalidateQueries` is called with the exact expected keys.

**Test pattern** (mock `useQueryClient`):
```ts
const invalidateMock = jest.fn();
jest.spyOn(require('@tanstack/react-query'), 'useQueryClient')
  .mockReturnValue({ invalidateQueries: invalidateMock });

const { result } = renderHook(() => useAcceptQuote(...));
await act(() => result.current.acceptQuote('task-1'));

expect(invalidateMock).toHaveBeenCalledWith({ queryKey: ['payments'] });
expect(invalidateMock).toHaveBeenCalledWith({ queryKey: ['invoices'] });
expect(invalidateMock).toHaveBeenCalledWith({ queryKey: ['invoices', 'project-1'] });
expect(invalidateMock).toHaveBeenCalledWith({ queryKey: ['taskDetail', 'task-1'] });
```

Test cases required:
- [ ] `useAcceptQuote.acceptQuote` — invalidates payments, invoices, taskDetail, tasks, quotations
- [ ] `useAcceptQuote.rejectQuote` — invalidates taskDetail, tasks, quotations (NOT payments)
- [ ] `useTasks.addProgressLog` — invalidates progressLogs, taskDetail
- [ ] `useTasks.updateProgressLog` — invalidates progressLogs, taskDetail
- [ ] `useTasks.deleteProgressLog` — invalidates progressLogs, taskDetail
- [ ] `useTasks.updateTask` — invalidates tasks, taskDetail
- [ ] Document upload mutation — invalidates documents, progressLogs, taskDetail
- [ ] Payment record mutation — invalidates payments, invoices
- [ ] Invoice create/update/delete — invalidates payments, invoices

### 5.2 Integration Tests — `__tests__/integration/`

Using in-memory Drizzle DB:
1. **Accept quotation → invoice list refreshes**: Call `AcceptQuotationUseCase`, then assert `useInvoices` returns the new invoice on next render (requires `useInvoices` to be TanStack Query-backed).
2. **Add progress log attachment → documents tab refreshes**: Add document via use case, assert `useQuery(['documents', taskId])` returns the added document without manual re-navigation.
3. **Mark payment as paid → payments screen refreshes**: Call `MarkPaymentAsPaidUseCase`, assert `usePayments` reflects updated status.

### 5.3 Regression Tests

- Ensure existing passing tests for `usePayments` and `useAcceptQuote` remain green.
- Ensure no double-fetch occurs (verify the query is not re-fetched more than once per mutation).

---

## 6. Implementation Sequence

> Implementation order matters — each step depends on the previous.

1. **Create `src/hooks/queryKeys.ts`** — central key factory (no behavior change, safe to do first).
2. **Migrate `useInvoices` to TanStack Query** — fixes the dead `['invoices']` invalidation.
3. **Migrate `useTasks` / `useTaskDetail` to TanStack Query** — enables task-level invalidations.
4. **Migrate `useQuotations` to TanStack Query** — enables quote-status invalidations.
5. **Migrate `useContacts` to TanStack Query** — enables contact invalidations.
6. **Fix `useAcceptQuote`** — add missing invalidation keys; clean up the dead `['invoices']` → real invalidation now works.
7. **Fix `useTaskForm`** — route through `useAcceptQuote` (or call same invalidations) for variation-task accept path.
8. **Add invalidations to `useTasks` mutations** — progress log, task update paths.
9. **Add invalidations to document upload path** — wherever `AddTaskDocumentUseCase` is called.
10. **Add invalidations to invoice/payment mutation hooks** — wherever remaining use cases are invoked from hooks.
11. **Write unit tests** (per § 5.1) for each newly-invalidating mutation.
12. **Write integration tests** (per § 5.2) for the three critical cross-domain scenarios.

---

## 7. Out of Scope

- Migrating `useSnapReceipt`, `useVoiceTask`, `useCameraTask`, `useBlockerBar`, `useCockpitData` to TanStack Query (these are purely imperative/UI-state hooks with no server cache to invalidate).
- Optimistic updates — this issue targets correctness (stale-data bugs), not UX speed improvements.
- Real-time / websocket push updates.

---

## 8. Open Questions

1. **Should we use `invalidateQueries` or `refetchQueries`?** — `invalidateQueries` is preferred (marks stale, refetches only if the query is currently mounted). Use `refetchQueries` only if we need an immediate background prefetch regardless of mount state.
2. **`useTaskForm` variation-task path**: Should it delegate to `useAcceptQuote` hook (preferred for consistency) or call invalidations inline? If `useTaskForm` is used in many places, delegating keeps the fix in one place.
3. **Should contacts invalidation propagate to invoices?** The invoice issuer display is derived from contacts data. This may require either: (a) the invoice query to join contacts on fetch, or (b) a separate `contacts` invalidation that triggers invoice re-fetch. Option (a) (join in use case) is cleaner.
4. **staleTime for `taskDetail`**: Should it be 0 (always fresh) given that it's a single-item detail screen? Need to agree on UX tolerance for briefly stale data while navigating back.
