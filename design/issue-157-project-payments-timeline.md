# Design: Project-level Payments Timeline — Collapsible Sections & Sticky Headings

**Issue**: #157  
**Branch**: `issue/157-project-payments`  
**Date**: 2026-03-18  
**Status**: ⏳ Awaiting approval

---

## 1. User Story

> As a builder, I want to open a project and see its Tasks, Payments, and Quotes in a single scrollable detail view with collapsible sections so that I can quickly navigate between what is scheduled, what is owed, and what is quoted — without excessive scrolling.

---

## 2. Acceptance Criteria

- [ ] `ProjectDetail.tsx` renders three independently collapsible sections: **Tasks**, **Payments**, **Quotes**.
- [ ] Default state: Tasks **expanded**, Payments **collapsed**, Quotes **collapsed**.
- [ ] The **Payments** section shows project-linked payments grouped by day (matching the task timeline style).
- [ ] Multiple payments on the same day appear under a shared day header, ordered by `dueDate` ascending.
- [ ] A **sticky section heading** ("Tasks", "Payments", "Quotes") remains pinned at the top of the viewport while the user scrolls items inside that section, then yields to the next section's heading when it arrives.
- [ ] Payment cards show quick actions: **View**, **Record Payment**, **Attach Document**; these trigger use-cases and call the appropriate `invalidations` entries.
- [ ] Quick actions produce an optimistic UI update (loading state on the card action button) before settling.
- [ ] Collapsing a section hides all items with a smooth `LayoutAnimation` transition; the section heading remains visible.
- [ ] `useProjectTimeline` is extended (or a companion hook is provided) to return grouped payments and quotations alongside tasks.
- [ ] Unit tests cover: payment grouping logic, collapse/expand behavior, quick-action invalidation paths.
- [ ] Integration tests verify: sticky heading behavior, collapse/expand interactions, record-payment happy path.

---

## 3. Architecture Decisions

### 3.1 Replace `ScrollView` with `SectionList` for native sticky header support

The current `ProjectDetail.tsx` uses a plain `ScrollView`. To get sticky section headings that yield to one another as the user scrolls, the screen will be migrated to a `SectionList` with `stickySectionHeadersEnabled={true}`.

`SectionList` is the idiomatic React Native solution:
- Its section headers natively pin at the top of the viewport and get pushed off when the following section's header arrives — exactly the described "yields to the next section" behavior.
- No third-party library or manual `Animated`/`onScroll` position tracking is required.
- Works correctly on both iOS and Android with no platform branching.

**Section data shape:**

```typescript
type SectionKey = 'tasks' | 'payments' | 'quotes';

interface TimelineSection {
  key: SectionKey;
  title: string;
  itemCount: number;
  collapsed: boolean;
  data: TimelineSectionItem[];   // empty array when collapsed
}

type TimelineSectionItem =
  | { type: 'taskGroup';    group: DayGroup }
  | { type: 'paymentGroup'; group: PaymentDayGroup }
  | { type: 'quoteGroup';   group: QuotationDayGroup };
```

When a section is collapsed, `data` is set to `[]`. `SectionList` renders no items under the header but still renders the header itself (and keeps it in the sticky stack). This drives the collapse/expand behavior with zero additional scroll machinery.

### 3.2 Three focused hooks, composed at the screen level

Rather than extending `useProjectTimeline` into a monolith that owns tasks, payments, and quotations, three **focused, single-responsibility hooks** are introduced. Each mirrors exactly one use case and one section of the UI:

| Hook | Key factory | Source use case |
|------|-------------|------------------|
| `useTaskTimeline(projectId)` | `queryKeys.tasks(projectId)` | `ListTasksUseCase` (existing logic extracted from `useProjectTimeline`) |
| `usePaymentsTimeline(projectId)` | `queryKeys.projectPayments(projectId)` | `ListProjectPaymentsUseCase` (new) |
| `useQuotationsTimeline(projectId)` | `queryKeys.projectQuotations(projectId)` | `ListProjectQuotationsUseCase` (new) |

