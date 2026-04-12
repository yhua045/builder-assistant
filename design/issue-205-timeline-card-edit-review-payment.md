# Design: Fix TimelineInvoiceCard / TimelinePaymentCard — Add Edit, Remove Card-tap, Rename CTA

**Issue**: #205  
**Branch**: `issue/205`  
**Date**: 2026-04-10  
**Status**: ⏳ Awaiting approval

---

## 1. User Story

> As a builder using the project detail timeline, I want dedicated **Edit** and **Review Payment** buttons on invoice and payment cards, so that I can navigate to the right screen intentionally rather than accidentally triggering navigation by tapping the card background.

---

## 2. Acceptance Criteria

- [ ] AC1: The root element of `TimelineInvoiceCard` and `TimelinePaymentCard` is NOT pressable; tapping the card background does nothing.
- [ ] AC2a: An **Edit** button appears on `TimelineInvoiceCard`; tapping it navigates to `InvoiceDetail` with `{ invoiceId }`.
- [ ] AC2b: An **Edit** button appears on `TimelinePaymentCard`; tapping it navigates to `PaymentDetails` with `{ paymentId }`.
- [ ] AC3: The CTA label **"Mark Paid"** is renamed to **"Review Payment"** on both card components.
- [ ] AC4: Tapping **Review Payment** navigates to the `PaymentDetails` screen (payment cards: `{ paymentId }`; invoice cards: `{ invoiceId }`).
- [ ] AC5 (unit): Both card component test files assert the root has no `onPress`; Edit calls nav correctly; Review Payment calls nav to PaymentDetails.
- [ ] AC6 (integration): Visual order verified — Edit is rendered to the left of Review Payment.
- [ ] AC7: Storybook/example story updated if present (no story files found in this repo — N/A).
- [ ] AC8: `npx tsc --noEmit` and `npm test` pass.

---

## 3. Current State Analysis

### TimelineInvoiceCard (src/components/projects/TimelineInvoiceCard.tsx)
- Root element: `<Pressable onPress={onPress} accessibilityRole="button" …>`
- Prop interface: `onPress: () => void` (required), `onMarkPaid?: () => void` (optional)
- Action row renders a single "Mark Paid" `Pressable` when `onMarkPaid` is provided.

### TimelinePaymentCard (src/components/projects/TimelinePaymentCard.tsx)
- Root element: `<Pressable onPress={onPress} accessibilityRole="button" …>`
- Prop interface: `onPress: () => void` (required), `onMarkPaid?: () => void` (optional)
- Action row renders a single "Mark Paid" `Pressable` when `onMarkPaid` is provided.

### ProjectDetail.tsx (src/pages/projects/ProjectDetail.tsx)
- `<TimelinePaymentCard onPress={() => handleViewPayment(…)} onMarkPaid={() => handleRecordPayment(…)} />`
- `<TimelineInvoiceCard onPress={() => handleViewInvoice(…)} onMarkPaid={() => handleMarkInvoiceAsPaid(…)} />`
- `handleViewPayment` → `navigation.navigate('PaymentDetail', { paymentId })` *(note: 'PaymentDetail' without 's' — existing behaviour)*
- `handleViewInvoice` → `navigation.navigate('InvoiceDetail', { invoiceId })`
- `handleRecordPayment` → `navigation.navigate('PaymentDetail', { paymentId, openRecordPayment: true })`
- `handleMarkInvoiceAsPaid` → `navigation.navigate('InvoiceDetail', { invoiceId, openMarkAsPaid: true })`

### Route Map
| Stack | Route name | Screen |
|---|---|---|
| ProjectsNavigator | `InvoiceDetail` | `InvoiceDetailPage` |
| ProjectsNavigator | `QuotationDetail` | `QuotationDetailScreen` |
| PaymentsNavigator | `PaymentDetails` | `PaymentDetails` |

---

## 4. Proposed Abstraction Changes

### 4.1 TimelineInvoiceCard Props (breaking change)

```ts
export interface TimelineInvoiceCardProps {
  invoice: Invoice;
  /** Navigates to InvoiceDetail for editing */
  onEdit: () => void;
  /** When provided, shows the Review Payment button */
  onReviewPayment?: () => void;
  testID?: string;
}
```

