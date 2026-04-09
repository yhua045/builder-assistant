# Design: Issue #191 — Payment Detail: Show & Assign Project + Unassigned Filter

**Status**: DRAFT — Awaiting Approval  
**Author**: Architect Agent  
**Date**: 2026-04-09 (revised 2026-04-09)  
**GitHub Issue**: #191  
**Branch**: `issue-191-show-payment-project`

---

## 1. User Stories

| # | Story |
|---|---|
| US-1 | As a Builder, when I open a Payment Detail screen, I want to see which Project the payment belongs to, so I can understand the payment in context. |
| US-2 | As a Builder, I want to tap the associated Project name to jump directly to the Project Detail screen, so I can navigate without going back to the Projects tab manually. |
| US-3 | As a Builder, if a payment has no associated project, I want to see a clear "Unassigned" indicator, so I know the field exists but has no value. |
| US-4 | As a Builder, I want to tap the Project row on the Payment Detail screen and pick from a list of existing projects to associate the payment with one, so I can categorise ad-hoc payments after the fact. |
| US-5 | As a Builder, on the Payments list screen, I want to filter by "Unassigned" to see only payments that have no linked project, so I can quickly find and categorise them. |

---

## 2. Acceptance Criteria

| # | Criterion |
|---|---|
| AC-1 | The Payment Detail screen shows a **Project** row in the Details section. |
| AC-2 | When `payment.projectId` is set and the project is found in the repository, the row displays the project **name** as a tappable row (primary-coloured text + `ChevronRight` icon). |
| AC-3 | Tapping the project name when a project is already assigned opens the **Project Picker Modal** (not cross-tab navigation directly), allowing the user to change or clear the assignment. |
| AC-4 | When `payment.projectId` is absent **or** the project cannot be found, the row displays `"Unassigned"` in muted-foreground colour and is **tappable** — opens the Project Picker Modal to assign one. |
| AC-5 | The **Project Picker Modal** lists all projects from `ProjectRepository.list()`. Each row shows the project name and status badge. A "Clear / Unassign" option appears at the top when a project is already assigned. |
| AC-6 | Selecting a project in the modal calls `paymentRepo.update({ ...payment, projectId: selectedId })`, refreshes the detail screen state, and invalidates relevant query cache keys (`paymentsAll`, `paidPaymentsGlobal`, `projectPayments` for any previously- and newly-assigned project). |
| AC-7 | Clearing the assignment sets `payment.projectId = undefined` and calls `paymentRepo.update()`, then refreshes. |
| AC-8 | Navigation to Project Detail is triggered by a separate **"Go to Project →"** button inside the picker modal header (when a project is already assigned), or from the row only when the picker is dismissed without change (alternative: a long-press or a secondary chevron icon — see §5 UI detail). |
| AC-9 | Cross-tab navigation to `Projects > ProjectDetail` still uses `CommonActions.navigate` with `initial: false`. |
| AC-10 | All existing `PaymentDetails` behaviour (invoice fetch, linked payments, Mark as Paid, Partial Payment) is **unchanged**. |
| AC-11 | TypeScript strict-mode passes (`npx tsc --noEmit`) with no new errors. |
| AC-12 | The Payments list screen (`index.tsx`) has an **"Unassigned"** filter chip alongside the existing ones. |
| AC-13 | When "Unassigned" is selected, the list shows only payments with `project_id IS NULL` in the database (`noProject: true` flag in `PaymentFilters`). |
| AC-14 | The `DrizzlePaymentRepository.list()` handles `noProject: true` by appending `project_id IS NULL` to the SQL `WHERE` clause. |
| AC-15 | Unit tests cover all the items listed in §7 Test Plan. |

---

## 3. Current State Analysis

### Relevant files

