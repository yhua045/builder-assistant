# Design: Issue #203 — Fine-Tune (Task Refresh, Document Attach, Payment List Unification)

**Date**: 2026-04-10  
**Worktree**: `issue-203`  
**References**: CLAUDE.md, Clean Architecture

---

## 1. User Stories & Acceptance Criteria

| # | User Story | Acceptance Criteria |
|---|-----------|---------------------|
| 1 | After creating a task, the Tasks screen list should update | AC: navigating back to TasksScreen shows the newly created task without a manual pull-to-refresh |
| 2 | "Add document & image" button in Task Details should work | AC: tapping "Add" opens a file/image picker; the selected item appears in the document list |
| 3 | Remove "Attach" button from timeline payment/invoice cards in Project Detail → Payments | AC: no Attach button visible on `TimelineInvoiceCard` or `TimelinePaymentCard` in the Payments section of Project Detail |
| 4 | "Mark Paid" button on timeline payment/invoice cards should be functional | AC: tapping "Mark Paid" on a pending `TimelineInvoiceCard`/`TimelinePaymentCard` marks the item as paid and refreshes the list |
| 5 | Tapping a timeline card navigates to the existing Payment Details screen | AC: tapping a `TimelineInvoiceCard` or `TimelinePaymentCard` opens the existing `PaymentDetails` screen (the same screen reached via Finance → Payments → pending payment); the screen renders the payment using `components/payments/PaymentCard` |
| 6 | Paid payments on Payment Details screen are read-only; pending payments are editable | AC: on `PaymentDetails`, when opened for a paid/settled payment the action buttons (Make Payment / Make Partial Payment) are hidden and the `PaymentCard` is read-only; when opened for a pending invoice the buttons remain as-is |
| 7 | Show due date for pending payments and paid date for paid payments on the timeline cards | AC: pending `TimelineInvoiceCard`/`TimelinePaymentCard` footer shows the due-date countdown; paid card footer shows "Paid on DD Mon YYYY" |

---

## 2. Root Cause Analysis

### Bug 1 — Tasks screen does not refresh (Req 1)

In `src/hooks/useTaskForm.ts` (create mode, end of `submit()`):

```ts
await queryClient.invalidateQueries({ queryKey: queryKeys.tasks(newTask.projectId) });
```

`TasksScreen` (`src/pages/tasks/index.tsx`) calls `useTasks()` **without** a `projectId`, so its active query key is `['tasks']` (unscoped). The above invalidation only busts `['tasks', projectId]`, so the global list never re-fetches.  

Additionally, `invalidations.tasksCreated` in `queryKeys.ts` only invalidates the project-scoped key — the unscoped global key is absent.

### Bug 2 — "Add document & image" button is silent (Req 2)

In `src/infrastructure/di/registerServices.ts`, **`IFilePickerAdapter` is never registered**. The `useMemo` in `TaskDetailsPage.tsx` that resolves it:

```ts
const filePickerAdapter = useMemo(() => {
  try { return container.resolve<IFilePickerAdapter>('IFilePickerAdapter'); }
  catch { return null; }
}, []);
```

…silently returns `null`. `handleAddDocument` has a guard `if (!filePickerAdapter … ) return;` that exits without invoking the picker or showing any error.

Secondary issue: `MobileFilePickerAdapter.pickDocument()` only allows `DocumentPicker.types.pdf` — the label says "document **& image**", so images (`DocumentPicker.types.images`) must also be accepted.

---

## 3. Architectural Design

### Layer overview

```
Domain         No changes required
Application    No changes required (MarkInvoiceAsPaidUseCase and MarkPaymentAsPaidUseCase already exist)
Infrastructure registerServices.ts — register IFilePickerAdapter
               MobileFilePickerAdapter — support images in addition to PDFs
Hooks          useTaskForm.ts — fix global tasks key invalidation
               queryKeys.ts   — add global tasks key to tasksCreated invalidation
Components     TimelineInvoiceCard.tsx — remove Attach button; add Mark Paid button; show due/paid date footer
               TimelinePaymentCard.tsx — remove Attach button; add Mark Paid button; show due/paid date footer
               PaymentCard.tsx — add paidDate display support (already used on Finance/Payments; extended for details screen)
               (new) src/utils/mapFeedItemToPaymentCard.ts — adapter utility (used by PaymentDetailsScreen)
Pages          ProjectDetail.tsx — wire onMarkPaid + onPress navigation to existing PaymentDetails screen on timeline cards
               src/pages/payments/PaymentDetails.tsx (existing) — extend route params to accept `invoiceId` + optional `readOnly`; add `PaymentCard` rendering; hide action buttons in read-only mode
Navigation     Extend existing `PaymentDetails` param type: add `invoiceId?: string` and `readOnly?: boolean`
```

