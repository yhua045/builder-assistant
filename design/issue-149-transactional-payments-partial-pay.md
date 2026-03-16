# Design: Issue #149 — Transactional Payments + Partial Payment UI

**Status**: APPROVED
**Author**: Copilot
**Date**: 2026-03-16
**GitHub Issue**: https://github.com/yhua045/builder-assistant/issues/149

---

## 0. Context & Background

The current `PaymentDetails` screen evaluates CTA visibility (`Mark as Paid`) solely from the `Payment` record's own `status` field. This causes two problems:

1. **Synthetic rows** (`invoice-payable:` prefix) are explicitly blocked from the action — the user must navigate elsewhere to record a payment against an invoice that has no existing payment record.
2. **Partially-paid invoices** have no `Make Partial Payment` CTA at all — the builder cannot record incremental staged payments through the detail screen.

Additionally, the `Payment.status` domain type (`'pending' | 'settled'`) cannot represent reversals or cancellations, limiting reconciliation and reporting capabilities.

This issue resolves both gaps in two coordinated parts:

| Part | Summary |
|---|---|
| **A — CTA Visibility** | Drive `Mark as Paid` / `Make Partial Payment` visibility from `invoice.paymentStatus` + `invoice.status` rather than from `payment.status` alone. |
| **B — Partial Payment UI** | Add a bottom-sheet modal (see mock in `PaymentDetails.mock.tsx`) that lets the builder specify an amount, then records a new `Payment` transaction and updates `Invoice.paymentStatus` atomically. |
| **C — Payment.status Extension** | Extend the `Payment.status` enum to include `cancelled` and `reverse_payment` for reconciliation and future reversal support. |

---

## 1. User Stories

| # | Story |
|---|---|
| US-1 | As a Builder, I want the "Mark as Paid" CTA to be visible whenever an invoice has a remaining balance (regardless of whether a `pending` payment record exists), so I can always record a payment. |
| US-2 | As a Builder, I want a "Make Partial Payment" CTA available on any unpaid or partially-paid invoice, so I can record staged or split payments. |
| US-3 | As a Builder, I want to enter a payment amount (pre-filled with the remaining balance) in a modal and have that payment persisted transactionally. |
| US-4 | As a Builder, I want the invoice's `paymentStatus` to reflect `partial` after a partial payment and `paid` once fully settled, so my financial view stays accurate. |
| US-5 | As a Builder, I want `cancelled` and `reverse_payment` statuses available on payment records so that voids and refunds can be tracked correctly. |

---

## 2. Acceptance Criteria

### Part A — CTA Visibility

| # | Criterion |
|---|---|
| AC-A1 | `Mark as Paid` CTA is shown when `invoice.paymentStatus` is `'unpaid'` or `'partial'` **and** `invoice.status !== 'cancelled'` **and** `remainingBalance > 0`. |
| AC-A2 | `Make Partial Payment` CTA is shown under the same conditions as AC-A1. Both CTAs may be shown simultaneously (full-pay vs partial-pay intent). |
| AC-A3 | When no parent invoice is loaded (standalone `Payment` record with no `invoiceId`), fall back to the existing `payment.status === 'pending'` guard as today. |
| AC-A4 | Neither CTA is shown when `invoice.status === 'cancelled'`, even if `paymentStatus` is `'unpaid'`. |

### Part B — Partial Payment Modal

| # | Criterion |
|---|---|
| AC-B1 | Tapping "Make Partial Payment" opens a bottom-sheet modal (handle bar, vendor/invoice summary, amount input, Cancel / Mark as Paid). |
| AC-B2 | The amount field is pre-filled with `remainingBalance` (`invoice.total − totalSettled`). The builder may edit it to any positive value ≤ `remainingBalance`. |
| AC-B3 | Submitting the modal calls `RecordPaymentUseCase.execute()` with the entered amount and `invoiceId`; this creates a new `Payment` record with `status: 'settled'` and updates the invoice atomically. |
| AC-B4 | After a successful submission: the modal closes, `PaymentDetails` reloads its data, and the updated `Invoice.paymentStatus` is reflected in the UI. |
| AC-B5 | If the entered amount equals `remainingBalance`, the invoice transitions to `paymentStatus: 'paid'` (and `status: 'paid'` if the invoice was `issued` or `overdue`). |
| AC-B6 | If the entered amount is less than `remainingBalance`, the invoice transitions to `paymentStatus: 'partial'`. |
| AC-B7 | Validation: amount must be a valid number > 0 and ≤ remainingBalance; show an inline error if not. |

### Part C — Payment.status Extension