| File | Relevance |
|---|---|
| `src/domain/entities/Payment.ts` | `Payment.projectId?: string` already exists — no change needed |
| `src/domain/entities/Project.ts` | `Project.name: string` — the field we display and pick from |
| `src/domain/repositories/PaymentRepository.ts` | `PaymentFilters` and `PaymentRepository.update()` — needs `noProject` filter flag |
| `src/domain/repositories/ProjectRepository.ts` | `findById(id)`, `list()` — used for lookup and the picker listing |
| `src/pages/payments/PaymentDetails.tsx` | **Target screen** — fetches payment + invoice; needs project fetch, picker modal, and update |
| `src/pages/payments/index.tsx` | **Payments list screen** — needs "Unassigned" filter chip + list logic |
| `src/pages/payments/PaymentsNavigator.tsx` | Stack navigator for Payments tab — no `ProjectDetail` screen; cross-tab nav unchanged |
| `src/pages/tabs/index.tsx` | Tab navigator — `Projects` tab name used for cross-tab navigation |
| `src/pages/dashboard/index.tsx` | Reference implementation of `CommonActions.navigate` cross-tab pattern |
| `src/hooks/useGlobalPaymentsScreen.ts` | Owns filter state and payment queries — needs `'unassigned'` extension |
| `src/hooks/queryKeys.ts` | Cache key factories — needs `unassignedPaymentsGlobal()` key |
| `src/hooks/usePayments.ts` | Already enriches list-view items with `projectName` — unchanged |
| `src/components/payments/PaymentTypeFilterChips.tsx` | Filter chip bar — needs new "Unassigned" chip |
| `src/components/tasks/SubcontractorPickerModal.tsx` | **Reference pattern** for the new `ProjectPickerModal` |
| `src/application/usecases/payment/ListGlobalPaymentsUseCase.ts` | Passes through to `repo.list()` — `noProject` flag can be forwarded |
| `src/infrastructure/repositories/DrizzlePaymentRepository.ts` | SQL `list()` — needs `project_id IS NULL` clause for `noProject: true` |
| `src/infrastructure/di/container.ts` | `ProjectRepository` already registered as `'ProjectRepository'` |

### Gaps

1. `PaymentDetails.tsx` has no project state, no project fetch, no project UI, and no project-assignment flow.
2. No `ProjectPickerModal` component exists.
3. `PaymentFilters` has no `noProject` flag; `DrizzlePaymentRepository.list()` cannot filter for null `project_id`.
4. `PaymentsFilterOption` type does not include `'unassigned'`; the chip bar and hook have no "Unassigned" branch.
5. `queryKeys` has no key for unassigned payments.
6. No unit tests exist for any of the above.

### What does NOT change

- `Payment` domain entity (already has `projectId`).
- `ProjectRepository` interface (existing `findById` and `list()` are sufficient).
- No database schema migration required (`project_id` column already nullable).
- `PaymentsNavigator.tsx` — cross-tab navigation leaves the Payments stack entirely; no new screen registration needed.

---

## 4. Architecture Design

### Layer responsibilities

```
PaymentDetails (UI)
  └─ loadData() callback
       └─ paymentRepo.findById(paymentId)            [existing]
       └─ invoiceRepo.getInvoice(invoiceId)           [existing]
       └─ projectRepo.findById(projectId)             [NEW — on-demand, only when projectId present]
  └─ handleOpenProjectPicker()                        [NEW — opens ProjectPickerModal]
  └─ handleSelectProject(project | undefined)         [NEW — persists assignment via paymentRepo.update()]
       └─ paymentRepo.update({ ...payment, projectId: project?.id })
       └─ queryClient.invalidateQueries(...)
       └─ loadData()                                  [re-fetch to refresh UI]
  └─ handleNavigateToProject()                        [NEW — cross-tab navigate from picker modal]
       └─ navigation.dispatch(CommonActions.navigate({
            name: 'Projects',
            params: { screen: 'ProjectDetail', params: { projectId }, initial: false }
          }))

ProjectPickerModal (new component: src/components/payments/ProjectPickerModal.tsx)
  └─ projectRepo.list()                               [fetches all projects on modal open]
  └─ FlatList of project rows (name + status badge)
  └─ "Clear / Unassign" row at top (only when currentProjectId is set)
  └─ "Go to Project →" header action (only when currentProjectId is set) → calls onNavigate prop

useGlobalPaymentsScreen (hook)
  └─ PaymentsFilterOption extended with 'unassigned'
  └─ new useQuery for unassignedPayments:
       └─ paymentRepo.list({ allProjects: true, noProject: true })
  └─ returns unassignedPayments in addition to existing fields

PaymentTypeFilterChips (component)
  └─ CHIPS array extended with { option: 'unassigned', label: 'Unassigned' }

PaymentRepository (domain interface)
  └─ PaymentFilters.noProject?: boolean               [NEW flag — filter for project_id IS NULL]

DrizzlePaymentRepository (infrastructure)
  └─ list() — honours noProject: true → appends 'project_id IS NULL' to WHERE

ListGlobalPaymentsUseCase (application)
  └─ ListGlobalPaymentsRequest.noProject?: boolean    [NEW — forwarded to filters]

queryKeys (hook utility)
  └─ unassignedPaymentsGlobal()                       [NEW key factory]
```