No new domain entities or use cases are required. All use cases needed (`MarkInvoiceAsPaidUseCase`, `MarkPaymentAsPaidUseCase`) already exist.

`TimelineInvoiceCard` and `TimelinePaymentCard` are **kept** on the Project Detail → Payment List. They are modified (Attach removed, Mark Paid added, date footer added) but not replaced. The `PaymentCard` component is used on the existing `PaymentDetails` screen for both invoice and payment navigations.

---

## 4. Detailed Change Specifications

### 4.1 Fix: Tasks screen refresh (Req 1)

**File: `src/hooks/queryKeys.ts`**

`invalidations.tasksCreated` must also bust the **unscoped** tasks list:

```ts
// Before
tasksCreated: (ctx: TasksCreatedCtx) => [
  queryKeys.tasks(ctx.projectId),
  queryKeys.projectsOverview(),
],

// After
tasksCreated: (ctx: TasksCreatedCtx) => [
  queryKeys.tasks(),            // ← global unscoped key (used by TasksScreen)
  queryKeys.tasks(ctx.projectId),
  queryKeys.projectsOverview(),
],
```

**File: `src/hooks/useTaskForm.ts`**

In create mode (the `else` branch of `submit()`), replace the single invalidation call with the `invalidations.tasksCreated` helper and add the global key:

```ts
// Before (line ~495)
await queryClient.invalidateQueries({ queryKey: queryKeys.tasks(newTask.projectId) });

// After
await Promise.all(
  invalidations.tasksCreated({ projectId: newTask.projectId ?? '' })
    .map(key => queryClient.invalidateQueries({ queryKey: key }))
);
```

> Note: For the variation path (which already calls `invalidations.acceptQuotation`), add `queryKeys.tasks()` there too, since that path returns early without hitting the fix above.

### 4.2 Fix: Document & image picker (Req 2)

**File: `src/infrastructure/di/registerServices.ts`**

Add import and registration inside the `if (typeof (container as any).registerSingleton …)` block:

```ts
import { MobileFilePickerAdapter } from '../files/MobileFilePickerAdapter';

// inside the if-block, with other singleton registrations:
container.registerSingleton('IFilePickerAdapter', MobileFilePickerAdapter);
```

**File: `src/infrastructure/files/MobileFilePickerAdapter.ts`**

Add support for images by broadening the accepted `type` array:

```ts
const result = await DocumentPicker.pick({
  type: [DocumentPicker.types.pdf, DocumentPicker.types.images],
  copyTo: 'cachesDirectory',
});
```

### 4.3 Timeline Card Modifications + Payment Details Screen (Reqs 3, 4, 5, 6, 7)

#### 4.3.1 Modify `TimelineInvoiceCard` (Reqs 3, 4, 7)

**File: `src/components/timeline/TimelineInvoiceCard.tsx`**

Props interface changes:

```ts
interface TimelineInvoiceCardProps {
  invoice: Invoice;
  onPress: () => void;           // navigate to PaymentDetailsScreen
  onMarkPaid?: () => void;       // undefined when already paid → hides the button
  // REMOVED: onAttachDocument
}
```

1. **Remove** the `onAttachDocument` prop and the Attach button (the action row `View` that contained it).
2. **Add** a "Mark Paid" `TouchableOpacity` in the action row when `onMarkPaid` is defined.
3. **Footer date**: show `dueDate` countdown for pending invoices; show `"Paid on DD Mon YYYY"` using `invoice.paymentDate` for paid invoices.

```tsx
// Date footer — bottom of card
{isPaid ? (
  <Text style={styles.paidDateText}>
    {invoice.paymentDate
      ? `Paid on ${formatDate(invoice.paymentDate)}`
      : 'Paid'}
  </Text>
) : invoice.dateDue ? (
  <Text style={styles.dueDateText}>
    Due {formatRelativeDate(invoice.dateDue)}
  </Text>
) : null}

// Action row — only shown when pending
{onMarkPaid && (
  <TouchableOpacity onPress={onMarkPaid} style={styles.markPaidButton}>
    <Text style={styles.markPaidButtonText}>Mark Paid</Text>
  </TouchableOpacity>
)}
```