| # | Criterion |
|---|---|
| AC-C1 | `Payment.status` type in `src/domain/entities/Payment.ts` is updated to `'pending' \| 'settled' \| 'cancelled' \| 'reverse_payment'`. |
| AC-C2 | The `status` column enum in `src/infrastructure/database/schema.ts` (`payments` table) is extended to include `'cancelled'` and `'reverse_payment'`. |
| AC-C3 | A Drizzle migration is generated for the schema change. |
| AC-C4 | Unit tests cover status transition rules: `cancelled` and `reverse_payment` payments are excluded from `totalSettled` in invoice recalculation. |
| AC-C5 | Existing UI that reads `payment.status` (e.g. status badges in `PaymentDetails`) handles all four values without crashing (unknown values fall back to a neutral display). |

### General

| # | Criterion |
|---|---|
| AC-G1 | All changes are TypeScript strict-mode compliant (`npx tsc --noEmit` passes with zero errors). |
| AC-G2 | Unit tests are added/updated in `__tests__/unit/` for `RecordPaymentUseCase` and `MarkPaymentAsPaidUseCase` covering partial-payment and new-status scenarios. |
| AC-G3 | Integration tests that touch SQLite/Drizzle verify invoice `paymentStatus` transitions end-to-end. |

---

## 3. Proposed Solution

### 3.1 Domain — `Payment.status` Extension

**File**: `src/domain/entities/Payment.ts`

```typescript
// Before
status?: 'pending' | 'settled';

// After
status?: 'pending' | 'settled' | 'cancelled' | 'reverse_payment';
```

`cancelled` — the payment record has been voided (e.g., a cheque was stopped). Does **not** count toward `totalSettled`.  
`reverse_payment` — a deliberate reversal / refund transaction linked back to a prior `settled` payment. Does **not** count toward `totalSettled` (is subtracted in a future reconciliation pass, out of scope for this issue).

### 3.2 Infrastructure — Schema + Migration

**File**: `src/infrastructure/database/schema.ts`

```typescript
// Before
status: text('status', { enum: ['pending', 'settled'] }),

// After
status: text('status', { enum: ['pending', 'settled', 'cancelled', 'reverse_payment'] }),
```

Run `npm run db:generate` after this change to produce a new migration in `drizzle/migrations/`.

### 3.3 Application — `RecordPaymentUseCase` (no logic changes needed)

The existing `RecordPaymentUseCase.execute()` already:
1. Saves a new `Payment` record via `paymentRepo.save()`.
2. Queries all payments for the invoice, sums `amount` values, and derives `paymentStatus`.
3. Writes the updated `paymentStatus` (and optionally `status`) back to the invoice atomically.

The only change needed is that the `totalSettled` sum must **exclude** `cancelled` and `reverse_payment` payments:

```typescript
// In RecordPaymentUseCase.execute() — update the reduce:
const paid = payments
  .filter(p => p.status !== 'cancelled' && p.status !== 'reverse_payment')
  .reduce((s, p) => s + (p.amount || 0), 0);
```

The same filter already exists correctly in `MarkPaymentAsPaidUseCase` (`.filter(p => p.status === 'settled')`), so no change is needed there.

### 3.4 UI — CTA Visibility in `PaymentDetails.tsx`

**File**: `src/pages/payments/PaymentDetails.tsx`

Introduce a derived boolean computed after `invoice` is loaded:

```typescript
// Derived visibility — drives both CTAs
const remainingBalance = invoice
  ? invoice.total - (linkedPayments
      .filter(p => p.status === 'settled')
      .reduce((sum, p) => sum + (p.amount ?? 0), 0))
  : 0;

const canRecordPayment =
  invoice !== null &&
  invoice.status !== 'cancelled' &&
  (invoice.paymentStatus === 'unpaid' || invoice.paymentStatus === 'partial') &&
  remainingBalance > 0;

// Fallback for standalone Payment records (no invoiceId)
const showMarkAsPaidFallback =
  !invoice && payment !== null && payment.status === 'pending' && !isSynthetic;
```

Replace the existing CTA block:

```tsx
{/* Before */}
{payment.status === 'pending' && !isSynthetic && (
  <TouchableOpacity onPress={handleMarkAsPaid} ...>
    <Text>Mark as Paid</Text>
  </TouchableOpacity>
)}

{/* After */}
{(canRecordPayment || showMarkAsPaidFallback) && (
  <View className="gap-3 mb-6">
    <TouchableOpacity
      onPress={handleMarkAsPaid}
      disabled={marking}
      className="bg-primary rounded-xl py-4 items-center"
    >
      <Text className="text-primary-foreground font-bold text-base">Mark as Paid</Text>
    </TouchableOpacity>

    {canRecordPayment && (
      <TouchableOpacity
        onPress={() => setPartialModalVisible(true)}
        className="border border-primary rounded-xl py-4 items-center"
      >
        <Text className="text-primary font-bold text-base">Make Partial Payment</Text>
      </TouchableOpacity>
    )}
  </View>
)}
```

