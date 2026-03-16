# Design: TanStack Query — Cross-Screen State Invalidation

**Status:** Approved — implementation in progress  
**Motivation:** Each hook (`usePayments`, `useTasks`, …) holds its own isolated `useState` copy of SQLite data. There is no invalidation bus between screens, so a mutation in one screen (e.g. accepting a quote on a task) is invisible to another screen (e.g. the Payments list) until the user manually navigates away and back.

---

## Problem Statement

### Concrete scenario (the trigger for this design)

1. User opens `TaskDetailsPage` for a `contract_work` task
2. User taps "Accept Quote" → `AcceptQuoteUseCase.execute(taskId)` runs
   - Creates a new `Invoice` (status `issued`, paymentStatus `unpaid`)
   - Updates `task.quoteStatus = 'accepted'`, `task.quoteInvoiceId = invoice.id`
3. User navigates to the Payments tab
4. `usePayments` was mounted when the tab was first visited — its `useState` snapshot does **not** include the new invoice
5. The newly-payable invoice is invisible until the user pulls-to-refresh

### Root cause

Each hook uses an independent `useState + useEffect + loadAll` pattern:

```ts
// usePayments — simplified current shape
const [globalPayments, setGlobalPayments] = useState([]);

const loadAll = useCallback(async () => {
  const result = await listGlobalUc.execute({ contractorSearch });
  setGlobalPayments(result);
}, [...deps]);

useEffect(() => { loadAll(); }, [loadAll]);
```

`useTasks` and `usePayments` both read from SQLite but have no shared subscription mechanism. A write in one hook's callbacks is invisible to the other's `useState`.

---

## Proposed Solution: TanStack Query (`@tanstack/react-query`)

TanStack Query replaces `useState + useEffect + loadAll` for all **server state** (data fetched from SQLite). It introduces a shared `QueryClient` — a cache keyed by query keys — so that calling `queryClient.invalidateQueries({ queryKey: ['invoices'] })` after any mutation causes every component subscribed to that key to automatically refetch.

### What does NOT change

- **All domain entities** (`Task`, `Invoice`, `Payment`, …)
- **All use cases** (`AcceptQuoteUseCase`, `ListGlobalPaymentsUseCase`, …) — `queryFn` just calls `useCase.execute()`
- **All repository interfaces and implementations** (`DrizzleTaskRepository`, etc.)
- **DI container wiring** (`registerServices.ts`, tsyringe singletons)
- **All UI components and pages** — they continue receiving the same data shapes and callback functions from hooks; the hook's public API is unchanged

### What changes

- Hooks replace `useState + useEffect` fetch loops with `useQuery`
- Hooks replace `async callback + loadTasks()` mutation calls with `useMutation + onSuccess invalidation`
- `App.tsx` gains a `QueryClientProvider` wrapper

---

## Query Key Taxonomy

Keys follow the pattern `[domain, ...scope]`. Scope is omitted for global queries.

| Key | Scope | Hook(s) that read it |
|---|---|---|
| `['tasks', projectId]` | per project | `useTasks(projectId)` |
| `['tasks']` | all tasks (ad-hoc) | `useTasks()` |
| `['taskDetail', taskId]` | per task | `useTaskDetail` |
| `['invoices']` | global | `useInvoices`, `usePayments` |
| `['invoices', projectId]` | per project | `useInvoices(projectId)` |
| `['payments']` | global | `usePayments` (firefighter mode) |
| `['payments', projectId]` | per project | `usePayments` (site_manager mode) |
| `['projects']` | global | `useProjects`, `useDashboard` |
| `['cockpit', projectId]` | per project | `useCockpitData` |
| `['blockerBar']` | global | `useBlockerBar` |

---

## Cross-Hook Invalidation Map

This is the core of the design. Each mutation lists which query keys it must invalidate.

### `useTasks` mutations → invalidation