#### 4.3.2 Modify `TimelinePaymentCard` (Reqs 3, 4, 7)

**File: `src/components/timeline/TimelinePaymentCard.tsx`**

Identical pattern to `TimelineInvoiceCard`:

```ts
interface TimelinePaymentCardProps {
  payment: Payment;
  onPress: () => void;           // navigate to PaymentDetailsScreen
  onMarkPaid?: () => void;       // undefined when settled → hides the button
  // REMOVED: onAttachDocument
}
```

1. **Remove** `onAttachDocument` prop and Attach button.
2. **Add** "Mark Paid" button when `onMarkPaid` is defined.
3. **Footer date**: show `dueDate` countdown for pending; show `"Paid on DD Mon YYYY"` using `payment.paidAt` for settled.

#### 4.3.3 Update `ProjectDetail` to wire up navigation + callbacks (Reqs 3, 4, 5, 7)

**File: `src/pages/projects/ProjectDetail.tsx`**

1. **Remove** `handlePaymentAttachDocument` and `handleInvoiceAttachDocument` handlers.
2. **Add** `handleNavigateToPaymentDetails` that navigates based on feed item kind:

```ts
const handleNavigateToPaymentDetails = useCallback(
  (feedItem: PaymentFeedItem) => {
    navigation.navigate('PaymentDetails', {
      kind: feedItem.kind,
      id: feedItem.data.id,
    });
  },
  [navigation]
);
```

3. In the `renderItem` for `paymentGroup`, pass the new props to each card:

```tsx
{group.items.map((feedItem) => {
  if (feedItem.kind === 'invoice') {
    const invoice = feedItem.data as Invoice;
    const isPaid = invoice.paymentStatus === 'paid';
    return (
      <TimelineInvoiceCard
        key={invoice.id}
        invoice={invoice}
        onPress={() => handleNavigateToPaymentDetails(feedItem)}
        onMarkPaid={isPaid ? undefined : () => handleMarkInvoiceAsPaid(invoice)}
      />
    );
  }
  // kind === 'payment'
  const payment = feedItem.data as Payment;
  const isSettled = payment.status === 'settled';
  return (
    <TimelinePaymentCard
      key={payment.id}
      payment={payment}
      onPress={() => handleNavigateToPaymentDetails(feedItem)}
      onMarkPaid={isSettled ? undefined : () => handleRecordPayment(payment)}
    />
  );
})}
```

This satisfies:
- **Req 3** (Attach removed from both `TimelineInvoiceCard` and `TimelinePaymentCard`)
- **Req 4** (`onMarkPaid` wired to existing handlers)
- **Req 7** (date footer in each timeline card)

#### 4.3.4 Extend `PaymentCardPayment` type (Reqs 5, 6, 7)

**File: `src/components/payments/PaymentCard.tsx`**

```ts
export type PaymentCardPayment = Payment & {
  projectName?: string;
  paidDate?: string;   // NEW: ISO string; shown in footer when status === 'settled'
};
```

Update the footer rendering: when `payment.status === 'settled'`, show a green "Paid on <date>" footer instead of the due-status banner.

```tsx
{payment.status === 'settled' ? (
  <View style={[styles.footer, styles.footerOnTime]} className="px-4 py-2">
    <Text style={styles.footerTextOnTime} className="text-xs font-semibold">
      {payment.paidDate
        ? `Paid on ${new Date(payment.paidDate).toLocaleDateString('en-AU', {
            day: 'numeric', month: 'short', year: 'numeric',
          })}`
        : 'Paid'}
    </Text>
  </View>
) : dueStatus ? (
  /* existing due-status footer with Pay Now / Mark Paid button */
) : null}
```

The `onPayNow` prop remains the action callback. When `onPayNow` is `undefined` the button is hidden (read-only mode). No `onAttachDocument` prop is present on `PaymentCard`.

#### 4.3.5 Mapper utility (used by the existing `PaymentDetails` screen)

**New file: `src/utils/mapFeedItemToPaymentCard.ts`**