### 3.5 UI — Partial Payment Modal

The modal design is taken directly from the `{/* Partial Payment Modal */}` section in `PaymentDetails.mock.tsx`. Key structural elements:

```
┌──────────────────────────────────────────────┐
│  ───────  (handle bar)                        │
│                                               │
│  Partial Payment                        [X]  │
│                                               │
│  ┌─ Info Card ──────────────────────────────┐│
│  │ Project: <invoice.project>               ││
│  │ Vendor: <issuerName>    Invoice: <ref>   ││
│  └──────────────────────────────────────────┘│
│                                               │
│  Due: Jan 18, 2024              [Overdue]     │
│                                               │
│  ┌─ Balance Card ───────────────────────────┐│
│  │ Total Invoice   $15,750 (struck-through) ││
│  │ Remaining Balance              $10,750   ││
│  └──────────────────────────────────────────┘│
│                                               │
│  Payment Amount                               │
│  ┌─────────────────────────────────────────┐ │
│  │ $  [  10750.00  (editable)           ]  │ │
│  └─────────────────────────────────────────┘ │
│                                               │
│  ┌──────────────┐  ┌──────────────────────┐  │
│  │    Cancel    │  │     Mark as Paid     │  │
│  └──────────────┘  └──────────────────────┘  │
└──────────────────────────────────────────────┘
```

**State additions to `PaymentDetails.tsx`**:
```typescript
const [partialModalVisible, setPartialModalVisible] = useState(false);
const [partialAmount, setPartialAmount] = useState('');
const [submitting, setSubmitting] = useState(false);
```

**Submit handler** (`handlePartialPaymentSubmit`):
```typescript
const handlePartialPaymentSubmit = async () => {
  const amountNum = parseFloat(partialAmount);
  if (!amountNum || amountNum <= 0 || amountNum > remainingBalance) {
    Alert.alert('Invalid amount', 'Enter a valid amount between $0.01 and the remaining balance.');
    return;
  }
  setSubmitting(true);
  try {
    await recordPaymentUc.execute({
      id: `pay_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
      invoiceId: invoice!.id,
      amount: amountNum,
      status: 'settled',
      date: new Date().toISOString(),
    });
    setPartialModalVisible(false);
    await loadData(); // reload invoice + payment history
  } catch (e: any) {
    Alert.alert('Error', e?.message ?? 'Payment failed');
  } finally {
    setSubmitting(false);
  }
};
```

The modal is implemented using React Native's `<Modal>` with `animationType="slide"` and `transparent={true}`, wrapped in a `<KeyboardAvoidingView>` — matching the mock exactly.

---

## 4. Files Changed

| File | Change |
|---|---|
| `src/domain/entities/Payment.ts` | Extend `status` union type |
| `src/infrastructure/database/schema.ts` | Extend `status` enum |
| `drizzle/migrations/<new>.sql` | Auto-generated migration |
| `src/application/usecases/payment/RecordPaymentUseCase.ts` | Filter cancelled/reverse from `totalSettled` |
| `src/pages/payments/PaymentDetails.tsx` | New CTA visibility logic + partial payment modal |
| `__tests__/unit/RecordPaymentUseCase.test.ts` | New/updated tests |
| `__tests__/unit/MarkPaymentAsPaidUseCase.test.ts` | Tests for new status values |
| `__tests__/integration/payment-status-transitions.test.ts` | End-to-end invoice status transition tests |

---

## 5. Out of Scope (This Issue)

- Reverse payment UI (creating a `reverse_payment` record from the UI) — the status is introduced at the domain level only.
- Bulk payment reconciliation screen.
- Push notifications for overdue invoices.
- Changes to the standalone `Payments` list screen beyond what is needed for CTA wiring.

---

## 6. Resolved Decisions

1. **Payment method**: Removed from the modal entirely — the app records payment events only, no method tracking at the point of partial payment entry.
2. **Synthetic row materialisation**: Call `RecordPaymentUseCase` directly with the `invoiceId`. Simpler and consistent; no materialisation needed for partial payments.
3. **remainingBalance cap**: Input is hard-capped at `remainingBalance`. Over-payment is not allowed.