`useProjectTimeline` is **renamed to `useTaskTimeline`** (or deprecated in favour of it). The existing project-header query (`queryKeys.projectDetail`) moves into a thin `useProjectDetail(projectId)` hook called separately by `ProjectDetail.tsx`.

**Why three hooks instead of one?**
- Each section loads and errors independently — a failed quotations fetch does not block tasks from rendering.
- Each hook is independently unit-testable with a small, focused mock surface.
- The `SectionList` architecture already treats each section as a separate render unit; per-section `loading`/`error` states are consumed directly by each section's `renderSectionHeader`.
- Avoids a 200+ line hook that conflates three unrelated data concerns.
- Aligns with the Clean Architecture principle: one use case → one hook.

**Screen-level composition** (the only coordination needed):
```typescript
// ProjectDetail.tsx
const { project } = useProjectDetail(projectId);
const { dayGroups, loading: tasksLoading, markComplete } = useTaskTimeline(projectId);
const { paymentDayGroups, loading: paymentsLoading, recordPayment } = usePaymentsTimeline(projectId);
const { quotationDayGroups, loading: quotationsLoading } = useQuotationsTimeline(projectId);
```

Grouping logic (`groupPaymentsByDay`, `groupQuotationsByDay`, `groupTasksByDay`) are **pure functions** exported from their respective hook files for independent unit testing.

### 3.3 New `queryKeys` entries

Two new scoped key factories:

```typescript
/** Payments for a single project (scoped timeline view) */
projectPayments: (projectId: string) => ['projectPayments', projectId] as const,

/** Quotations for a single project (aggregated across all tasks) */
projectQuotations: (projectId: string) => ['projectQuotations', projectId] as const,
```

`queryKeys.projectPayments` is intentionally separate from `queryKeys.payments` (which is the firefighter / site_manager global view) to avoid the additional invoice-payable derivation logic used by `usePayments`. The project timeline only needs the raw `Payment[]` scoped to `projectId`, sourced directly via `PaymentRepository.findByProjectId` (which already exists in the domain interface).

**Invalidation cascade additions:**

`paymentRecorded` will be updated to also bust `projectPayments(projectId)`:
```typescript
paymentRecorded: (ctx: PaymentCtx) => [
  queryKeys.paymentsAll(),
  queryKeys.invoices(ctx.projectId),
  ...(ctx.projectId ? [queryKeys.projectPayments(ctx.projectId)] : []),
],
```

A new invalidation entry for project timeline refresh:
```typescript
projectTimelineRefreshed: (ctx: { projectId: string }) => [
  queryKeys.tasks(ctx.projectId),
  queryKeys.projectPayments(ctx.projectId),
  queryKeys.projectQuotations(ctx.projectId),
  queryKeys.projectDetail(ctx.projectId),
],
```

### 3.4 New use cases in the application layer

| Use Case | Location | Notes |
|----------|----------|-------|
| `ListProjectPaymentsUseCase` | `src/application/usecases/payment/` | Thin wrapper: delegates to `PaymentRepository.findByProjectId`. No invoice-payable derivation needed here — the timeline shows settled/pending payment records, not outstanding balances. |
| `ListProjectQuotationsUseCase` | `src/application/usecases/quotation/` | Fetches all task IDs for the project via `TaskRepository.findByProjectId`, then calls `QuotationRepository.findByTask` for each. Parallel `Promise.all` — page size guard at 500 items per section (see §3.7). |

### 3.5 Domain interface addition — `QuotationRepository.findByProjectId`

`QuotationRepository` currently only has `findByTask(taskId)`. The application-layer use case above works around this with N parallel task calls, but the cleaner option is:

```typescript
// QuotationRepository.ts (new method)
findByProjectId(projectId: string): Promise<Quotation[]>;
```

The `DrizzleQuotationRepository` would implement this with a single SQL join:
```sql
SELECT q.* FROM quotations q
JOIN tasks t ON q.task_id = t.id
WHERE t.project_id = ?
```

**Decision**: Add `findByProjectId` to `QuotationRepository` and implement in `DrizzleQuotationRepository`. This is the approach that follows the established project pattern (`TaskRepository`, `PaymentRepository`, `MilestoneRepository`, and others all have `findByProjectId`).

