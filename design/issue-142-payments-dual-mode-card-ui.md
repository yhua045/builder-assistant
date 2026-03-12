# Design: Issue #142 — Payments Index: Dual-Mode Global View, Payment Card UI, Grouping & Search

**Status**: APPROVED  
**Author**: Copilot  
**Date**: 2026-03-12  
**GitHub Issue**: https://github.com/yhua045/builder-assistant/issues/142

---

## 1. User Stories

| # | Story |
|---|---|
| US-1 | As a Builder, I want each pending payment shown as a structured Payment Card so I can quickly read the contractor, amount, context label, and urgency at a glance. |
| US-2 | As a Builder, I want a "Firefighter" global mode that focus on the "overdue" or "soon to be due" payments across all active projects. |
| US-3 | As a Builder, I want a "Site Manager" per-project mode that groups payments into Contract vs Variation sections. |
| US-4 | As a Builder, I want to see a total "Amount Payable" banner in global mode so I know my total outstanding exposure. |
| US-5 | As a Builder, I want to search payments by subcontractor name across all projects in global mode. |

---

## 2. Acceptance Criteria

| # | Criterion |
|---|---|
| AC-1 | Each payment item is rendered as a `PaymentCard` with: project name header, contractor/subcontractor name, formatted currency amount, context label (e.g. "Contract: Frame Stage"), and a due-status footer (e.g. "Due in 2 days" in green / "OVERDUE 3 DAYS" in red). |
| AC-2 | A `SegmentedControl` at the top of the screen lets the user switch between **"The Firefighter"** (global) and **"The Site Manager"** (project-scoped). Selection is persisted in component state for the session. |
| AC-3 | In Firefighter mode, payments across all projects (status = `pending`) are shown, sorted by urgency (overdue first, then ascending due date). |
| AC-4 | In Firefighter mode, a prominent **Amount Payable** banner shows the sum of all pending payments (updated when search is applied). |
| AC-5 | In Site Manager mode, payments for the selected project are rendered in two collapsible sections: **"Contract"** and **"Variations"**, each with a section header and subtotal. |
| AC-6 | A search field is shown in Firefighter mode. It performs a case-insensitive partial match on `contractorName`. Results update reactively. |
| AC-7 | Payment Card footer colour reflects urgency: `overdue` → red text/background; `due-soon` (≤ 3 days) → amber; `on-time` → green. |
| AC-8 | New fields (`contractorName`, `paymentCategory`, `stageLabel`, `contactId`) are persisted via Drizzle and round-trip correctly. |
| AC-9 | Unit tests cover: amount-payable calculation, due-status derivation logic, contractor search filtering. Integration tests cover: global list query, grouped project query. |
| AC-10 | TypeScript strict mode passes with no new errors. |

---

## 3. Current State Analysis

### What already exists

| Concern | Current state |
|---|---|
| `Payment` entity | Has `id`, `projectId`, `invoiceId`, `contactId` (entity only, not DB), `amount`, `dueDate`, `status` (`pending`/`settled`). No `contractorName`, `paymentCategory`, or `stageLabel`. |
| `payments` DB table | 13 columns. `contact_id` is absent despite being on the entity. No `contractor_name`, `payment_category`, `stage_label`. |
| `PaymentRepository` | Has `list(filters)` supporting `projectId`, `status`, `isOverdue`, date range. No global (cross-project) aggregation or text search. |
| `ListPaymentsUseCase` | Works against `list()` with `preset` helpers. No global mode. |
| `usePayments` hook | Accepts optional `projectId`. Returns `overdue`, `upcoming`, `paid` arrays. No mode concept, no search, no grouping. |
| `payments/index.tsx` | Shows filter tabs (all/overdue/upcoming/paid) with flat card list. No segmented control, no grouping, no search. |
| `PaymentList.tsx` (dashboard) | Simple list; not reused on the payments index. |
| Last DB migration | `0010_workable_shard.sql` — next slot is **0011**. |

### Gaps to fill

1. **Schema**: `payments` table missing `contact_id`, `contractor_name`, `payment_category`, `stage_label`.
2. **Domain entity**: `Payment` missing `contractorName`, `paymentCategory`, `stageLabel`.
3. **Repository interface**: `PaymentFilters` missing `contractorSearch` and `paymentCategory`; no `getGlobalAmountPayable()` aggregate.
4. **Use cases**: No `ListGlobalPaymentsUseCase`; no `GetGlobalAmountPayableUseCase`.
5. **Hook**: `usePayments` needs dual-mode support and per-mode search.
6. **UI**: `PaymentCard` component needs rebuild; `SegmentedControl` and `AmountPayableBanner` are new; index screen needs full restructure.

