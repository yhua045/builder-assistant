# Design: Issue #188 — Payments Screen: Quotations, Pending Payments & Priority Ordering

**Status**: DRAFT — Awaiting LGTB Approval  
**Author**: Architect Agent  
**Date**: 2026-03-30  
**GitHub Issue**: #188  
**Branch**: `feature/issue-188-payments-screen`

---

## 1. User Stories

| # | Story |
|---|---|
| US-1 | As a Builder, I want a single horizontal filter bar in the Payments screen with the options **Quotations**, **Pending**, **Paid**, and **All** so I can quickly switch views without nested navigation. |
| US-2 | As a Builder, the default selection should be **Pending** so I immediately see what I owe, sorted by urgency. |
| US-3 | As a Builder, selecting **Quotations** shows all my quotations across projects at a glance. |
| US-4 | As a Builder, selecting **Paid** shows settled payments sorted by paid date (newest first) so I can review recent payments. |
| US-5 | As a Builder, I can still search by contractor/vendor name to narrow down the visible list. |

---

## 2. Acceptance Criteria

| # | Criterion |
|---|---|
| AC-1 | A single **horizontal filter bar** is shown at the top of the Payments screen with four options (pills): **Quotations \| Pending \| Paid \| All**. Default selection is **Pending**. |
| AC-2 | **Pending** shows invoice-payable synthetic rows + standalone pending DB rows sorted by payment priority: overdue (most overdue first) → due-soon → due-in-x-days → no-due-date last. |
| AC-3 | **Paid** shows settled DB payment rows only, sorted by `date` (paid date) descending (newest first). |
| AC-4 | **All** shows pending rows (priority-sorted) followed by paid rows (paid-date-desc). |
| AC-5 | **Quotations** shows all non-deleted quotations globally, sorted by `date` descending. Each card shows reference, vendor name, total, status badge, and expiry date. |
| AC-6 | `AmountPayableBanner` is visible only for **Pending** and **All** filter states; hidden for **Paid** and **Quotations**. |
| AC-7 | A single contractor/vendor search bar is always visible beneath the filter bar. It filters the visible list in real time, case-insensitively, against `contractorName` (Pending/Paid/All) or `vendorName` (Quotations). |
| AC-8 | Each filter option has a sensible empty-state message when the list is empty. |
| AC-9 | The existing `PaymentsSegmentedControl` ("The Firefighter" / "The Site Manager") is **removed** from the Payments screen. The Firefighter behaviour (global pending view) becomes the **Pending** default state. |
| AC-10 | `sortByPaymentPriority(payments)` is a pure utility exported for unit testing. Paid-date sort is also a named pure utility. |
| AC-11 | Unit tests cover: priority ordering rule, paid-date ordering, `useGlobalPaymentsScreen` filter state transitions, `GlobalQuotationCard` rendering, `PaymentsFilterBar` rendering all 4 options. |
| AC-12 | TypeScript strict mode passes (`npx tsc --noEmit`) with no new errors. |

---

## 3. Current State Analysis

### What already exists

| Concern | Current state |
|---|---|
| `PaymentsScreen` (`pages/payments/index.tsx`) | Shows Firefighter/Site Manager segmented control + contractor search + `AmountPayableBanner` + flat `PaymentCard` list. |
| `usePayments` hook | Dual-mode (firefighter/site_manager). Firefighter queries invoice payables + standalone pending rows. No paid-only query. |
| `PaymentsSegmentedControl` | Firefighter / Site Manager 2-way toggle (to be removed). |
| `ListGlobalPaymentsUseCase` | Lists global pending payments. Status hardcoded to `'pending'`. |
| `PaymentCard` | Renders contractor name + amount + context label + due-status footer. Sufficient for pending. |
| `QuotationCard` | Rich card for project-level quotation timeline. Used in `TaskQuotationSection`. |
| `useQuotations` hook | Imperative CRUD wrapper. Has `taskId`-scoped reactive query but **no** global reactive query. |
| `ListQuotationsUseCase` | Accepts `QuotationFilterParams` — already supports global list (no projectId required). |
| `PaymentRepository.list()` | Supports `status: 'pending' \| 'settled'`, `allProjects: true`. Paid-global query is achievable with `allProjects: true, status: 'settled'`. |
| `getDueStatus` util | Pure function: overdue / due-soon / on-time. Used for display. |
| Navigation | `PaymentsNavigator` uses a native stack: `PaymentsList` → `PaymentDetails`. Unchanged. |