### 3.6 Collapsible section state — managed in the component, not the hook

The collapse/expand states for Tasks, Payments, and Quotes are **pure UI state** with no persistence requirement. They live in `ProjectDetail.tsx` with `useState`, mirroring how day-group expand/collapse state is currently managed:

```typescript
const [collapsed, setCollapsed] = useState<Record<SectionKey, boolean>>({
  tasks:    false,   // Tasks: expanded by default
  payments: true,    // Payments: collapsed by default
  quotes:   true,    // Quotes: collapsed by default
});
```

`LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut)` is called before each state update for smooth transitions (already enabled for Android with the existing `UIManager.setLayoutAnimationEnabledExperimental` call).

### 3.7 Incremental fetching guard (>500 items)

`ListProjectPaymentsUseCase` and `ListProjectQuotationsUseCase` will enforce a soft ceiling:
- If the repository returns more than 500 items, only the most recent 500 are surfaced and a `truncated: true` flag is returned alongside the data.
- The `useProjectTimeline` hook exposes this flag per section; the UI renders a non-blocking "Showing 500 of N" notice beneath the last day group.
- Full pagination (lazy loading) is deferred to a follow-up ticket; this limit avoids render performance issues on large projects.

### 3.8 Quick actions on payment timeline cards

Three quick actions per payment row:

| Action | Behaviour |
|--------|-----------|
| **View** | Navigate to `PaymentDetail` screen (existing route). |
| **Record Payment** | Opens a bottom-sheet (`RecordPaymentSheet`) with pre-filled amount and contractor. On confirm: calls `RecordPaymentUseCase`, then invalidates `invalidations.paymentRecorded({ projectId })`. |
| **Attach Document** | Navigate to `PaymentDetail` with `openDocument: true` param (mirrors existing task pattern). |

Optimistic updates: the action button shows an `ActivityIndicator` while the mutation is pending; the mutation itself is fire-and-respond (no UI rollback on failure — an `Alert` is shown instead, matching the existing `markComplete` pattern).

### 3.9 New `TimelineSectionHeader` component

A sticky-friendly header with collapse toggle and count badge:

```
┌─────────────────────────────────────────────────────────┐
│  ▼  Payments                            7  ─────────── │
└─────────────────────────────────────────────────────────┘
```

Props:
```typescript
interface TimelineSectionHeaderProps {
  title: string;
  itemCount: number;
  collapsed: boolean;
  onToggle: () => void;
  testID?: string;
}
```

Styled with NativeWind. The component must have a **solid background** (`bg-background`) so it opaquesthe content scrolling beneath it when pinned.

### 3.10 Reuse existing `PaymentCard` component

The existing `src/components/payments/PaymentCard.tsx` is reused for payment items inside `PaymentDayGroup`. A thin adapter prop `onQuickAction` is added to surface the View / Record Payment / Attach Document actions without modifying the existing `onPress` / `onPayNow` interface.

If the `PaymentCard` adapter approach adds excessive complexity, a new `TimelinePaymentCard` (parallel to `TimelineTaskCard`) is preferred over modifying the existing card — keeping the global Payments screen unaffected.

**Decision**: Create `TimelinePaymentCard` as a new component purpose-built for the timeline context (same rationale as `TimelineTaskCard` vs the general task card). It can internally reuse styling helpers from `PaymentCard` but owns its own quick-action row.

### 3.11 No new navigation screen for quotes (v1)

Out of scope for this issue: tapping a quotation card navigates into the existing task detail flow (the quotation is task-scoped). No new `QuotationDetail` screen is introduced.

### 3.12 No third-party UI libraries

Consistent with the decision recorded in issue-154 §3.6. All components use NativeWind + Lucide icons + React Native built-ins only.

---

## 4. Files to Create / Modify