---

## 4. Database Schema Changes

### 4.1 New columns on `payments` table

All are backward-compatible `ADD COLUMN` statements (nullable, no default forced on existing rows).

| Column | Type | SQLite type | Default | Notes |
|---|---|---|---|---|
| `contact_id` | `string` | `TEXT` | `NULL` | Soft FK to `contacts.id`; was on entity but never persisted. |
| `contractor_name` | `string` | `TEXT` | `NULL` | Denormalized display name for list performance — avoids a join to `contacts` at query time. Set when payment is created or resolved from Contact. |
| `payment_category` | `'contract' \| 'variation' \| 'other'` | `TEXT` | `'other'` | Grouping discriminator. Derived from linked task's `taskType` (via `invoice → task`) at payment-creation time and stored so the query layer can group without a join. |
| `stage_label` | `string` | `TEXT` | `NULL` | Free-text label shown on the card (e.g. "Frame Stage", "Patching"). Populated from task's `workType` or invoice description. |

### 4.2 Migration — `0011_payments_card_fields`

```sql
ALTER TABLE "payments" ADD COLUMN "contact_id"        text;
ALTER TABLE "payments" ADD COLUMN "contractor_name"   text;
ALTER TABLE "payments" ADD COLUMN "payment_category"  text NOT NULL DEFAULT 'other';
ALTER TABLE "payments" ADD COLUMN "stage_label"       text;
```

> All four are `ADD COLUMN` on a nullable or defaulted column — safe on SQLite without a rebuild.

---

## 5. Domain Layer Changes

### 5.1 `src/domain/entities/Payment.ts`

Extend the `Payment` interface with four new optional fields:

```ts
// Denormalized display fields (for list performance)
contractorName?: string;           // resolved from Contact.name or set explicitly
paymentCategory?: 'contract' | 'variation' | 'other';  // grouping discriminator
stageLabel?: string;               // e.g. "Frame Stage", "Patching"
// contactId already exists on entity — now properly persisted
```

No new entity classes needed; `PaymentEntity.create()` passes through all fields already via spread.

### 5.2 `src/domain/repositories/PaymentRepository.ts`

Extend `PaymentFilters` interface:

```ts
export interface PaymentFilters {
  // ... existing fields unchanged ...

  // New in #142
  contractorSearch?: string;        // case-insensitive partial match on contractor_name
  paymentCategory?: 'contract' | 'variation' | 'other';
  allProjects?: boolean;            // if true, ignores projectId and queries across all projects
}
```

Add one new aggregate method to `PaymentRepository`:

```ts
/** Sum of pending payment amounts globally (or filtered by search). */
getGlobalAmountPayable(contractorSearch?: string): Promise<number>;
```

---

## 6. Application Layer Changes

### 6.1 New Use Case — `ListGlobalPaymentsUseCase`

**File**: `src/application/usecases/payment/ListGlobalPaymentsUseCase.ts`

```ts
import { PaymentRepository, PaymentFilters, PaymentListResult } from '../../../domain/repositories/PaymentRepository';

export interface ListGlobalPaymentsRequest {
  contractorSearch?: string;
}

export class ListGlobalPaymentsUseCase {
  constructor(private readonly repo: PaymentRepository) {}

  async execute(req: ListGlobalPaymentsRequest): Promise<PaymentListResult> {
    const filters: PaymentFilters = {
      allProjects: true,
      status: 'pending',
      contractorSearch: req.contractorSearch,
    };
    return this.repo.list(filters);
    // Results should already be sorted by urgency (overdue first, then asc dueDate) in the repo.
  }
}
```

### 6.2 New Use Case — `GetGlobalAmountPayableUseCase`

**File**: `src/application/usecases/payment/GetGlobalAmountPayableUseCase.ts`

```ts
import { PaymentRepository } from '../../../domain/repositories/PaymentRepository';

export class GetGlobalAmountPayableUseCase {
  constructor(private readonly repo: PaymentRepository) {}

  async execute(contractorSearch?: string): Promise<number> {
    return this.repo.getGlobalAmountPayable(contractorSearch);
  }
}
```

### 6.3 Updated `usePayments` Hook

**File**: `src/hooks/usePayments.tsx`

Extend the public API:

```ts
export type PaymentsMode = 'firefighter' | 'site_manager';

export function usePayments(
  projectId?: string,
  repoOverride?: PaymentRepository
): { ... }  // existing shape; no breaking changes

// New overload / param extension:
export function usePaymentsV2(options: {
  mode: PaymentsMode;
  projectId?: string;        // required in site_manager mode
  contractorSearch?: string; // active in firefighter mode
  repoOverride?: PaymentRepository;
}): {
  // Firefighter mode
  globalPayments: Payment[];
  globalAmountPayable: number;
  // Site Manager mode (grouped)
  contractPayments: Payment[];
  variationPayments: Payment[];
  contractTotal: number;
  variationTotal: number;
  // Common
  overdue: Payment[];
  upcoming: Payment[];
  metrics: PaymentMetrics;
  loading: boolean;
  refresh: () => void;
}
```

> **Note**: `usePayments` (the original v1 signature) is kept unchanged to avoid breaking the existing dashboard widgets. The new `usePaymentsV2` is used exclusively by the redesigned payments index.

---

## 7. Infrastructure Layer Changes

### 7.1 `DrizzlePaymentRepository`

**File**: `src/infrastructure/repositories/DrizzlePaymentRepository.ts`

Changes required:

1. **`save()`** — add `contact_id`, `contractor_name`, `payment_category`, `stage_label` to INSERT.
2. **`update()`** — add the same four fields to UPDATE.
3. **Row mapper** (`rowToPayment` helper) — map new columns to entity fields.
4. **`list(filters)`** — handle two new filter keys:
   - `allProjects: true` → omit the `WHERE project_id = ?` clause.
   - `contractorSearch` → add `AND contractor_name LIKE '%?%'` (case-insensitive).
   - Sort order when `allProjects` is set: `ORDER BY CASE WHEN (status='pending' AND due_date < ?) THEN 0 ELSE 1 END, due_date ASC`.
5. **`getGlobalAmountPayable(contractorSearch?)`** — new method:

```sql
SELECT COALESCE(SUM(amount), 0)
FROM payments
WHERE status = 'pending'
  [AND contractor_name LIKE '%{search}%']
```

---

## 8. UI Layer Changes

### 8.1 New Component — `PaymentCard`

**File**: `src/components/payments/PaymentCard.tsx`

Props:
```ts
interface PaymentCardProps {
  payment: Payment & { projectName?: string }; // projectName resolved at hook level
  onPress?: () => void;
}
```

Layout (top → bottom):
```
┌──────────────────────────────────────────────────────┐
│  PROJECT NAME (muted, small caps)                    │
├──────────────────────────────────────────────────────┤
│  Contractor Name (bold)          $12,400.00 (bold)   │
│  [Contract: Frame Stage] label                       │
├──────────────────────────────────────────────────────┤
│  Footer: "OVERDUE 3 DAYS" (red) | "Due in 2 days"   │
└──────────────────────────────────────────────────────┘
```

Due-status derivation logic (pure function, easily unit-tested):

```ts
export function getDueStatus(dueDate: string): {
  text: string;
  style: 'overdue' | 'due-soon' | 'on-time';
} {
  const now = Date.now();
  const due = new Date(dueDate).getTime();
  const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));

  if (diffDays < 0)
    return { text: `OVERDUE ${Math.abs(diffDays)} DAY${Math.abs(diffDays) !== 1 ? 'S' : ''}`, style: 'overdue' };
  if (diffDays <= 3)
    return { text: `Due in ${diffDays} day${diffDays !== 1 ? 's' : ''}`, style: 'due-soon' };
  return { text: `Due in ${diffDays} days`, style: 'on-time' };
}
```

Style mapping: `overdue` → red, `due-soon` → amber, `on-time` → green.

### 8.2 New Component — `PaymentsSegmentedControl`

**File**: `src/components/payments/PaymentsSegmentedControl.tsx`

```ts
interface Props {
  value: PaymentsMode;
  onChange: (mode: PaymentsMode) => void;
}
```

Renders a two-segment pill control: **"🔥 The Firefighter"** | **"📋 The Site Manager"**.  
Uses NativeWind classes; no external segmented-control library required.

### 8.3 New Component — `AmountPayableBanner`

**File**: `src/components/payments/AmountPayableBanner.tsx`

Simple summary card shown only in Firefighter mode:
```
┌──────────────────────────────┐
│  TOTAL AMOUNT PAYABLE        │
│  $84,200.00      (large bold)│
└──────────────────────────────┘
```

### 8.4 Updated `payments/index.tsx`

Full redesign of the screen:

```
SafeAreaView
  ├── Header (title + ThemeToggle)
  ├── PaymentsSegmentedControl  ← new
  │
  ├── [Firefighter mode]
  │   ├── SearchInput (contractor name)
  │   ├── AmountPayableBanner (updates with search)
  │   └── ScrollView → PaymentCard[] (sorted by urgency)
  │
  └── [Site Manager mode]
      ├── ProjectPicker (existing selector)
      ├── Section: "Contract"  (total, collapsible)
      │   └── PaymentCard[]
      └── Section: "Variations" (total, collapsible)
          └── PaymentCard[]
```

The existing filter tabs (all/overdue/upcoming/paid) are superseded by the dual-mode design and removed.

---

## 9. Test Plan

### Unit Tests (`__tests__/unit/`)

| Test file | Covers |
|---|---|
| `payment/getDueStatus.test.ts` | All three branches of `getDueStatus()` including edge-case of exactly 0 days due |
| `payment/ListGlobalPaymentsUseCase.test.ts` | Global list with mock repo; validates `allProjects:true` is passed; validates contractor search is forwarded |
| `payment/GetGlobalAmountPayableUseCase.test.ts` | Sum calculation; returns 0 when no payments |
| `payment/amountPayableSummary.test.ts` | Utility sum function (if extracted) |

### Integration Tests (`__tests__/integration/`)

| Test file | Covers |
|---|---|
| `DrizzlePaymentRepository.global.test.ts` | `list({ allProjects: true })` across multiple inserted projects; asserts all returned |
| `DrizzlePaymentRepository.search.test.ts` | `contractorSearch` partial match (case-insensitive) |
| `DrizzlePaymentRepository.grouped.test.ts` | `list({ projectId, paymentCategory: 'contract' })` and `…'variation'` return correct subsets |
| `DrizzlePaymentRepository.globalTotal.test.ts` | `getGlobalAmountPayable()` sum and filtered sum |

---

## 10. File Change Summary

| File | Change type |
|---|---|
| `src/domain/entities/Payment.ts` | Extend interface with `contractorName`, `paymentCategory`, `stageLabel` |
| `src/domain/repositories/PaymentRepository.ts` | Extend `PaymentFilters`; add `getGlobalAmountPayable()` |
| `src/application/usecases/payment/ListGlobalPaymentsUseCase.ts` | **New** |
| `src/application/usecases/payment/GetGlobalAmountPayableUseCase.ts` | **New** |
| `src/hooks/usePaymentsV2.tsx` | **New** hook (v1 preserved) |
| `src/components/payments/PaymentCard.tsx` | **New** component |
| `src/components/payments/PaymentsSegmentedControl.tsx` | **New** component |
| `src/components/payments/AmountPayableBanner.tsx` | **New** component |
| `src/infrastructure/repositories/DrizzlePaymentRepository.ts` | Extend save/update/list/add getGlobalAmountPayable |
| `src/pages/payments/index.tsx` | Full redesign |
| `drizzle/migrations/0011_payments_card_fields.sql` | **New** migration |
| `src/infrastructure/database/schema.ts` | Add 4 new columns to `payments` table definition |
| `__tests__/unit/payment/getDueStatus.test.ts` | **New** |
| `__tests__/unit/payment/ListGlobalPaymentsUseCase.test.ts` | **New** |
| `__tests__/unit/payment/GetGlobalAmountPayableUseCase.test.ts` | **New** |
| `__tests__/integration/DrizzlePaymentRepository.*.test.ts` (×4) | **New** |

---

## 11. Open Questions

1. **Project name resolution**: The `Payment` entity only has `projectId`. Should `usePaymentsV2` join to `ProjectRepository` to resolve `projectName` for the card header, or should a denormalized `projectName` also be added to the `Payment` entity? *(Recommendation: resolve at hook level via a `ProjectRepository.findById()` lookup — avoids widening the schema further.)* **A** we can update usePayment to perform the lookup or use the DTO at the usePayment level to resolve the project name. I would avoid adding projectName to the Payment entity as it is not a core property of the payment and can be resolved at the application layer. This keeps the domain model clean and focused on core properties.
2. **Analytics events**: Issue mentions adding analytics when switching modes and using search. Is there an existing analytics service/hook to call, or is this out of scope for this ticket? ***A** this is a new service, there is no existing implementation.
3. **Collapsible sections**: The issue marks collapsible Contract/Variation sections as "optional UX improvement". Should this be in scope for the initial implementation or deferred? **A** in scope.
4. **"Pay Now" CTA**: The current index screen has a "Pay Now" button. Should this be retained on the new `PaymentCard`, or is payment recording out of scope here (separate from the display improvements)? **A** in scope — we can add a "Pay Now" button to the card footer, which opens the existing payment recording flow. This maintains the core functionality while enhancing the UI.