| Mutation | Invalidates |
|---|---|
| `createTask` | `['tasks', projectId]`, `['cockpit', projectId]` |
| `updateTask` | `['tasks', projectId]`, `['taskDetail', taskId]`, `['cockpit', projectId]` |
| `deleteTask` | `['tasks', projectId]`, `['taskDetail', taskId]`, `['cockpit', projectId]` |
| **`acceptQuote`** (AcceptQuoteUseCase) | `['tasks', projectId]`, `['taskDetail', taskId]`, `['invoices']`, `['invoices', projectId]`, `['payments']`, `['payments', projectId]` |
| `addDelayReason` / `resolveDelayReason` | `['taskDetail', taskId]`, `['cockpit', projectId]`, `['blockerBar']` |
| `addProgressLog` / `updateProgressLog` / `deleteProgressLog` | `['taskDetail', taskId]` |
| `addDependency` / `removeDependency` | `['taskDetail', taskId]`, `['cockpit', projectId]` |

### `usePayments` mutations → invalidation

| Mutation | Invalidates |
|---|---|
| `markAsPaid` (MarkPaymentAsPaidUseCase) | `['payments']`, `['payments', projectId]`, `['invoices']`, `['invoices', projectId]`, `['projects']` |
| `recordPayment` (RecordPaymentUseCase) | `['payments']`, `['payments', projectId]`, `['invoices']` |

### `useInvoices` mutations → invalidation

| Mutation | Invalidates |
|---|---|
| `createInvoice` | `['invoices']`, `['invoices', projectId]`, `['payments']` |
| `markInvoiceAsPaid` | `['invoices']`, `['payments']`, `['projects']` |
| `cancelInvoice` | `['invoices']`, `['payments']` |

---

## Migration Plan for `usePayments` (First Candidate)

`usePayments` is the highest-value target because it is the consumer most affected by cross-domain mutations (task quote acceptance, invoice creation, payment settlement all affect it).

### Step 1 — App.tsx: add `QueryClientProvider`

```tsx
// App.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,    // Never auto-refetch — only explicit invalidateQueries() triggers refetches
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      gcTime: 5 * 60_000,     // 5 min cache retention
      retry: 1,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* existing NavigationContainer etc. */}
    </QueryClientProvider>
  );
}
```

### Step 2 — `usePayments`: replace `useState + useEffect` with `useQuery`

Current shape (simplified):
```ts
const [globalPayments, setGlobalPayments] = useState([]);
const [loading, setLoading] = useState(false);

const loadAll = useCallback(async () => {
  setLoading(true);
  try {
    const result = await listGlobalUc.execute({ contractorSearch });
    setGlobalPayments(result);
  } finally {
    setLoading(false);
  }
}, [listGlobalUc, contractorSearch]);

useEffect(() => { loadAll(); }, [loadAll]);
```

Proposed shape:
```ts
const queryKey = mode === 'firefighter'
  ? ['payments', 'firefighter', contractorSearch ?? '']
  : ['payments', 'site_manager', projectId ?? ''];

const { data, isLoading, refetch } = useQuery({
  queryKey,
  queryFn: () => loadAllPayments({ mode, contractorSearch, projectId, ... }),
  // staleTime: Infinity inherited from QueryClient default — no override needed
});

const globalPayments = data?.globalPayments ?? [];
const globalAmountPayable = data?.globalAmountPayable ?? 0;
// ...etc — same return shape, same public API
```

The `loadAllPayments` function is extracted from the existing `loadAll` body — same logic, no changes to use cases.

### Step 3 — `usePayments`: mutations via `useMutation`

```ts
const queryClient = useQueryClient();

const markPaidMutation = useMutation({
  mutationFn: (input: MarkPaymentAsPaidInput) => markPaidUseCase.execute(input),
  onSuccess: (_, variables) => {
    // Invalidate all payment and invoice views
    queryClient.invalidateQueries({ queryKey: ['payments'] });
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    queryClient.invalidateQueries({ queryKey: ['projects'] });
  },
});
```

### Step 4 — `useTasks`: wire `acceptQuote` invalidation

`AcceptQuoteUseCase` is currently not exposed via `useTasks`. It will be added as a mutation:

```ts
// useTasks.ts
const queryClient = useQueryClient();

const acceptQuoteMutation = useMutation({
  mutationFn: (taskId: string) => acceptQuoteUseCase.execute(taskId),
  onSuccess: (result, taskId) => {
    // Refresh task views
    queryClient.invalidateQueries({ queryKey: ['tasks', projectId] });
    queryClient.invalidateQueries({ queryKey: ['taskDetail', taskId] });
    // Cross-domain: the new invoice must appear in Payments immediately
    queryClient.invalidateQueries({ queryKey: ['invoices'] });
    queryClient.invalidateQueries({ queryKey: ['payments'] });
  },
});
```

The `PaymentsScreen` — which calls `usePayments` — has no code change at all. Because it is subscribed to `['payments']`, TanStack Query automatically triggers a refetch when that key is invalidated by the task hook.

---

## Migration Sequence (Incremental — Low Risk)

Each step is independently deployable and does not break existing screens.

| Step | What changes | Screens affected |
|---|---|---|
| 1 | Add `@tanstack/react-query` + `QueryClientProvider` in `App.tsx` | None (additive only) |
| 2 | Migrate `usePayments` to `useQuery` | `PaymentsScreen` |
| 3 | Add `acceptQuote` to `useTasks` as a `useMutation` with payment invalidation | `TaskDetailsPage` |
| 4 | Migrate `useInvoices` to `useQuery` + `useMutation` | Invoice screens |
| 5 | Migrate `useTasks` core list/detail queries | Tasks screens |
| 6 | Migrate `useProjects`, `useCockpitData`, `useBlockerBar` | Dashboard, Tasks cockpit |

Steps 2 and 3 together resolve the motivating scenario. Steps 4–6 can follow in subsequent PRs.

---

## Public API Contract

The hooks' public return types **do not change**. This is a strict constraint:

```ts
// usePayments return — before and after migration, identical
export interface UsePaymentsReturn {
  globalPayments: PaymentWithProject[];
  globalAmountPayable: number;
  contractPayments: Payment[];
  variationPayments: Payment[];
  contractTotal: number;
  variationTotal: number;
  metrics: PaymentMetrics;
  loading: boolean;
  refresh: () => void;   // wraps queryClient.refetchQueries
}
```

All pages and components calling `usePayments` require zero changes.

---

## Testing Strategy

- **Unit tests**: mock `useQueryClient` — assert `invalidateQueries` is called with the correct keys after each mutation. Use `@testing-library/react-native` with `createTestQueryClient()` wrapper.
- **Integration tests**: existing `DrizzlePaymentRepository` integration tests are unaffected (no React Query in infrastructure).
- **Cross-hook test**: add a new integration test that calls `AcceptQuoteUseCase` directly, then asserts that the invoice count visible to `ListGlobalPaymentsUseCase` has increased — validating the underlying data without React.

---

## Open Questions

1. ~~**`staleTime` value**~~ — **Resolved:** `staleTime: Infinity` with `refetchOnWindowFocus: false` and `refetchOnReconnect: false` globally. All refetches are explicit via `invalidateQueries` only. Automatic background refetching can be re-enabled per-query later when needed (e.g. `refetchOnAppForeground` for the Payments screen).
2. **`refetchOnAppForeground`** — TanStack Query supports refetching when the app returns to foreground via `AppState`. Worth enabling for the payments screen specifically so overnight due dates recalculate.
3. **`useTaskForm`** — currently manages `computeQuoteStatus()` derivation before calling the use case. This can stay in the hook (not a query concern); no migration needed for the form layer.
4. **Offline / background mutations** — out of scope for this migration. The app currently has no offline queue; this design does not change that.

---

## Acceptance Criteria

- [ ] `PaymentsScreen` shows the new invoice-derived payable row immediately after navigating from `TaskDetailsPage` where a quote was accepted — with no manual refresh
- [ ] `usePayments` public API (`UsePaymentsReturn`) is unchanged; `PaymentsScreen` requires zero prop or hook call changes
- [ ] All existing unit and integration tests pass without modification
- [ ] TypeScript strict mode passes (`npx tsc --noEmit`)
- [ ] No new raw SQL introduced; use cases are unchanged