**Why no new use case for project assignment?**
`PaymentDetails` already calls `paymentRepo.findById` directly. The assignment action (`paymentRepo.update()`) is a single-shot persistence call with no business rules — identical to the existing "Mark as Paid" pattern that calls `MarkPaymentAsPaidUseCase`. Adding an `AssignProjectToPaymentUseCase` would be disproportionate given the trivial logic; the update call belongs in the component event handler with cache invalidation, exactly as done today for paid marking.

### Data flow — Payment Detail (assignment)

```
User taps "Project" row
       │
       ▼
ProjectPickerModal opens → projectRepo.list() → renders project rows
       │
       ├─ User picks a project → handleSelectProject(project)
       │     ├─ paymentRepo.update({ ...payment, projectId: project.id })
       │     ├─ invalidate: paymentsAll, paidPaymentsGlobal, projectPayments(oldId), projectPayments(newId)
       │     └─ loadData()   → setProject(...)  → row re-renders with new name
       │
       ├─ User picks "Clear" → handleSelectProject(undefined)
       │     ├─ paymentRepo.update({ ...payment, projectId: undefined })
       │     └─ (same invalidation + reload)
       │
       └─ User taps "Go to Project →" → handleNavigateToProject()
             └─ CommonActions.navigate to Projects tab
```

### Data flow — Payments list (unassigned filter)

```
User taps "Unassigned" chip
       │
       ▼
filter = 'unassigned'
       │
       ▼
useQuery(queryKeys.unassignedPaymentsGlobal())
  → paymentRepo.list({ allProjects: true, noProject: true })
  → SQL: SELECT * FROM payments WHERE project_id IS NULL ORDER BY created_at DESC
       │
       ▼
paymentsToShow = unassignedPayments (sorted by created_at DESC)
```

### Component changes — PaymentDetails.tsx

1. **Resolve `ProjectRepository`** via DI (same pattern as existing repos).
2. **New state**: `project: Project | null`, `projectPickerVisible: boolean`.
3. **`loadData()` addition** — fetch project alongside invoice when `projectId` is present.
4. **`handleSelectProject(p: Project | undefined)`** — updates payment, invalidates caches, reloads.
5. **`handleNavigateToProject()`** — `CommonActions.navigate` cross-tab (same as original AC-3 design, now triggered from within the picker modal via `onNavigate` prop).
6. **Project row render**: Always tappable (opens picker); displays project name or "Unassigned".
7. **`<ProjectPickerModal />`** rendered at screen level (like `partialModalVisible`).

### New component — ProjectPickerModal.tsx

```
Props:
  visible: boolean
  currentProjectId?: string
  onSelect(project: Project | undefined): void   // undefined = clear
  onNavigate(): void                             // navigate to current project
  onClose(): void

Internals:
  - On open: calls projectRepo.list() (resolved from DI inside the modal)
  - Search input (project name substring)
  - FlatList rows: project name (bold) + status chip
  - "Clear assignment" row if currentProjectId is set
  - Header right: "Go to Project →" button if currentProjectId is set
  - Follows SubcontractorPickerModal layout pattern (Modal, animationType="slide", safe area)
```

### Changes to PaymentFilters (domain/repositories/PaymentRepository.ts)

```ts
export interface PaymentFilters {
  // ... existing fields unchanged ...
  /** If true, return only payments with no project (project_id IS NULL). */
  noProject?: boolean;
}
```

### Changes to DrizzlePaymentRepository.list()

```ts
// After existing contractorSearch clause:
if (filters?.noProject) {
  where.push('project_id IS NULL');
}
```

### Changes to useGlobalPaymentsScreen

1. `PaymentsFilterOption` → extend to `'quotations' | 'pending' | 'paid' | 'all' | 'unassigned'`.
2. Add `useQuery` for unassigned (parallel to `paidData`):
   ```ts
   const { data: unassignedData, isFetching: unassignedFetching } = useQuery({
     queryKey: queryKeys.unassignedPaymentsGlobal(unassignedSearch),
     queryFn: () => listUnassignedUc.execute({ noProject: true }),
     staleTime: Infinity,
   });
   ```
   Where `listUnassignedUc` is a `ListGlobalPaymentsUseCase` instance (same use case, passed `noProject: true` in request).
