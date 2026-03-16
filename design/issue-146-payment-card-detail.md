# Design: Issue #146 — Payment Card Detail (Due Date Sourcing + Clickable Card → Payment Details)

**Status**: APPROVED
**Author**: Copilot
**Date**: 2026-03-16
**GitHub Issue**: https://github.com/yhua045/builder-assistant/issues/146

---

## 0. Unified Display DTO — Payment Row Source Model

The Payments list renders a single card type (`PaymentCard`) regardless of where the underlying data came from. The `Payment` interface acts as the **unified display DTO**. Three distinct sources feed into it:

| Source | `payment.id` | Origin | Persisted? | Typical status |
|---|---|---|---|---|
| **Real settled payment** | `pay_<timestamp>_<random>` | `payments` DB table | ✅ Yes | `settled` |
| **Real pending payment** | `pay_<timestamp>_<random>` | `payments` DB table | ✅ Yes | `pending` |
| **Synthetic invoice-payable row** | `invoice-payable:<invoiceId>` | Constructed in-memory by `buildInvoicePayables()` from an `Invoice` record | ❌ No — never written to DB | `pending` |

The synthetic row exists because an outstanding invoice represents a financial obligation that must appear on the payments list even before the builder has explicitly recorded a payment transaction against it. It is assembled from `Invoice` fields and discarded after the render cycle.

**De-duplication rule** (already in `buildInvoicePayables`): a synthetic row is only generated for an invoice if *no real `pending` payment already exists* for that invoice. When real pending payment records exist (e.g. an agreed staged-payment schedule), they cover the obligation and the synthetic row is suppressed.

**Materialisation**: when the user taps "Mark as Paid" on a synthetic row, `MarkPaymentAsPaidUseCase` creates a real `Payment` record in the DB for the first time — this is the moment the synthetic row is "materialised" into a persisted transaction.

---

## 1. Scope Overview

This issue covers two distinct but related areas:

| Part | Summary |
|---|---|
| **A — Due Date Sourcing** | For payment cards that are linked to an invoice, show the due date from the invoice (not from the payment row). Add fallback logic, handle `draft`/`cancelled` invoice states, and protect against cancelling invoices that have payments. |
| **B — Payment Card Interactivity** | Make every payment card tappable. Tapping opens a `PaymentDetails` screen. Settled payments are read-only. Pending payments offer a "Mark as Paid" action that creates an internal settled transaction. |

---

## 2. User Stories

| # | Story |
|---|---|
| US-1 | As a Builder, I want the due date on a payment card to reflect the actual invoice due date so I can trust the urgency indicator. |
| US-2 | As a Builder, I want to see a warning (red highlight) on a payment card when its linked invoice has been cancelled so I know action is required. |
| US-3 | As a Builder, I want to tap a payment card to view its full details including the project name, linked invoice, reference number, notes, and line items. |
| US-4 | As a Builder, I want to mark a pending payment as paid from the details screen and have that action create a traceable internal transaction record. |
| US-5 | As a Builder, I cannot cancel an invoice if settled payments already exist against it — the system must warn me and block or guide me to reverse the payments first. |
| US-6 | As a Builder, I want to see on a payment's detail screen how much of the linked invoice has already been paid (across all staged payments) so I know the remaining obligation. |
| US-7 | As a Builder, I want the default due date period (used when no explicit due date is set) to reflect my project's payment terms, not a hard-coded constant. |

---

## 3. Acceptance Criteria

### Part A — Due Date Sourcing