```ts
import { PaymentFeedItem } from '../domain/entities/PaymentFeedItem';
import { PaymentCardPayment } from '../components/payments/PaymentCard';

export function mapFeedItemToPaymentCard(item: PaymentFeedItem): PaymentCardPayment {
  if (item.kind === 'payment') {
    return { ...item.data, paidDate: (item.data as any).paidAt };
  }

  // kind === 'invoice'
  const inv = item.data;
  const isPaid = inv.paymentStatus === 'paid';

  return {
    id: inv.id,
    projectId: inv.projectId,
    invoiceId: inv.id,
    amount: inv.total,
    currency: inv.currency,
    dueDate: inv.dateDue ?? (inv as any).dueDate,
    status: isPaid ? 'settled' : 'pending',
    contractorName: inv.issuerName ?? inv.vendor ?? 'Invoice Payable',
    invoiceStatus: inv.status,
    paidDate: inv.paymentDate,
    notes: inv.notes,
    createdAt: inv.createdAt,
    updatedAt: inv.updatedAt,
  };
}
```

#### 4.3.6 Modify existing `PaymentDetails` screen (Reqs 5, 6)

**Existing file: `src/pages/payments/PaymentDetails.tsx`**

This is the same screen the user already reaches via Finance → Payments → tap a pending payment. It displays invoice details with **Make Payment** and **Make Partial Payment** buttons at the bottom.

**Route param extension** (`src/pages/payments/PaymentsNavigator.tsx`):

```ts
// Before
PaymentDetails: { paymentId?: string; syntheticRow?: Payment };

// After
PaymentDetails: {
  paymentId?: string;
  syntheticRow?: Payment;
  invoiceId?: string;   // NEW: navigate here from TimelineInvoiceCard
  readOnly?: boolean;   // NEW: true when opened from a paid Payment card
};
```

**Behaviour changes inside `PaymentDetails.tsx`**:
1. **Invoice loading**: when `invoiceId` is present (and `paymentId` is absent), fetch the invoice by `invoiceId` and derive the `payment` state via `mapFeedItemToPaymentCard`. This populates the same local `payment`/`invoice` state the screen already manages.
2. **`PaymentCard` rendering**: add an import of `PaymentCard`. When the screen has a resolved `cardPayment`, render `<PaymentCard payment={cardPayment} onPayNow={...} />` at the top of the scroll view (above existing detail rows) so both Invoice and Payment navigations display the unified card.
3. **Read-only mode**: when `readOnly === true` (passed for paid Payment navigations), do not render the **Make Payment** / **Make Partial Payment** buttons and set `onPayNow={undefined}` on `PaymentCard`. All other screen content (invoice/payment details, attached documents) remains visible.
4. Derive `readOnly` automatically when the loaded `payment.status === 'settled'` or `invoice.paymentStatus === 'paid'`, so callers do not strictly need to pass the flag — but the explicit param is a useful shortcut that avoids an extra fetch delay.

```tsx
// Simplified addition at the top of the render:
const isReadOnly = readOnly ||
  payment?.status === 'settled' ||
  invoice?.paymentStatus === 'paid';

const cardPayment = useMemo(
  () => feedItem ? mapFeedItemToPaymentCard(feedItem) : null,
  [feedItem]
);

// In JSX, before existing detail sections:
{cardPayment && (
  <PaymentCard
    payment={cardPayment}
    onPayNow={isReadOnly ? undefined : handleMakePayment}
  />
)}

// Existing Make Payment / Make Partial Payment buttons:
{!isReadOnly && (
  /* ... existing button row unchanged ... */
)}
```

#### 4.3.7 Navigation — reuse existing `PaymentDetails` route

**No new route is required.** The existing `'PaymentDetails'` route in `PaymentsNavigator` is reused. When navigating from `ProjectDetail`, the navigation call must cross navigator boundaries (Projects stack → Payments stack). Use `navigation.navigate` with the correct navigator name prefix, or add `PaymentDetails` as a route in the root/shared stack if the current project navigator does not have access to it.

```ts
// From ProjectDetail.tsx — navigate to existing PaymentDetails:
navigation.navigate('PaymentDetails', {
  paymentId: feedItem.kind === 'payment' ? feedItem.data.id : undefined,
  invoiceId: feedItem.kind === 'invoice' ? feedItem.data.id : undefined,
  readOnly: feedItem.kind === 'payment' && feedItem.data.status === 'settled',
});
```

Param type update in `PaymentsNavigator.tsx`:
```ts
PaymentDetails: {
  paymentId?: string;
  syntheticRow?: Payment;
  invoiceId?: string;
  readOnly?: boolean;
};
```

---

## 5. UI Considerations (mobile-ui alignment)

The following are design constraints to keep visual consistency with existing screens:

### Timeline Cards (`TimelineInvoiceCard` / `TimelinePaymentCard`) — Project Detail Payment List