### Gaps to fill

1. **No single flattened filter bar** — only a 2-way Firefighter/Site Manager toggle exists today; no Quotations/Pending/Paid/All option.
2. **`ListGlobalPaymentsUseCase`** hardcodes `status: 'pending'`; needs `status` param.
3. **No `sortByPaymentPriority` utility** — current firefighter mode sorts implicitly in the repo/hook.
4. **No global reactive quotations query** — `useQuotations` is task-scoped.
5. **No `GlobalQuotationCard`** component — existing `QuotationCard` is too rich (has Accept/Reject actions) for a global read-only list.
6. **No `PaymentsFilterBar`** (4-option: Quotations | Pending | Paid | All) component.

---

## 4. Architecture Design

### 4.1 Dependency Flow (unchanged)

```
PaymentsScreen
  └── useGlobalPaymentsScreen   (hook, UI state + data)
        ├── useGlobalQuotations (hook, TanStack query)         (quotations filter)
        │     └── ListQuotationsUseCase   (application)
        │           └── QuotationRepository (domain interface)
        ├── usePayments (existing, firefighter mode)           (pending filter)
        └── ListGlobalPaymentsUseCase (extended for settled)   (paid filter)
              └── PaymentRepository  (domain interface)
```

### 4.2 Layer-by-Layer Changes

#### Domain (no changes)
- `Payment` entity — no changes
- `Quotation` entity — no changes
- `PaymentRepository` interface — no changes (already supports `status: 'settled'` + `allProjects: true`)
- `QuotationRepository` interface — no changes (already has `listQuotations()`)

#### Application Layer

**Modified**: `src/application/usecases/payment/ListGlobalPaymentsUseCase.ts`

Add optional `status` parameter (default `'pending'` to preserve backward compat):

```typescript
export interface ListGlobalPaymentsRequest {
  contractorSearch?: string;
  status?: 'pending' | 'settled';  // NEW — defaults to 'pending'
}
```

No new use cases required — `ListQuotationsUseCase` is sufficient for the Quotations tab.

#### Utility Layer

**New**: `src/utils/sortByPaymentPriority.ts`

```typescript
/**
 * Sorts payments by urgency: ascending due date (overdue first as they have
 * past dates), with no-due-date items trailing at the end.
 */
export function sortByPaymentPriority(payments: Payment[]): Payment[] {
  return [...payments].sort((a, b) => {
    const aMs = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const bMs = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    return aMs - bMs;
  });
}

/**
 * Sorts settled payments by paid date descending (newest first).
 */
export function sortByPaidDateDesc(payments: Payment[]): Payment[] {
  return [...payments].sort((a, b) => {
    const aMs = a.date ? new Date(a.date).getTime() : 0;
    const bMs = b.date ? new Date(b.date).getTime() : 0;
    return bMs - aMs;
  });
}
```

#### Hook Layer

**New**: `src/hooks/useGlobalQuotations.ts`

Reactive TanStack Query hook for the Quotations tab:

```typescript
export interface UseGlobalQuotationsOptions {
  vendorSearch?: string;
}

export interface UseGlobalQuotationsReturn {
  quotations: Quotation[];   // sorted: date desc
  loading: boolean;
  refresh: () => void;
}
```

- Uses `queryKeys.globalQuotations(vendorSearch)` cache key.
- Calls `ListQuotationsUseCase.execute({ limit: 500 })` then filters by `vendorSearch` in-memory (same pattern as contractor search in `usePayments`).
- Sorts by `date` descending after fetching.
- `staleTime: Infinity` (consistent with other queries in the app).

**New**: `src/hooks/useGlobalPaymentsScreen.ts`

Combined screen-state hook that drives `PaymentsScreen`:

```typescript
export type PaymentsFilterOption = 'quotations' | 'pending' | 'paid' | 'all';

export interface UseGlobalPaymentsScreenReturn {
  // Filter state (single flattened control)
  filter: PaymentsFilterOption;             // default: 'pending'
  setFilter: (option: PaymentsFilterOption) => void;

  // Search
  search: string;
  setSearch: (q: string) => void;

  // Quotations (filter === 'quotations')
  quotations: Quotation[];

  // Payments (filter === 'pending' | 'paid' | 'all')
  pendingPayments: PaymentWithProject[];   // priority-sorted
  paidPayments: Payment[];                 // paid-date-desc sorted
  amountPayable: number;                   // sum of pending amounts

  // Loading / refresh
  loading: boolean;
  refresh: () => void;
}
```

Internally:
- Delegates quotations data to `useGlobalQuotations({ vendorSearch: search })`.
- Delegates pending payments to existing `usePayments({ mode: 'firefighter', contractorSearch: search })`.
- For paid payments: calls `ListGlobalPaymentsUseCase.execute({ status: 'settled', contractorSearch: search })` via a separate TanStack query.
- `pendingPayments` passed through `sortByPaymentPriority`.
- `paidPayments` passed through `sortByPaidDateDesc`.
- No separate `activeTab` state — the single `filter` value drives everything.

**Modified**: `src/hooks/queryKeys.ts`

Add:
```typescript
globalQuotations: (vendorSearch?: string) =>
  (vendorSearch ? ['quotations', 'global', vendorSearch] : ['quotations', 'global']) as readonly string[],
paidPaymentsGlobal: (contractorSearch?: string) =>
  (contractorSearch ? ['payments', 'paid', contractorSearch] : ['payments', 'paid']) as readonly string[],
```

#### Component Layer

**New**: `src/components/payments/PaymentsFilterBar.tsx`

Single flattened 4-option horizontal filter bar (Quotations | Pending | Paid | All):
- Four pill segments rendered as `TouchableOpacity`.
- Active segment has `bg-card` rounded-lg shadow-sm; inactive is transparent.
- Uses `NativeWind` classes consistent with `PaymentsSegmentedControl` styling convention.
- Replaces both `PaymentsSegmentedControl` and the removed two-level tab/toggle pattern.

```typescript
interface PaymentsFilterBarProps {
  value: PaymentsFilterOption;
  onChange: (option: PaymentsFilterOption) => void;
}
```

**New**: `src/components/payments/GlobalQuotationCard.tsx`

Compact read-only card for the global quotations list:
- Structure mirrors `PaymentCard`: rounded card, header with project name (if present), body with vendor name + reference, amount, status badge footer.
- Status badge colours consistent with `QuotationCard.STATUS_CONFIG` (`draft` = muted, `sent` = blue, `accepted` = green, `declined` = red).
- Tap navigates to `QuotationDetail` (if available) — for now opens the project's quotation detail via navigation.

```typescript
interface GlobalQuotationCardProps {
  quotation: Quotation;
  projectName?: string;
  onPress?: () => void;
}
```

**Removed**: `src/components/payments/PaymentsSegmentedControl.tsx` — replaced by `PaymentsFilterBar.tsx`.

#### Screen Layer

**Modified**: `src/pages/payments/index.tsx`

Complete refactor of `PaymentsScreen`:

```
PaymentsScreen
├── SafeAreaView
├── Header (Finances title + ThemeToggle)
├── PaymentsFilterBar  ← NEW single flattened filter (Quotations | Pending | Paid | All)
├── Search bar (contractor/vendor search)
├── [IF filter === 'pending' or 'all'] AmountPayableBanner
└── ScrollView
    ├── [IF filter === 'quotations'] GlobalQuotationCard × n  (or EmptyState)
    └── [IF filter === 'pending' | 'paid' | 'all'] PaymentCard × n  (or EmptyState)
```

---

## 5. UI Design (Mobile-UI Consultation)

> **Consultation notes**: The following UI decisions were derived from reviewing existing screen conventions (`PaymentsSegmentedControl`, `PaymentCard`, `QuotationCard`, NativeWind class patterns) and the mobile-ui agent's guidance on consistent patterns in this codebase.

### 5.1 PaymentsFilterBar Design

A single horizontal pill bar replaces both the old two-level tab/toggle pattern. It sits **between the title row and the search bar**, consistent with how `PaymentsSegmentedControl` was placed.