3. `loading` includes `unassignedFetching`.
4. Return `unassignedPayments: Payment[]` in the interface.
5. `refresh()` also invalidates `queryKeys.unassignedPaymentsGlobal()`.

### Changes to ListGlobalPaymentsUseCase

```ts
export interface ListGlobalPaymentsRequest {
  contractorSearch?: string;
  status?: 'pending' | 'settled';
  /** If true, list only payments with no linked project (overrides status filter). */
  noProject?: boolean;
}

async execute(req: ListGlobalPaymentsRequest): Promise<PaymentListResult> {
  const filters: PaymentFilters = {
    allProjects: true,
    noProject: req.noProject,
    ...(!req.noProject ? { status: req.status ?? 'pending' } : {}),
    contractorSearch: req.contractorSearch,
  };
  return this.repo.list(filters);
}
```

### Changes to PaymentTypeFilterChips.tsx

```ts
const CHIPS = [
  { option: 'pending',    label: 'Pending' },
  { option: 'paid',       label: 'Paid' },
  { option: 'unassigned', label: 'Unassigned' },   // NEW
  { option: 'quotations', label: 'Quotations' },
  { option: 'all',        label: 'All' },
];
```

### Changes to queryKeys.ts

```ts
/** Global unassigned payments (Finances screen Unassigned filter) */
unassignedPaymentsGlobal: (contractorSearch?: string) =>
  (contractorSearch
    ? ['payments', 'unassigned', contractorSearch]
    : ['payments', 'unassigned']) as readonly string[],
```

### Changes to index.tsx (PaymentsScreen)

1. `EMPTY_MESSAGES` gets an `'unassigned'` key:
   ```ts
   unassigned: {
     title: 'No unassigned payments',
     subtitle: (s) => s ? 'No unassigned payments match that name.' : 'All payments are linked to a project.',
   },
   ```
2. `paymentsToShow` derivation adds an `'unassigned'` branch that reads from `unassignedPayments`.
3. `showBanner` logic excludes `'unassigned'`.

---

## 5. UI Behaviour Detail

### Project row in Payment Detail

```
┌──────────────────────────────────────────────┐
│ Project          House Renovation  >          │  ← project assigned; tapping opens picker
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│ Project          Unassigned  (muted) >        │  ← no project; tapping opens picker to assign
└──────────────────────────────────────────────┘
```

The chevron (`>`) is always present on the Project row because it is always tappable.

### Project Picker Modal

```
┌─── Assign Project ──────────────────[✕]────┐
│  [Go to Project →]  (shown only if assigned) │
│ ┌────────────────────────────────────────┐  │
│ │ 🔍 Search projects...                  │  │
│ └────────────────────────────────────────┘  │
│                                              │
│ ┌──────────────────────────────────────────┐ │
│ │ ✕  Clear assignment                      │ │  ← only when assigned
│ └──────────────────────────────────────────┘ │
│                                              │
│  House Renovation          [active]  ✓       │  ← tick on current
│  Granny Flat Build         [planning]        │
│  Bathroom Reno             [completed]       │
│  ...                                         │
└──────────────────────────────────────────────┘
```

- Search filters by name substring (client-side, list is fetched once on open).
- Selected project has a filled dot or tick on the right.
- `animationType="slide"` from bottom (matches `SubcontractorPickerModal`).
- Tapping "Go to Project →" dismisses modal then dispatches cross-tab navigation.

### Unassigned filter chip

Chip order: Pending · Paid · Unassigned · Quotations · All

The "Unassigned" filter shows all payments regardless of status (both pending and settled). The `AmountPayableBanner` is hidden for this filter. The search bar searches by `contractor_name`.

---

## 6. Navigation Contract

### Cross-tab navigation to ProjectDetail (unchanged from original design)

```ts
navigation.dispatch(
  CommonActions.navigate({
    name: 'Projects',
    params: {
      screen: 'ProjectDetail',
      params: { projectId: payment.projectId },
      initial: false,
    },
  }),
);
```

This is triggered by `handleNavigateToProject()` in `PaymentDetails`, called via the `onNavigate` prop of `ProjectPickerModal`.

---

## 7. Test Plan (TDD)

### Red phase — write failing tests first