- `onPress` is **removed**.
- `onMarkPaid` is **replaced** by `onReviewPayment`.
- `onEdit` is **required** — always show the Edit button.

### 4.2 TimelinePaymentCard Props (breaking change)

```ts
export interface TimelinePaymentCardProps {
  payment: Payment;
  /** Navigates to PaymentDetails for editing */
  onEdit: () => void;
  /** When provided, shows the Review Payment button */
  onReviewPayment?: () => void;
  testID?: string;
}
```

- `onPress` is **removed**.
- `onMarkPaid` is **replaced** by `onReviewPayment`.
- `onEdit` is **required** — always show the Edit button.

### 4.3 Root Element Change

Both cards change their root element from `<Pressable>` to `<View>`:

```tsx
// Before
<Pressable onPress={onPress} accessibilityRole="button" …>
// After
<View …>
```

The `active:opacity-80` Tailwind class is removed (only meaningful on Pressable). The `accessibilityRole="button"` attribute is removed from the root.

### 4.4 Action Row Layout

The action row is now a horizontal flex row containing:
1. **Edit** button (always rendered) — left
2. **Review Payment** button (rendered when `onReviewPayment` is provided) — right

```
┌─────────────────────────────────────┐
│  [Edit]   [Review Payment]          │
└─────────────────────────────────────┘
```

`Edit` uses a neutral muted style. `Review Payment` uses the same existing muted button style as the old "Mark Paid" button. A gap separates the two.

**Important**: Edit button must always render in the action row (the row is always visible, not conditioned on `onReviewPayment`).

### 4.5 ProjectDetail.tsx Handler Updates

Handlers renamed/repurposed to reflect new semantics:

| Old | New | Purpose |
|---|---|---|
| `handleViewPayment` | `handleEditPayment` | `onEdit` for payment cards → `navigate('PaymentDetail', { paymentId })` |
| `handleRecordPayment` *(renamed)* | `handleReviewPayment` | `onReviewPayment` for payment cards → `navigate('PaymentDetails', { paymentId })` |
| `handleViewInvoice` | `handleEditInvoice` | `onEdit` for invoice cards → `navigate('InvoiceDetail', { invoiceId })` |
| `handleMarkInvoiceAsPaid` *(renamed)* | `handleReviewInvoicePayment` | `onReviewPayment` for invoice cards → `navigate('PaymentDetails', { invoiceId })` |

> **Navigation note**: `handleReviewPayment` and `handleReviewInvoicePayment` both target the `PaymentDetails` screen in the **PaymentsNavigator** stack. From `ProjectDetail` (which lives inside `ProjectsNavigator`), this requires cross-stack navigation via `useNavigation<any>()` — the same pattern already used elsewhere in this file. No architectural change is required; the parent simply calls `navigation.navigate('PaymentDetails', …)`.

JSX usage in ProjectDetail:

```tsx
// Payment card
<TimelinePaymentCard
  key={feedItem.data.id}
  payment={feedItem.data}
  onEdit={() => handleEditPayment(feedItem.data)}
  onReviewPayment={payment.status !== 'settled' ? () => handleReviewPayment(feedItem.data) : undefined}
  testID={`payment-card-${feedItem.data.id}`}
/>

// Invoice card
<TimelineInvoiceCard
  key={feedItem.data.id}
  invoice={feedItem.data}
  onEdit={() => handleEditInvoice(feedItem.data)}
  onReviewPayment={invoice.paymentStatus !== 'paid' ? () => handleReviewInvoicePayment(feedItem.data) : undefined}
  testID={`invoice-card-${feedItem.data.id}`}
/>
```

---

## 5. Tests Plan

### 5.1 Unit: TimelineInvoiceCard.test.tsx (update existing)

Remove / replace existing tests that conflict with the new contract:

| ID | Existing → New | Rationale |
|---|---|---|
| I6 | **Remove**: "calls onPress when card is tapped" | Card is no longer pressable |
| I7 | **Replace**: "calls onMarkPaid when Mark Paid tapped" → "calls onReviewPayment when Review Payment tapped" | Prop renamed, label renamed |