```
┌─────────────────────────────────────────────────┐
│  Finances                           ☀️           │
│ ┌────────────┬──────────┬──────┬───────┐         │
│ │ Quotations │ Pending● │ Paid │  All  │         │
│ └────────────┴──────────┴──────┴───────┘         │
│ 🔍 Search contractor / vendor...    ✕            │
└─────────────────────────────────────────────────┘
```

- Pill container: `bg-muted rounded-xl p-1 flex-row h-11` (same as `PaymentsSegmentedControl`)
- Active segment: `bg-card rounded-lg shadow-sm`
- Text: `text-sm font-semibold`
- 4 equal-width segments; each is a `TouchableOpacity flex-1 items-center justify-center`.

### 5.2 GlobalQuotationCard Design

```
┌────────────────────────────────────────┐
│  Sunrise Renovation Project            │  ← muted project header (optional)
│─────────────────────────────────────────│
│  Mitchell Plastering Co.    AUD 8,200  │  ← vendor + amount
│  QT-2026-031                           │  ← reference
│─────────────────────────────────────────│
│  🟡 Pending         Exp: 15 Apr 2026  │  ← status badge + expiry
└────────────────────────────────────────┘
```

- Mirrors `PaymentCard` structure.
- Footer: status badge on left + expiry on right.

### 5.3 Empty States

| Filter | Message |
|---|---|
| Quotations, no results | "No quotations yet. Add one from a project or task." |
| Quotations, search empty | "No quotations match that vendor name." |
| Pending, no results | "All clear — no pending payments right now." |
| Paid, no results | "No paid payments recorded yet." |
| All, no results | "No payments found." |

### 5.4 AmountPayableBanner Visibility

- Visible only when `filter === 'pending'` or `filter === 'all'`.
- Hidden for `filter === 'paid'` and `filter === 'quotations'`.

---

## 6. Test Plan

### 6.1 Unit Tests (new)

| File | What it tests |
|---|---|
| `__tests__/unit/payment/sortByPaymentPriority.test.ts` | Pure priority sort: overdue first, ascending due date, no-date last. |
| `__tests__/unit/payment/sortByPaidDateDesc.test.ts` | Pure paid-date sort: newest first, no-date first. |
| `__tests__/unit/useGlobalPaymentsScreen.test.tsx` | `filter` state transitions (all 4 options), `amountPayable` derivation, search passthrough. |
| `__tests__/unit/useGlobalQuotations.test.tsx` | Reactive query, vendor search filtering, sorting by date desc. |
| `__tests__/unit/GlobalQuotationCard.test.tsx` | Renders vendor name, amount, status badge, expiry date; onPress fires. |
| `__tests__/unit/PaymentsFilterBar.test.tsx` | Renders all 4 options; active option highlighted; onChange fires with correct value. |
| `__tests__/unit/ListGlobalPaymentsUseCase.paid.test.ts` | Extends existing test: `status: 'settled'` forwarded to repo filters. |

### 6.2 Regression Tests (existing, must stay green)
- `__tests__/unit/payment/ListGlobalPaymentsUseCase.test.ts` — ensure backward compat (default `status: 'pending'`)
- `__tests__/unit/payment/getDueStatus.test.ts` — unchanged util
- `__tests__/unit/PaymentEntity.test.ts` — entity unchanged
- `__tests__/unit/useQuotations.test.tsx` — hook unchanged

### 6.3 Test Acceptance Criteria

| # | Criterion |
|---|---|
| T-1 | `sortByPaymentPriority` places overdue items (dueDate < today) before future items, ascending by dueDate. Items with no dueDate trail. |
| T-2 | `sortByPaidDateDesc` places newest `date` first; items without `date` sort to the end. |
| T-3 | `useGlobalPaymentsScreen` with `filter='pending'` returns only pending rows; `filter='paid'` returns only settled rows; `filter='all'` returns both; `filter='quotations'` returns quotations list. |
| T-4 | `useGlobalQuotations` with no vendorSearch returns all quotations sorted `date` desc; with vendorSearch returns matching subset. |
| T-5 | `GlobalQuotationCard` snapshot renders correctly for each status value. |
| T-6 | `ListGlobalPaymentsUseCase` still calls `repo.list` with `status: 'pending'` when no status provided (backward compat). |
| T-7 | `PaymentsFilterBar` renders all 4 pill options; pressing each calls `onChange` with the correct `PaymentsFilterOption` value. |