#### Unit tests: `__tests__/unit/PaymentDetails.project.test.tsx`

| # | Test | Assertion |
|---|---|---|
| T-1 | Renders project name when `projectId` set and project found | Shows `"House Reno"` text |
| T-2 | Project row is always tappable (showing picker, not navigating directly) | Element has `onPress` defined and modal opens on press |
| T-3 | Pressing project row when project assigned opens ProjectPickerModal | `projectPickerVisible` becomes `true` |
| T-4 | Selecting a project in the picker calls `paymentRepo.update` with correct `projectId` | `update` called with `{ ...payment, projectId: 'proj-1' }` |
| T-5 | Clearing assignment calls `paymentRepo.update` with `projectId: undefined` | `update` called with no `projectId` |
| T-6 | Renders "Unassigned" when `projectId` is absent | `"Unassigned"` text present; row still tappable |
| T-7 | Renders "Unassigned" when `projectId` set but `projectRepo.findById` returns `null` | `"Unassigned"` text present |
| T-8 | Tapping "Go to Project →" in picker dispatches `CommonActions.navigate` cross-tab | `navigation.dispatch` called with `name:'Projects'`, `screen:'ProjectDetail'`, correct `projectId` |

#### Unit tests: `__tests__/unit/PaymentDetails.project.test.tsx` (continued / separate file if preferred)

| # | Test | Assertion |
|---|---|---|
| T-9 | After successful project assignment, `loadData` is called again | `projectRepo.findById` called twice total |
| T-10 | Assignment failure (repo throws) shows Alert without crashing | `Alert.alert` called with error message |

#### Unit tests: `__tests__/unit/useGlobalPaymentsScreen.unassigned.test.ts`

| # | Test | Assertion |
|---|---|---|
| T-11 | When filter is `'unassigned'`, hook calls `paymentRepo.list` with `noProject: true` | Verified via repo mock |
| T-12 | `unassignedPayments` is returned in hook result | Array present in return value |
| T-13 | `loading` reflects `unassignedFetching` | `true` while query is pending |

#### Unit tests: `__tests__/unit/DrizzlePaymentRepository.unassigned.test.ts`

| # | Test | Assertion |
|---|---|---|
| T-14 | `list({ allProjects: true, noProject: true })` returns only payments with `project_id IS NULL` | In-memory SQLite: seeded data with/without project; only null-project rows returned |
| T-15 | `list({ allProjects: true, noProject: true, contractorSearch: 'Bob' })` combines both filters | Only null-project AND contractor matching `'Bob'` are returned |

#### Unit tests: `__tests__/unit/PaymentTypeFilterChips.test.tsx`

| # | Test | Assertion |
|---|---|---|
| T-16 | Renders "Unassigned" chip | `testID="filter-chip-unassigned"` present |
| T-17 | Pressing "Unassigned" chip calls `onChange('unassigned')` | Callback invoked correctly |

#### Unit tests: `__tests__/unit/ListGlobalPaymentsUseCase.test.ts` (new/extended)

| # | Test | Assertion |
|---|---|---|
| T-18 | When `noProject: true`, `repo.list` called with `noProject: true` and no `status` filter | Verified via mock |
   - `ProjectRepository` from domain repositories
   - `ChevronRight` from `lucide-react-native`

---

## 8. File Change Summary