- Both cards retain their coloured left-border accent and overall layout. Only the Attach action row is removed; the card body remains unchanged.
- The **Mark Paid** button must match the visual style of the existing inline action buttons on these cards (outlined pill, accent colour). Use the same `StyleSheet` tokens already in `TimelineInvoiceCard` / `TimelinePaymentCard`.
- **Date footer**: add a small `Text` row at the bottom of each card:
  - Pending: `text-muted-foreground`, shows e.g. `"Due in 3 days"` or `"Overdue by 2 days"` — reuse the same relative-date formatting logic already used elsewhere in the app.
  - Paid: `text-green-600` (or the app's success token), shows `"Paid on 3 Apr 2026"`.
- The cards already have `ml-4` indent inside the timeline layout — no wrapper changes needed.

### `PaymentCard` — `PaymentDetailsScreen`

- `PaymentCard` is currently used unchanged on the Finance/Payments screen. The only addition is the optional `paidDate` field and the "Paid on …" footer state, which reuses the existing `styles.footerOnTime` (green) and `styles.footerTextOnTime` colour tokens — no new colour tokens.
- On `PaymentDetailsScreen` the card is presented full-width inside a `ScrollView` with standard horizontal padding (`px-4`). No special container styling is needed beyond what `PaymentCard` already provides.
- **Editable vs read-only**: `PaymentCard` does not render a "Pay Now" / "Mark Paid" button when `onPayNow` is `undefined`. This is the sole mechanism for the read-only state — no separate `readOnly` prop is required.
- All text inside `PaymentCard` is `text-foreground` / `text-muted-foreground` and will respect the active colour scheme (dark/light).

---

## 6. Test Plan (TDD — write failing tests first)

### 6.1 Unit tests — `queryKeys` / `useTaskForm` (Req 1)

**File**: `__tests__/unit/queryKeys.tasksCreated.test.ts`
- `tasksCreated` returns the global `['tasks']` key
- `tasksCreated` returns the project-scoped `['tasks', projectId]` key

**File**: `__tests__/unit/useTaskForm.globalInvalidation.test.ts`
- On task creation, `queryClient.invalidateQueries` is called with `['tasks']` (unscoped)
- On task creation with a variation (quick-return path), also calls with `['tasks']`

### 6.2 Unit tests — DI registration (Req 2)

**File**: `__tests__/unit/registerServices.filePickerAdapter.test.ts`
- After importing `registerServices`, resolving `'IFilePickerAdapter'` from the container returns an instance of `MobileFilePickerAdapter`

**File**: `__tests__/unit/MobileFilePickerAdapter.test.ts`
- `pickDocument` accepts images: the `type` array passed to `DocumentPicker.pick` includes `DocumentPicker.types.images`
- Cancel is handled gracefully (returns `{ cancelled: true }`)

### 6.3 Unit tests — `TimelineInvoiceCard` modifications (Reqs 3, 4, 7)

**File**: `__tests__/unit/TimelineInvoiceCard.test.tsx`
- Does **not** render an Attach button in any state
- Renders a "Mark Paid" button when `onMarkPaid` is passed
- Does **not** render a "Mark Paid" button when `onMarkPaid` is `undefined`
- Calls `onMarkPaid` when the button is pressed
- Calls `onPress` when the card is pressed
- Shows due-date footer when invoice is pending and `dateDue` is set
- Shows "Paid on DD Mon YYYY" footer when `isPaid === true` and `paymentDate` is set
- Shows "Paid" (no date) when `isPaid === true` and `paymentDate` is absent

### 6.4 Unit tests — `TimelinePaymentCard` modifications (Reqs 3, 4, 7)

**File**: `__tests__/unit/TimelinePaymentCard.test.tsx`
- Same cases as above, adapted for `Payment` props (`paidAt` instead of `paymentDate`)

### 6.5 Unit tests — `mapFeedItemToPaymentCard` (Reqs 5, 6)

**File**: `__tests__/unit/mapFeedItemToPaymentCard.test.ts`
- Maps `kind: 'payment'` item → `paidDate` populated from `payment.paidAt`
- Maps `kind: 'invoice'` item (unpaid) → `status: 'pending'`, `dueDate` set from `inv.dateDue`, `contractorName` from `inv.issuerName`
- Maps `kind: 'invoice'` item (paid) → `status: 'settled'`, `paidDate` set from `inv.paymentDate`
- Maps `kind: 'invoice'` item with no issuerName → contractorName defaults to `'Invoice Payable'`

### 6.6 Unit tests — `PaymentCard` paidDate display (Req 6, 7)

**File**: `__tests__/unit/PaymentCard.paidDate.test.tsx`
- When `payment.status === 'settled'` and `paidDate` is set, renders "Paid on DD Mon YYYY"
- When `payment.status === 'settled'` and no `paidDate`, renders "Paid" without a date
- When `payment.status === 'pending'`, does NOT render "Paid on …"
- `onPayNow` is called when Pay Now is pressed
- When `onPayNow` is `undefined`, no Pay Now / Mark Paid button is rendered (read-only)

### 6.7 Unit tests — `PaymentDetails` screen modifications (Reqs 5, 6)

**File**: `__tests__/unit/PaymentDetails.readOnly.test.tsx`
- When `readOnly=true` is passed, no Make Payment / Make Partial Payment buttons are rendered
- When `readOnly=false` (or absent) and invoice is pending, Make Payment and Make Partial Payment buttons are rendered
- When the loaded invoice has `paymentStatus === 'paid'`, buttons are hidden even if `readOnly` param was not passed
- When the loaded payment has `status === 'settled'`, buttons are hidden
- `PaymentCard` is rendered with a valid `payment` prop in each case
- `PaymentCard` receives `onPayNow={undefined}` in read-only mode
- `PaymentCard` receives a function `onPayNow` in editable mode
- When `invoiceId` param is provided (no `paymentId`), the screen loads the invoice and maps it via `mapFeedItemToPaymentCard`

### 6.8 Integration tests — ProjectDetail payment section (Reqs 3, 4, 5, 7)

**File**: `__tests__/integration/ProjectDetail.paymentSection.test.tsx`
- Renders `TimelineInvoiceCard` and `TimelinePaymentCard` (not `PaymentCard`) in payment section
- No "Attach" button present on any timeline card
- "Mark Paid" button present for pending items; absent for settled/paid items
- Pressing a timeline card navigates to `PaymentDetails` with the correct `kind` and `id`
- Shows due-date footer on pending timeline cards
- Shows paid-date footer on paid/settled timeline cards

---

## 7. Files Changed (summary)

| File | Change |
|------|--------|
| `src/hooks/queryKeys.ts` | Add global `queryKeys.tasks()` to `tasksCreated` invalidation |
| `src/hooks/useTaskForm.ts` | Use `invalidations.tasksCreated` in create path; cover variation quick-return path |
| `src/infrastructure/di/registerServices.ts` | Register `MobileFilePickerAdapter` under `'IFilePickerAdapter'` |
| `src/infrastructure/files/MobileFilePickerAdapter.ts` | Include `DocumentPicker.types.images` in accepted types |
| `src/components/timeline/TimelineInvoiceCard.tsx` | Remove Attach button; add Mark Paid button; add due/paid date footer |
| `src/components/timeline/TimelinePaymentCard.tsx` | Remove Attach button; add Mark Paid button; add due/paid date footer |
| `src/components/payments/PaymentCard.tsx` | Add `paidDate` to `PaymentCardPayment`; render "Paid on …" footer for settled payments; read-only when `onPayNow` is `undefined` |
| `src/utils/mapFeedItemToPaymentCard.ts` | **New**: maps `PaymentFeedItem` → `PaymentCardPayment` (used by the existing `PaymentDetails` screen) |
| `src/pages/payments/PaymentDetails.tsx` | **Modify** (existing): extend params to accept `invoiceId` + `readOnly`; add `PaymentCard` rendering; hide action buttons in read-only mode |
| `src/pages/projects/ProjectDetail.tsx` | Wire `onMarkPaid` + `onPress` (→ existing `PaymentDetails`) on timeline cards; remove Attach handlers |
| `src/pages/payments/PaymentsNavigator.tsx` | Extend `PaymentDetails` param type: add `invoiceId?: string` and `readOnly?: boolean` |

`TimelinePaymentCard.tsx` and `TimelineInvoiceCard.tsx` are **kept and modified** — they remain the primary card components on the Project Detail → Payment List.

---

## 8. Out of Scope

- Camera image capture flow inside `TaskDocumentSection` (separate issue if required)
- Full removal of `TimelinePaymentCard` and `TimelineInvoiceCard` from the codebase (they are intentionally kept)
- Payment partial-amount entry on "Mark Paid" (existing behaviour — dispatches use case directly; no new amount-entry modal)
- Editing payment amount / contractor details from `PaymentDetails` (pending payments are "editable" in the sense that the Make Payment / Make Partial Payment actions are available; no new inline field-editing)