| Action | Path | Purpose |
|--------|------|---------|
| **Modify** | `src/domain/repositories/QuotationRepository.ts` | Add `findByProjectId(projectId)` method to interface |
| **Modify** | `src/infrastructure/repositories/DrizzleQuotationRepository.ts` | Implement `findByProjectId` with single JOIN query |
| **Create** | `src/application/usecases/payment/ListProjectPaymentsUseCase.ts` | Thin use case: delegates to `PaymentRepository.findByProjectId` |
| **Create** | `src/application/usecases/quotation/ListProjectQuotationsUseCase.ts` | Use case: fetches quotations for a project via `findByProjectId` |
| **Modify** | `src/hooks/queryKeys.ts` | Add `projectPayments`, `projectQuotations` key factories; update `paymentRecorded` invalidation; add `projectTimelineRefreshed` invalidation |
| **Rename** | `src/hooks/useProjectTimeline.ts` → `src/hooks/useTaskTimeline.ts` | Rename and trim to task-only concern; export `groupTasksByDay`, `getTaskDateKey`, `formatDayLabel` |
| **Create** | `src/hooks/useProjectDetail.ts` | Thin hook: fetches `ProjectDetails` via `queryKeys.projectDetail` |
| **Create** | `src/hooks/usePaymentsTimeline.ts` | Hook: fetches + groups payments by day for a project; exposes `recordPayment` mutation |
| **Create** | `src/hooks/useQuotationsTimeline.ts` | Hook: fetches + groups quotations by day for a project |
| **Create** | `src/components/projects/TimelineSectionHeader.tsx` | Sticky-safe collapsible section heading with count badge |
| **Create** | `src/components/projects/TimelinePaymentCard.tsx` | Payment card variant for the project timeline with quick-action row |
| **Create** | `src/components/projects/TimelineQuotationCard.tsx` | Quotation card for the project timeline |
| **Modify** | `src/pages/projects/ProjectDetail.tsx` | Replace `ScrollView` + task-only rendering with `SectionList`; compose the four hooks; add section collapse state |
| **Create** | `__tests__/unit/groupPaymentsByDay.test.ts` | Unit tests: payment grouping logic |
| **Create** | `__tests__/unit/groupQuotationsByDay.test.ts` | Unit tests: quotation grouping logic |
| **Rename** | `__tests__/unit/useProjectTimeline.test.ts` → `__tests__/unit/useTaskTimeline.test.ts` | Update import paths after hook rename |
| **Create** | `__tests__/integration/ProjectDetailPayments.test.tsx` | Integration: section collapse/expand, payments rendering, record-payment quick action, sticky header rendering |

---

## 5. Data Contracts

### New: `PaymentDayGroup`

```typescript
export interface PaymentDayGroup {
  /** ISO date YYYY-MM-DD, or '__nodate__' */
  date: string;
  /** Human-readable label, e.g. "Thu 20 Mar" */
  label: string;
  /** Sorted by dueDate ascending */
  payments: Payment[];
}
```

### New: `QuotationDayGroup`

```typescript
export interface QuotationDayGroup {
  /** ISO date YYYY-MM-DD based on Quotation.date, or '__nodate__' */
  date: string;
  label: string;
  /** Sorted by Quotation.date ascending */
  quotations: Quotation[];
}
```

### Hook return types (one per hook)

```typescript
// useProjectDetail
export interface UseProjectDetailReturn {
  project: ProjectDetails | null;
  loading: boolean;
  error: string | null;
}

// useTaskTimeline (replaces useProjectTimeline)
export interface UseTaskTimelineReturn {
  dayGroups: DayGroup[];
  loading: boolean;
  error: string | null;
  markComplete: (task: Task) => Promise<void>;
  invalidate: () => Promise<void>;
}

// usePaymentsTimeline
export interface UsePaymentsTimelineReturn {
  paymentDayGroups: PaymentDayGroup[];
  loading: boolean;
  error: string | null;
  truncated: boolean;               // true when limited to 500 items
  recordPayment: (payment: Payment) => Promise<void>;
  invalidate: () => Promise<void>;
}

// useQuotationsTimeline
export interface UseQuotationsTimelineReturn {
  quotationDayGroups: QuotationDayGroup[];
  loading: boolean;
  error: string | null;
  truncated: boolean;
  invalidate: () => Promise<void>;
}
```