| File | Change | Scope |
|---|---|---|
| `src/pages/payments/PaymentDetails.tsx` | Add project state, project fetch, `handleSelectProject()`, `handleNavigateToProject()`, project row, `<ProjectPickerModal />` rendered at screen level | Medium–large (~80 lines added) |
| `src/components/payments/ProjectPickerModal.tsx` | **New file** — picker modal for selecting/clearing project assignment | New file (~150 lines) |
| `src/domain/repositories/PaymentRepository.ts` | Add `noProject?: boolean` to `PaymentFilters` | Minimal (1 line) |
| `src/application/usecases/payment/ListGlobalPaymentsUseCase.ts` | Add `noProject?: boolean` to request interface; forward to filters, suppress `status` default when `noProject` is set | Small (~8 lines) |
| `src/infrastructure/repositories/DrizzlePaymentRepository.ts` | Add `noProject: true` clause (`project_id IS NULL`) in `list()` | Minimal (~4 lines) |
| `src/hooks/useGlobalPaymentsScreen.ts` | Extend `PaymentsFilterOption` with `'unassigned'`; add `unassignedData` query; return `unassignedPayments`; include in `refresh()` and `loading` | Medium (~30 lines) |
| `src/hooks/queryKeys.ts` | Add `unassignedPaymentsGlobal()` key factory | Minimal (3 lines) |
| `src/components/payments/PaymentTypeFilterChips.tsx` | Add `{ option: 'unassigned', label: 'Unassigned' }` to `CHIPS` | Minimal (1 line) |
| `src/pages/payments/index.tsx` | Add `EMPTY_MESSAGES['unassigned']`; update `paymentsToShow` derivation; hide banner for `'unassigned'` filter | Small (~10 lines) |
| `__tests__/unit/PaymentDetails.project.test.tsx` | New test file covering T-1 through T-10 | New file |
| `__tests__/unit/useGlobalPaymentsScreen.unassigned.test.ts` | New test file covering T-11 through T-13 | New file |
| `__tests__/unit/DrizzlePaymentRepository.unassigned.test.ts` | New test file covering T-14 through T-15 | New file |
| `__tests__/unit/PaymentTypeFilterChips.test.tsx` | Extend/new test file covering T-16 through T-17 | New/extended file |
| `__tests__/unit/ListGlobalPaymentsUseCase.test.ts` | New/extend test covering T-18 | New/extended file |

---

## 9. Out of Scope

- Showing project info on the `PaymentCard` list row (already shows `projectName` label via `usePayments`).
- Linking payment to a project during **creation** (separate feature).
- A new `GetPaymentDetailUseCase` (low value for this scope; deferred).
- Filtering the unassigned list by payment status (currently shows all regardless of pending/paid).
- Editing other payment fields from the detail screen.

---

## 10. Risk & Trade-offs

| Risk | Mitigation |
|---|---|
| `projectRepo.findById` throws if project was deleted | Wrapped in try/catch in `loadData()`; falls through to "Unassigned" display |
| `paymentRepo.update()` on a synthetic row (`invoice-payable:`) | Synthetic rows do not exist in the DB; the Project row should not offer the picker for synthetic rows with no `paymentId`. Guard: only render picker when `!isSynthetic` |
| Cross-tab navigation from within the picker leaves user in Projects stack | Intentional — matches Dashboard pattern. Back button returns to ProjectsList. If back-to-payment is needed that is a separate UX issue. |
| `projectRepo.list()` returns many projects — modal performance | List is fetched once on modal open. Client-side substring filter in `useState`. For large project counts a debounced search can be added later. |
| Cache invalidation for `projectPayments(oldId)` when `oldId` unknown | Store `previousProjectId` in a ref before calling `handleSelectProject`; pass both old and new ids to invalidation. |
| `noProject: true` combined with `status` filter in SQL | Handled: `ListGlobalPaymentsUseCase` does not apply a default `status` when `noProject: true`, so unassigned shows all payment statuses. |

---

## 11. Handoff Notes for Developer Agent

### Implementation order (outside-in, TDD)

1. **Red: write all failing tests** (T-1 through T-18) before touching any production code.
2. **Green — layer 1 (infrastructure)**: Add `noProject` clause to `DrizzlePaymentRepository.list()` and make T-14/T-15 pass.
3. **Green — layer 2 (domain/application)**: Add `noProject` to `PaymentFilters` and `ListGlobalPaymentsUseCase` → T-18.
4. **Green — layer 3 (hook + chips)**: Extend `useGlobalPaymentsScreen`, `queryKeys`, `PaymentTypeFilterChips`, and `index.tsx` → T-11 through T-17.
5. **Green — layer 4 (new component)**: Implement `ProjectPickerModal.tsx`.
6. **Green — layer 5 (detail screen)**: Wire `PaymentDetails.tsx` → T-1 through T-10.
7. Run `npx tsc --noEmit` and `npm test` — all green.

### Key constraints

- **Do not** change `Payment` entity or `ProjectRepository` interface.
- **No database migration** required (`project_id` is already nullable in schema).
- Synthetic rows (`id.startsWith('invoice-payable:')`) must **not** show the project picker — display the project name as read-only text (or "Unassigned") without a tap handler.
- Follow `SubcontractorPickerModal` as the layout/behaviour reference for `ProjectPickerModal`.
- Use `paymentRepo.update()` for persistence — no new repository method required.
- Design document location: `design/#191-payment-project.md`