Add new tests:

| ID | Description |
|---|---|
| I8 | Root element has no `onPress` property (i.e. is NOT a `Pressable` root) |
| I9 | **Edit** button is rendered (testID `invoice-action-edit`) |
| I10 | Tapping Edit calls `onEdit` |
| I11 | **Review Payment** button is rendered when `onReviewPayment` is provided (testID `invoice-action-review-payment`) |
| I12 | Tapping Review Payment calls `onReviewPayment` |
| I13 | **Review Payment** button is NOT rendered when `onReviewPayment` is omitted |
| I14 | Edit button renders to the LEFT of Review Payment in the DOM tree (positional assertion) |

### 5.2 Unit: TimelinePaymentCard.test.tsx (new file)

| ID | Description |
|---|---|
| P1 | Renders contractor name |
| P2 | Renders formatted amount |
| P3 | Root element has no `onPress` property |
| P4 | **Edit** button is rendered (testID `payment-action-edit`) |
| P5 | Tapping Edit calls `onEdit` |
| P6 | **Review Payment** button rendered when `onReviewPayment` provided (testID `payment-action-review-payment`) |
| P7 | Tapping Review Payment calls `onReviewPayment` |
| P8 | **Review Payment** button NOT rendered when `onReviewPayment` omitted |
| P9 | Edit renders before Review Payment (left of Review Payment in button row) |
| P10 | Settled payment: renders "Paid" chip |

### 5.3 Integration Note

No dedicated integration test file exists for these components. The button visual order assertion (AC6) is satisfied by unit test I14 / P9 using the render tree positional check (the Edit `testID` node precedes the Review Payment `testID` node in the component tree).

---

## 6. testID Contract

| Component | Element | testID |
|---|---|---|
| TimelineInvoiceCard | Root View | `invoice-card-{invoice.id}` (via `testID` prop or default) |
| TimelineInvoiceCard | Edit button | `invoice-action-edit` |
| TimelineInvoiceCard | Review Payment button | `invoice-action-review-payment` |
| TimelinePaymentCard | Root View | `{testID}` prop (as exists today) |
| TimelinePaymentCard | Edit button | `payment-action-edit` (or `{testID}-edit` if testID provided) |
| TimelinePaymentCard | Review Payment button | `payment-action-review-payment` (or `{testID}-review-payment`) |

---

## 7. Files to Change

| File | Change |
|---|---|
| `src/components/projects/TimelineInvoiceCard.tsx` | Remove `onPress`; add `onEdit` (required); rename `onMarkPaid` → `onReviewPayment`; root `Pressable` → `View`; update action row |
| `src/components/projects/TimelinePaymentCard.tsx` | Same as above |
| `src/pages/projects/ProjectDetail.tsx` | Rename handlers; update JSX usage of both card components |
| `__tests__/unit/TimelineInvoiceCard.test.tsx` | Remove I6; update I7; add I8–I14 |
| `__tests__/unit/TimelinePaymentCard.test.tsx` | **New file** with tests P1–P10 |

---

## 8. Out of Scope

- Changes to `PaymentDetails.tsx` or `InvoiceDetailPage.tsx` internals.
- Any changes to `usePaymentsTimeline`, `useQuotationsTimeline`, or domain entities.
- Storybook (no stories exist in this repo).
- Changes to navigation stack definitions (`ProjectsNavigator`, `PaymentsNavigator`).

---

## 9. Open Questions

1. **Settled/paid card Edit behaviour**: Should the Edit button still appear and be functional for already-paid/settled cards? **A** No, the Edit button should not appear for settled/paid cards.
2. **Cross-stack navigation for Review Payment**: Navigating from `ProjectsNavigator` to `PaymentDetails` in `PaymentsNavigator` via `navigation.navigate('PaymentDetails', …)` relies on React Navigation's cross-stack resolution. This was not tested previously. The developer should verify this works at runtime and add a note if a nested navigation approach is needed.**A** if cross-stack navigation does not work, we can copy the `PaymentDetails` screen into the `ProjectsNavigator` stack and navigate to that instead.