---

## 7. File Change Summary

### New Files

| Path | Purpose |
|---|---|
| `src/utils/sortByPaymentPriority.ts` | Pure priority sort + paid-date sort utilities |
| `src/components/payments/PaymentsFilterBar.tsx` | Single 4-option flattened filter bar (Quotations/Pending/Paid/All) |
| `src/components/payments/GlobalQuotationCard.tsx` | Global list quotation card |
| `src/hooks/useGlobalQuotations.ts` | Reactive global quotations hook |
| `src/hooks/useGlobalPaymentsScreen.ts` | Screen-level combined state + data hook |
| `__tests__/unit/payment/sortByPaymentPriority.test.ts` | Failing test: priority ordering |
| `__tests__/unit/payment/sortByPaidDateDesc.test.ts` | Failing test: paid-date ordering |
| `__tests__/unit/useGlobalPaymentsScreen.test.tsx` | Failing test: screen hook |
| `__tests__/unit/useGlobalQuotations.test.tsx` | Failing test: quotations hook |
| `__tests__/unit/GlobalQuotationCard.test.tsx` | Failing test: card component |
| `__tests__/unit/PaymentsFilterBar.test.tsx` | Failing test: 4-option filter bar component |
| `__tests__/unit/ListGlobalPaymentsUseCase.paid.test.ts` | Failing test: status param |

### Modified Files

| Path | Change |
|---|---|
| `src/application/usecases/payment/ListGlobalPaymentsUseCase.ts` | Add optional `status` param (default `'pending'`) |
| `src/pages/payments/index.tsx` | Full refactor to tabbed screen using new hooks/components |
| `src/hooks/queryKeys.ts` | Add `globalQuotations` and `paidPaymentsGlobal` key factories |

### Removed Components

| Path | Reason |
|---|---|
| `src/components/payments/PaymentsSegmentedControl.tsx` | Replaced by `PaymentsFilterBar` (4-option single filter bar) |

---

## 8. Out of Scope

- **No DB schema changes** — existing `payments` and `quotations` tables are sufficient.
- **No new navigation routes** — payment detail and quotation detail flows are unchanged.
- **Site Manager mode** (per-project grouping) — remains available in `usePayments` for the project detail timeline but is removed from the Finances screen tab bar.
- **Quotation create/edit flow** — existing `QuotationScreen` modal is unchanged.
- **Pagination** — global lists use `limit: 500` (consistent with existing app-wide approach).

---

## 9. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| `buildInvoicePayables` logic in `usePayments` is complex; reuse might be tricky | Extract as a shared utility function in a follow-up, or import it directly from `usePayments` for now. |
| Paid payment query via `PaymentRepository.list({ allProjects: true, status: 'settled' })` may be slow | Repository already has an indexed `status` column from issue #142; acceptable for ≤500 rows. |
| Removing `PaymentsSegmentedControl` breaks any existing import | One import site (`pages/payments/index.tsx`); replace in same PR. No other consumers. |
| `useGlobalQuotations` adds a new TanStack query that may conflict with `queryKeys.quotations()` | Use distinct key prefix `['quotations', 'global', ...]` to avoid collisions. |

---

## 10. Definition of Done

- [ ] All new failing tests are written before implementation begins (TDD).
- [ ] All tests pass (no regressions; 7 existing pre-existing failures in `QuotationEntity.validation` remain but are pre-existing).
- [ ] `npx tsc --noEmit` passes.
- [ ] Payments screen renders a single flattened `PaymentsFilterBar` (Quotations | Pending | Paid | All), defaults to Pending.
- [ ] Priority ordering: overdue → due-soon → due-later → no-date.
- [ ] Paid filter shows settled payments newest-first.
- [ ] Quotations filter shows global quotations list, searchable by vendor name.
- [ ] `PaymentsSegmentedControl` removed and `PaymentsFilterBar` (4-option) renders correctly.
- [ ] `progress.md` updated with summary of changes.