| # | Criterion |
|---|---|
| AC-A1 | For any payment row linked to an invoice (`payment.invoiceId` or `id` prefix `invoice-payable:`), the displayed due date is resolved in this priority order: `invoice.dateDue` → `invoice.dueDate` → `invoice.metadata?.dueDate` → calculated fallback (task `startDate` or today + project's `defaultDueDateDays`, defaulting to 5 working days). |
| AC-A2 | Synthetic rows produced by `buildInvoicePayables()` have their `dueDate` field set using the same priority order before being returned to the hook. No second lookup is needed in the render layer. |
| AC-A3 | Legacy/standalone payments (no `invoiceId`) continue to use `payment.dueDate` → `payment.date` → show `N/A`. |
| AC-A4 | Payments linked to a `draft` or `cancelled` invoice do NOT display a due date. Instead the `PaymentCard` renders a red-highlighted warning banner: *"Invoice [status]"* (e.g. "Invoice cancelled"). The card body is also visually flagged (red border or red tint background). |
| AC-A5 | Stored UTC date values are never mutated. All date resolution logic is display-only. |
| AC-A6 | Date display uses existing `formatDate` / locale utilities — no new date-formatting code is introduced. |

### Part A — Invoice Cancellation Guard

| # | Criterion |
|---|---|
| AC-A7 | `InvoiceEntity` exposes a `canBeCancelled(linkedPayments: Payment[]): { allowed: boolean; reason?: string }` method. |
| AC-A8 | `canBeCancelled` returns `{ allowed: false, reason: 'Invoice has settled payments. Reverse all payments before cancelling.' }` when any linked payment has `status === 'settled'`. |
| AC-A9 | The existing or forthcoming invoice update pathway calls this guard before allowing a status transition to `cancelled`. If blocked, it throws a domain error rather than persisting the change. |
| AC-A10 | A reverse-payment path is documented (but NOT implemented in this issue) — the guard message references it as the resolution step. Implementation is deferred to a follow-up issue. |

### Part B — Navigation & Payment Details Screen

| # | Criterion |
|---|---|
| AC-B1 | The `Finances` tab uses a new `PaymentsNavigator` (a `NativeStackNavigator`) wrapping `PaymentsScreen` (as `PaymentsList`) and the new `PaymentDetails` screen. The existing `PaymentsScreen` component is unchanged. |
| AC-B2 | Tapping any `PaymentCard` navigates to `PaymentDetails` with either `{ paymentId: string }` (real payment) or `{ syntheticRow: Payment }` (synthetic `invoice-payable:` row passed as navigation params). |
| AC-B3 | `PaymentDetails` fetches and displays: payment fields (amount, date, due date, reference, notes, method), linked invoice summary (invoice number, issuer, invoice total, **amount paid so far across all linked payments**, **remaining outstanding**, status), linked project name (if available). |
| AC-B4 | If `payment.status === 'settled'`: all fields are read-only; a green "Settled" badge with `settledAt` date is shown; "Mark as Paid" is hidden. |
| AC-B5 | If `payment.status === 'pending'`: a prominent "Mark as Paid" button is shown. Tapping it opens a confirmation modal pre-filled with the **outstanding amount** (invoice total minus sum of all settled payments) and a `note` field (optional). The user may edit the amount downward for a partial payment. Confirming creates a settled `Payment` record via `MarkPaymentAsPaidUseCase`. |
| AC-B6 | For synthetic rows (`invoice-payable:`), "Mark as Paid" creates a **new** real `Payment` linked to `invoiceId`. The synthetic row is NOT mutated. If the amount recorded is less than the full outstanding, the invoice `paymentStatus` is updated to `partial` and the synthetic row will reappear on the list for the remaining amount on next refresh. |
| AC-B6a | For an invoice with **multiple staged payments** (several real `pending` records), `PaymentDetails` for each individual payment shows the per-payment amount; the invoice summary section shows the aggregate (total, paid-to-date, remaining). Each payment stage is settled independently. |
| AC-B7 | If the linked invoice cannot be found, `PaymentDetails` still renders the payment fields and shows a muted warning "Invoice not found". "Mark as Paid" is still available. |
| AC-B8 | Concurrent conflict detection: if the payment was settled by another user while details are open, the screen detects the mismatch on re-focus and transitions to the settled read-only state with a conflict banner. |
| AC-B9 | `createdAt` and optionally `note` are stored on the new settled payment record. |
| AC-B10 | TypeScript strict mode passes with no new errors. |

---

## 4. Current State Analysis

| Concern | Current state | Gap |
|---|---|---|
| `buildInvoicePayables()` | Sets `dueDate: inv.dateDue ?? inv.dueDate` (2-field lookup only, no metadata fallback, no working-day fallback) | Add `metadata?.dueDate` and working-day fallback |
| `PaymentCard.tsx` | Reads `payment.dueDate` directly; no special handling for cancelled/draft invoice state | Add invoice-status awareness; add red highlight path |
| `PaymentsScreen` in `TabsLayout` | Registered directly as a Tab screen — no stack navigator | Wrap in `PaymentsNavigator` |
| `PaymentDetails` screen | Does not exist | Create from scratch |
| `MarkPaymentAsPaidUseCase` | Does not exist | Create |
| `InvoiceEntity` cancellation guard | Does not exist | Add `canBeCancelled()` method |
| Navigation params typing | No `PaymentsStackParamList` type | Add |

---

## 5. Architecture & File Plan

### 5.1 New Files

| File | Purpose |
|---|---|
| `src/pages/payments/PaymentsNavigator.tsx` | Stack navigator wrapping Payments list + details |
| `src/pages/payments/PaymentDetails.tsx` | Payment details screen (read-only + mark-as-paid) |
| `src/application/usecases/payment/MarkPaymentAsPaidUseCase.ts` | Creates a settled payment record; updates invoice status |
| `src/utils/workingDays.ts` | `addWorkingDays(date: Date, days: number): Date` (Mon–Fri, no public holidays) |
| `src/application/usecases/invoice/CancelInvoiceUseCase.ts` | Guards invoice cancellation against existing settled payments |

### 5.2 Modified Files

| File | Change |
|---|---|
| `src/domain/entities/Invoice.ts` | Add `canBeCancelled(linkedPayments: Payment[]): { allowed: boolean; reason?: string }` to `InvoiceEntity` |
| `src/domain/entities/Project.ts` | Add optional `defaultDueDateDays?: number` field |
| `src/infrastructure/database/schema.ts` | Add `defaultDueDateDays` column to `projects` table |
| `src/hooks/usePayments.ts` | Update `buildInvoicePayables()`: use `resolveInvoiceDueDate` with project's `defaultDueDateDays`; set `invoiceStatus` on synthetic rows |
| `src/components/payments/PaymentCard.tsx` | Accept optional `invoiceStatus` prop; render red-flagged state for draft/cancelled |
| `src/pages/tabs/index.tsx` | Replace `PaymentsScreen` import with `PaymentsNavigator` |

### 5.3 Schema Changes

One small addition to the `projects` table is needed to support the configurable due-date period:

| Table | Column | Type | Default | Notes |
|---|---|---|---|---|
| `projects` | `default_due_date_days` | `INTEGER` | `5` | Working days added to the anchor date when no explicit due date exists on an invoice. |

This requires a new Drizzle migration. The `Project` domain entity gains a corresponding optional field `defaultDueDateDays?: number`.

All other changes are display-layer or use-case logic only. No changes to the `payments` or `invoices` tables.

---

## 6. Detailed Design

### 6.1 Due Date Resolution Helper

A pure utility function that encapsulates the resolution priority:

```ts
// src/utils/resolveInvoiceDueDate.ts
import { Invoice } from '../domain/entities/Invoice';
import { addWorkingDays } from './workingDays';

/**
 * Resolves the display due date for a payment linked to an invoice.
 * Priority: dateDue → dueDate → metadata.dueDate → anchor + dueDatePeriodDays working days
 *
 * @param invoice            The linked invoice record.
 * @param taskStartDate      Optional start date of the linked task (used as fallback anchor).
 * @param dueDatePeriodDays  Project-level configurable period; defaults to 5 working days.
 */
export function resolveInvoiceDueDate(
  invoice: Invoice,
  taskStartDate?: string | null,
  dueDatePeriodDays: number = 5,
): string | undefined {
  if (invoice.dateDue) return invoice.dateDue;
  if (invoice.dueDate) return invoice.dueDate;
  const metaDue = invoice.metadata?.dueDate;
  if (typeof metaDue === 'string' && metaDue) return metaDue;

  // Fallback: anchor date + project-configured working days
  const anchor = taskStartDate ? new Date(taskStartDate) : new Date();
  return addWorkingDays(anchor, dueDatePeriodDays).toISOString();
}
```

### 6.2 `buildInvoicePayables()` Changes

Current code already sets `dueDate: inv.dateDue ?? inv.dueDate`. The update:

1. Accept a `projectDueDateDays: number` parameter (fetched per-project from `Project.defaultDueDateDays ?? 5`) and pass it to `resolveInvoiceDueDate(inv, task?.startDate, projectDueDateDays)`.
2. Also pass `invoiceStatus: inv.status` into the synthetic payment object so `PaymentCard` can inspect it without a second lookup.

Because `buildInvoicePayables` already has an optional `taskRepo` parameter (used for contractor name lookup), the task startDate is available when the task is already fetched. The hook resolves per-project `defaultDueDateDays` from the project map it already builds for project names, so no additional repo call is needed.

**Staged-payment / multi-payment handling**: The existing `hasPendingLegacyPayable` guard (skip invoice if a real `pending` payment record already exists) remains correct — those real pending records represent the agreed staged schedule and appear directly in the list. The synthetic row is only generated for invoices with **no existing pending records** (i.e. an outstanding invoice not yet entered into the payment schedule). The outstanding-amount calculation (invoice.total − sum of settled payments) already handles partial payment correctly.

The synthetic `Payment` object now carries one extra field:

```ts
// Existing Payment interface extension needed:
invoiceStatus?: Invoice['status'];  // 'draft' | 'issued' | 'paid' | 'overdue' | 'cancelled'
```

This field is **display-only** — it lives in the Payment entity as an optional field alongside the existing `invoiceId`.

### 6.3 `PaymentCard.tsx` Changes

The card accepts an optional `invoiceStatus` prop (or reads `payment.invoiceStatus`). If the status is `draft` or `cancelled`:

- The due-status footer is **replaced** with a red warning banner: `"Invoice {status}"`.
- A red left border (or a red-tinted card background) visually flags the card.
- The `Pay Now` button is hidden.

```tsx
const isInvoiceDead = payment.invoiceStatus === 'cancelled' || payment.invoiceStatus === 'draft';

// In the render:
{isInvoiceDead ? (
  <View style={styles.footerCancelled} className="px-4 py-2">
    <Text style={styles.footerTextCancelled} className="text-xs font-semibold">
      Invoice {payment.invoiceStatus}
    </Text>
  </View>
) : dueStatus ? (
  // existing footer
) : null}
```

### 6.4 `InvoiceEntity.canBeCancelled()`

```ts
canBeCancelled(linkedPayments: Payment[]): { allowed: boolean; reason?: string } {
  const hasSettled = linkedPayments.some(p => p.status === 'settled');
  if (hasSettled) {
    return {
      allowed: false,
      reason: 'Invoice has settled payments. Reverse all payments before cancelling.',
    };
  }
  return { allowed: true };
}
```

This method is **pure** — it takes payments as an argument so it has no repository dependency. The call site (invoice update use case or repository adapter) is responsible for fetching the linked payments and calling this guard before persisting a `cancelled` status.

### 6.5 Navigation: `PaymentsNavigator`

```ts
// src/pages/payments/PaymentsNavigator.tsx
export type PaymentsStackParamList = {
  PaymentsList: undefined;
  PaymentDetails: { paymentId: string } | { syntheticRow: Payment };
};
```

Pattern mirrors `TasksNavigator.tsx`. `PaymentsScreen` becomes `PaymentsList` within the stack.

### 6.6 `PaymentDetails` Screen Layout

```
┌─────────────────────────────────┐
│ ← Back          Payment Details │  ← header
├─────────────────────────────────┤
│ [Settled ✓  16 Mar 2026]        │  ← status badge (green) or empty
│                                 │
│ CONTRACTOR NAME  Bold           │
│ $2,400.00        Large          │  ← this payment's amount
│                                 │
│ Due Date: 20 Mar 2026           │
│ Method:   Bank Transfer         │
│ Reference: INV-0042             │
│ Notes:    ...                   │
├─────────────────────────────────┤
│ INVOICE DETAILS                 │  ← section header (if invoiceId)
│ Invoice #: INV-0042             │
│ Issued by: ABC Constructions    │
│ Invoice Total:  $10,000.00      │
│ Paid to date:    $4,000.00      │  ← sum of all settled payments on this invoice
│ Remaining:       $6,000.00      │  ← outstanding (shown in amber/red if overdue)
│ Status:    Partial              │
│ Due:       20 Mar 2026          │
│ Items: [collapsed/expanded]     │
├─────────────────────────────────┤
│ PAYMENT HISTORY (this invoice)  │  ← list of all real Payment records for this invoice
│  ✓ $3,000  Settled  01 Mar 2026 │
│  ● $1,000  Settled  08 Mar 2026 │
│  ○ $2,400  Pending  ← current   │  ← highlighted
│  ○ $3,600  Pending              │
├─────────────────────────────────┤
│ PROJECT                         │
│ 14 Smith Street                 │
├─────────────────────────────────┤
│        [Mark as Paid]           │  ← only shown when current payment is pending
└─────────────────────────────────┘
```

> **Note on staged payments**: When multiple `Payment` records share the same `invoiceId`, the "Payment History" section lists all of them. Each row is tappable to navigate to that payment's own `PaymentDetails` screen. This gives the builder a full picture of the staged schedule without leaving the details view.

### 6.7 `MarkPaymentAsPaidUseCase`

```ts
interface MarkAsPaidInput {
  paymentId: string;           // real payment id, OR 'invoice-payable:<invoiceId>'
  invoiceId?: string;          // required when paymentId is synthetic
  amount: number;              // may be partial (user editable in the confirmation modal)
  note?: string;
  settledAt?: string;          // ISO; defaults to now
}
```

Logic:
1. Parse `paymentId`: if it starts with `invoice-payable:`, extract `invoiceId` and treat as synthetic.
2. Create a new `Payment` via `PaymentEntity.create({ status: 'settled', invoiceId, amount, notes: note, date: settledAt ?? now })`.
3. Save via `paymentRepo.save()`.
4. Recalculate invoice `paymentStatus` by summing **all** settled payments for the invoice (not just this one): if `paidTotal >= invoice.total` → `paid`; if `paidTotal > 0` → `partial`; else → `unpaid`. Update invoice via `invoiceRepo.updateInvoice()`.
5. If the original payment was a real `pending` record (not synthetic), also update it to `settled` via `paymentRepo.update()`.
6. Return the newly created settled payment.

**Partial payment note**: If the recorded `amount` is less than the invoice total remaining, the invoice stays at `partial` and the outstanding portion will re-appear as a synthetic row on the next list refresh. This is the expected behaviour for staged payments — each stage is settled individually.

**Idempotency**: Before saving, check `paymentRepo.findByInvoice(invoiceId)` — if a settled payment already exists for the same invoice with the same amount and date (within 60 seconds), return that existing record instead of creating a duplicate.

### 6.8 Conflict Detection on PaymentDetails

On `useFocusEffect` (re-focus the screen), re-fetch the payment. If it has transitioned to `settled` since the screen was opened, display a banner:

> *"This payment was marked as paid by another session. Refreshing..."*

Then update local state to show the settled view.

---

## 7. Data Flow Diagram

```
PaymentsScreen (list)
  └── usePayments (hook)
        ├── ListGlobalPaymentsUseCase       → real pending Payments from DB
        └── buildInvoicePayables()
              ├── invoiceRepo.listInvoices()
              ├── projectRepo.findById()    → supplies defaultDueDateDays per project
              ├── resolveInvoiceDueDate(inv, taskStartDate, project.defaultDueDateDays ?? 5)
              │                             ← NEW utility with configurable period
              └── returns synthetic Payment[] with invoiceStatus + dueDate fields

PaymentCard
  ├── reads payment.dueDate (now resolved from invoice by hook)
  └── reads payment.invoiceStatus for dead-invoice highlight ← NEW

PaymentsNavigator (NEW)
  ├── PaymentsList (= existing PaymentsScreen)
  │     └── PaymentCard.onPress → navigate('PaymentDetails', params)
  └── PaymentDetails (NEW)
        ├── usePaymentDetails hook
        │     ├── fetch payment record (or use syntheticRow from params)
        │     ├── fetch linked invoice (invoiceRepo.getInvoice)
        │     ├── fetch ALL payments for invoice (paymentRepo.findByInvoice)
        │     │     → used for: paid-to-date, remaining, payment history list
        │     └── fetch project name (projectRepo.findById)
        └── MarkPaymentAsPaidUseCase (on confirm)
              ├── PaymentRepository.save()   (new settled record)
              ├── PaymentRepository.update() (update original pending, if real)
              └── InvoiceRepository.updateInvoice()  (paymentStatus: partial | paid)
```

### Staged Payment Example

```
Invoice INV-0042  total: $10,000
  ├── Payment pay_001  $3,000  settled  01-Mar  ← real DB record
  ├── Payment pay_002  $3,000  pending  15-Mar  ← real DB record (appears in list directly)
  └── (no more pending records → outstanding $4,000 → synthetic row generated)
        invoice-payable:INV-0042  $4,000  pending  ← synthetic

On list: 2 cards shown for INV-0042
  Card A: pay_002  $3,000 pending
  Card B: invoice-payable:INV-0042  $4,000 pending

After settling Card B ($4,000):
  → new pay_003  $4,000 settled created
  → invoice paymentStatus → 'paid'
  → no more synthetic row generated on next refresh
```

---

## 8. Invoice Cancellation Guard — Call Site

The guard belongs in the **InvoiceEntity** (domain). It must be invoked wherever an invoice status is updated to `cancelled`. Currently, invoice status updates flow through `InvoiceRepository.updateInvoice()` in the infrastructure layer, called from `RecordPaymentUseCase` and any direct hook calls.

**Recommended approach** (in scope for this issue):
- Add the `canBeCancelled()` method to `InvoiceEntity`.
- Add a new `CancelInvoiceUseCase` that fetches linked payments, calls `canBeCancelled()`, and either proceeds or throws.
- The existing `updateInvoice()` repository method is NOT the enforcement point — enforcement lives in the use case layer, consistent with Clean Architecture conventions.

The `CancelInvoiceUseCase` itself is a small wrapper and within the scope of this issue since the guard logic is needed to satisfy AC-A8/AC-A9.

---

## 9. `Payment` Entity — Addendum

Add one optional display field (no DB migration needed — this is only populated on in-memory synthetic rows and enriched real rows):

```ts
// To Payment interface (Payment.ts):
invoiceStatus?: 'draft' | 'issued' | 'paid' | 'overdue' | 'cancelled'; // display-only enrichment
```

---

## 10. Tests

### Unit Tests (`__tests__/unit/`)

| Test file | Scenarios |
|---|---|
| `resolveInvoiceDueDate.test.ts` | All four priority branches; configurable period (3 days vs 5 days); working-day fallback uses mocked `Date.now` |
| `InvoiceEntity.canBeCancelled.test.ts` | No payments → allowed; pending-only → allowed; settled payments → blocked |
| `MarkPaymentAsPaidUseCase.test.ts` | Real pending payment → settled; synthetic → new payment created; partial payment → invoice stays `partial`; full payment → invoice becomes `paid`; idempotency check |
| `buildInvoicePayables.due-date.test.ts` | Synthetic row carries correct `dueDate` using project's `defaultDueDateDays`; also carries `invoiceStatus`; cancelled/draft invoices skipped; invoice with existing pending records → no synthetic row generated |
| `buildInvoicePayables.staged.test.ts` | Invoice with 2 settled + 1 pending → no synthetic row; invoice with 2 settled + 0 pending → synthetic row for outstanding amount |

### Integration Tests (`__tests__/integration/`)

| Test file | Scenarios |
|---|---|
| `PaymentDetails.navigation.test.ts` | Navigate from list → details with real paymentId; with synthetic row param |
| `MarkPaymentAsPaid.integration.test.ts` | Full flow: synthetic row → mark paid → settled payment in DB → invoice paymentStatus updated |

---

## 11. Out of Scope (Deferred)

- **Reverse payment UI**: The cancellation guard references it, but creating the reverse-payment flow is a separate issue.
- **Offline queue**: `Mark as Paid` shows an error and retry prompt if offline; no offline queue implementation.
- **Permission/role gating**: `Mark as Paid` button is always shown to the current user (single-user app for now). Multi-user RBAC is deferred.
- **External payment gateway**: Explicitly out of scope per issue requirements.

---

## 12. Open Questions

| # | Question | Impact |
|---|---|---|
| ~~OQ-1~~ | ~~Should the working-day fallback be hardcoded or configurable?~~ | **Resolved**: `defaultDueDateDays` added to `Project` entity + DB. |
| ~~OQ-2~~ | ~~Should direct `updateInvoice()` calls also enforce the guard?~~ | **Resolved**: Guard lives in `InvoiceEntity` as the aggregate root. `InvoiceEntity` exposes a `cancel(linkedPayments)` state-transition method that internally calls `canBeCancelled()` and throws a domain error if blocked. All cancellation flows must go through this entity method — the use case calls `entity.cancel(payments)` before persisting. Direct `updateInvoice()` calls for non-cancellation transitions remain unguarded. |
| ~~OQ-3~~ | ~~Modal or card presentation for `PaymentDetails`?~~ | **Resolved**: Card presentation (`presentation: 'card'`), matching the `TaskDetails` pattern. |

---

## 13. Checklist for Implementation

**Schema & Domain**
- [ ] Drizzle migration — add `default_due_date_days` to `projects` table
- [ ] `src/infrastructure/database/schema.ts` — add column
- [ ] `src/domain/entities/Project.ts` — add `defaultDueDateDays?: number`
- [ ] `src/domain/entities/Invoice.ts` — add `canBeCancelled(linkedPayments: Payment[])` to `InvoiceEntity`
- [ ] `src/domain/entities/Payment.ts` — add `invoiceStatus?` display-only field

**Utilities**
- [ ] `src/utils/workingDays.ts` — `addWorkingDays(date, days)` utility
- [ ] `src/utils/resolveInvoiceDueDate.ts` — due date priority helper (with `dueDatePeriodDays` param)

**Use Cases**
- [ ] `src/application/usecases/payment/MarkPaymentAsPaidUseCase.ts` — new use case (handles real + synthetic + partial)
- [ ] `src/application/usecases/invoice/CancelInvoiceUseCase.ts` — new use case with cancellation guard

**Hook**
- [ ] `src/hooks/usePayments.ts` — update `buildInvoicePayables()` to use `resolveInvoiceDueDate(inv, taskStartDate, project.defaultDueDateDays)` + set `invoiceStatus` on synthetic rows

**UI**
- [ ] `src/components/payments/PaymentCard.tsx` — dead-invoice red highlight state
- [ ] `src/pages/payments/PaymentsNavigator.tsx` — new stack navigator
- [ ] `src/pages/payments/PaymentDetails.tsx` — new screen (with invoice summary, payment history, mark-as-paid)
- [ ] `src/pages/tabs/index.tsx` — swap `PaymentsScreen` for `PaymentsNavigator`

**Tests**
- [ ] Unit: `resolveInvoiceDueDate.test.ts`
- [ ] Unit: `InvoiceEntity.canBeCancelled.test.ts`
- [ ] Unit: `MarkPaymentAsPaidUseCase.test.ts`
- [ ] Unit: `buildInvoicePayables.due-date.test.ts`
- [ ] Unit: `buildInvoicePayables.staged.test.ts`
- [ ] Integration: `PaymentDetails.navigation.test.ts`
- [ ] Integration: `MarkPaymentAsPaid.integration.test.ts`

**Quality**
- [ ] `npx tsc --noEmit` passes