### Pure grouping helpers (exported for unit testing)

```typescript
// src/hooks/useTaskTimeline.ts  (moved from useProjectTimeline)
export function getTaskDateKey(task: Task): string | null
export function groupTasksByDay(tasks: Task[]): DayGroup[]
export function formatDayLabel(dateKey: string): string

// src/hooks/usePaymentsTimeline.ts
/** Extract YYYY-MM-DD key from a Payment using dueDate ?? paymentDate. */
export function getPaymentDateKey(payment: Payment): string | null
/** Group and sort payments into PaymentDayGroup[]. */
export function groupPaymentsByDay(payments: Payment[]): PaymentDayGroup[]

// src/hooks/useQuotationsTimeline.ts
/** Extract YYYY-MM-DD key from a Quotation using Quotation.date. */
export function getQuotationDateKey(quotation: Quotation): string | null
/** Group and sort quotations into QuotationDayGroup[]. */
export function groupQuotationsByDay(quotations: Quotation[]): QuotationDayGroup[]
```

---

## 6. Component Tree

```
ProjectDetail.tsx (screen)
├── SafeAreaView
│   ├── Header row (back button, project name, expand-all toggle)
│   └── SectionList (stickySectionHeadersEnabled)
│       ├── Project header card (ListHeaderComponent)
│       │   ├── Name + address + status badge
│       │   └── Start / Est. End / Contact
│       │
│       ├── ── Section: Tasks ──
│       │   ├── TimelineSectionHeader [STICKY] ("Tasks", count, collapse toggle)
│       │   └── items: TimelineDayGroup[]   (reused unchanged)
│       │        └── TimelineTaskCard (reused unchanged)
│       │
│       ├── ── Section: Payments ──
│       │   ├── TimelineSectionHeader [STICKY] ("Payments", count, collapse toggle)
│       │   └── items: PaymentDayGroup[]
│       │        └── TimelinePaymentCard
│       │             └── Quick actions: View | Record Payment | Attach Doc
│       │
│       └── ── Section: Quotes ──
│           ├── TimelineSectionHeader [STICKY] ("Quotes", count, collapse toggle)
│           └── items: QuotationDayGroup[]
│                └── TimelineQuotationCard
│                     └── Tap → navigate to TaskDetails (quotation context)
```

---

## 7. Testing Strategy

### Unit tests

| Test file | Coverage |
|-----------|----------|
| `groupPaymentsByDay.test.ts` | Multiple payments same day; no-date payments; sorting by dueDate; empty input |
| `groupQuotationsByDay.test.ts` | Multiple quotations same day; sorting by date; empty input |
| `useTaskTimeline.test.ts` (renamed) | Existing task grouping tests pass unchanged after rename |
| `usePaymentsTimeline.test.ts` | Hook returns `paymentDayGroups`; `loading` reflects query state; `recordPayment` triggers `invalidations.paymentRecorded`; `truncated` flag set when >500 items |
| `useQuotationsTimeline.test.ts` | Hook returns `quotationDayGroups`; `loading`/`error` propagated correctly |

### Integration tests

| Test file | Scenarios |
|-----------|-----------|
| `ProjectDetailPayments.test.tsx` | Payments section renders collapsed by default; expanding reveals grouped payment cards; collapsing hides them with animation; `TimelineSectionHeader` renders with correct count badge; `recordPayment` quick action calls use-case and invalidates `projectPayments` key; `paymentsError` renders error message |

### Test stance

All unit tests use in-memory mocks (no SQLite). Integration tests use the existing `createInMemoryDb` test shim from `__tests__/utils/`. Drizzle migration tests are out of scope for this feature (schema is unchanged — `findByProjectId` on the payment table already exists and quotation join requires no schema change).

---

## 8. Out of Scope (v1)

- Full pagination / infinite scroll for very large projects (>500 items per section).
- `QuotationDetail` screen (quotation tap navigates to `TaskDetails` instead).
- Compact / expanded card density toggle.
- Persisting collapse state across app restarts.
- Payment creation from the timeline (record payment uses existing `RecordPaymentSheet` or a navigation flow).
