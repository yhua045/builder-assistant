# Design: Issue #199 — Update Payments List in Project Detail

**Date**: 2026-04-09  
**Branch**: `issue-199-payments-list-project-detail`  
**Status**: Draft — pending review  

---

## 1. User Story

> As an owner-builder, when I open a project's detail screen and expand the **Payments** section, I want to see all invoice records and any unlinked payments — so I have a single, unified view of my overall billing, recorded payments, and upcoming liabilities.

---

## 2. Scope

| Included | Excluded |
|---|---|
| Show all invoice records regardless of status in the Payments section | New invoice CRUD screens |
| Show payments that are NOT linked to any invoice | Changing the global Payments tab |
| Render a distinct `TimelineInvoiceCard` for invoice rows | Push notifications / reminders |
| Update `TimelinePaymentCard` and `TimelineInvoiceCard` to show item status | Changes to Quotations section |
| New `ListProjectPaymentsFeedUseCase` combining both sources | Dashboard PaymentList widget |
| Updated `usePaymentsTimeline` hook (new merged return type) | |
| Updated `ProjectDetail.tsx` render for the mixed list | |
| Add `InvoiceDetail` route to `ProjectsStackParamList` | |

---

## 3. Domain Analysis

### Included Records Definition

The unified timeline includes:
1. **All Invoices**: Every invoice record associated with the project, regardless of its `status` (Draft, Issued, Overdue, Paid, etc.) or `paymentStatus`.
2. **Unlinked Payments**: Any payment record that does NOT have an `invoiceId`. Payments linked to an invoice are excluded from the top-level list to prevent duplicate/cluttered entries.

> *Both items must visibly display their respective status (e.g., Invoice Status + Payment Status, or standalone Payment Status) in the UI.*

### Date for sorting / grouping

| Entity | Date field (primary → fallback) |
|---|---|
| `Payment` | `payment.dueDate ?? payment.date` |
| `Invoice` | `invoice.dateDue ?? invoice.dueDate ?? invoice.issueDate` |

No-date items trail to the `__nodate__` bucket (existing behaviour preserved).

---

## 4. Architecture

### 4.1 New Domain Value Type

```
src/domain/entities/PaymentFeedItem.ts
```

```typescript
import { Payment } from './Payment';
import { Invoice } from './Invoice';

/**
 * Discriminated union representing one row in the project payments feed.
 * 'payment' → an unlinked, standalone Payment
 * 'invoice' → an Invoice record (any status)
 */
export type PaymentFeedItem =
  | { kind: 'payment';  data: Payment }
  | { kind: 'invoice';  data: Invoice };
```

No new repository interface changes are needed — `InvoiceRepository.listInvoices()` already accepts `{ projectId, status[] }`.

---

### 4.2 New Use Case

```
src/application/usecases/payment/ListProjectPaymentsFeedUseCase.ts
```

**Dependencies**: `PaymentRepository`, `InvoiceRepository`

**Contract**:
```typescript
interface ListProjectPaymentsFeedResult {
  items: PaymentFeedItem[];
  truncated: boolean;
}

class ListProjectPaymentsFeedUseCase {
  constructor(
    private readonly paymentRepo: PaymentRepository,
    private readonly invoiceRepo: InvoiceRepository,
  ) {}
  
  async execute(projectId: string): Promise<ListProjectPaymentsFeedResult>
}
```

**Algorithm**:
1. `paymentRepo.findByProjectId(projectId)` → all `Payment[]`
2. Filter payments to keep only those where `payment.invoiceId === undefined || payment.invoiceId === null`
3. `invoiceRepo.listInvoices({ projectId })` → all `Invoice[]`
4. Map to `PaymentFeedItem[]` (discriminated union)
5. Sort merged array by due date ascending (no-date items trail)
6. Apply `MAX_ITEMS = 500` guard; set `truncated` flag

**MAX_ITEMS guard**: consistent with existing `ListProjectPaymentsUseCase`.

---

### 4.3 Updated Hook

```
src/hooks/usePaymentsTimeline.ts  (modified)
```

**Changes**:
- Replace `ListProjectPaymentsUseCase` with `ListProjectPaymentsFeedUseCase`
- Inject `InvoiceRepository` from the DI container alongside `PaymentRepository`
- Rename `PaymentDayGroup.payments: Payment[]` → `PaymentDayGroup.items: PaymentFeedItem[]`
- Re-export `PaymentFeedItem` from the hook module for consumers

```typescript
// Updated public type
export interface PaymentDayGroup {
  date: string;
  label: string;
  items: PaymentFeedItem[];   // replaces: payments: Payment[]
}

export interface UsePaymentsTimelineReturn {
  paymentDayGroups: PaymentDayGroup[];
  loading: boolean;
  error: string | null;
  truncated: boolean;
  recordPayment: (payment: Payment) => Promise<void>;
  invalidate: () => Promise<void>;
}
```

> `groupPaymentsByDay` helper is replaced by `groupFeedItemsByDay` (same shape, updated to extract date from `PaymentFeedItem`).

---

### 4.4 New UI Component

```
src/components/projects/TimelineInvoiceCard.tsx  (new)
```

**Props**:
```typescript
interface TimelineInvoiceCardProps {
  invoice: Invoice;
  onView:   (invoice: Invoice) => void;
  onMarkAsPaid: (invoice: Invoice) => void;
  onAttachDocument: (invoice: Invoice) => void;
  testID?: string;
}
```

**Visual design** (aligned with `TimelinePaymentCard`):
- Same card geometry (`ml-4 mb-3 bg-card border border-border rounded-xl`)
- **Left-border accent**: `amber-400` (3px) to visually distinguish from payment cards
- Header row: `issuerName ?? vendor ?? 'Unknown Vendor'` (bold) + `invoice.total` (bold right-aligned)
- Sub-row: `externalReference ?? invoiceNumber ?? ''` in muted text
- **Status row**: Display both `invoice.status` (e.g. Draft, Issued) and `invoice.paymentStatus` (e.g. Unpaid, Partial, Paid) chips visibly to satisfy the new requirement.
- Quick-action row: **View** | **Mark Paid** | **Attach** (same 3-button row pattern)

*(Note: Ensure `TimelinePaymentCard` also visibly displays `payment.status`.)*

**Mark Paid action**: calls `onMarkAsPaid` → parent navigates to `InvoiceDetail` with `openMarkAsPaid: true` param (avoids inline mutation, consistent with existing "record payment" pattern).

---

### 4.5 Updated Screen

```
src/pages/projects/ProjectDetail.tsx  (modified)
```

**Changes to `renderItem`** for `paymentGroup`:
```tsx
// Before:
group.payments.map((payment) => (
  <TimelinePaymentCard key={payment.id} payment={payment} ... />
))

// After:
group.items.map((item) =>
  item.kind === 'payment' ? (
    <TimelinePaymentCard key={item.data.id} payment={item.data} ... />
  ) : (
    <TimelineInvoiceCard key={item.data.id} invoice={item.data}
      onView={handleViewInvoice}
      onMarkAsPaid={handleMarkInvoiceAsPaid}
      onAttachDocument={handleInvoiceAttachDocument}
    />
  )
)
```

**New handlers**:
```tsx
const handleViewInvoice = (invoice: Invoice) =>
  navigation.navigate('InvoiceDetail', { invoiceId: invoice.id });

const handleMarkInvoiceAsPaid = (invoice: Invoice) =>
  navigation.navigate('InvoiceDetail', { invoiceId: invoice.id, openMarkAsPaid: true });

const handleInvoiceAttachDocument = (invoice: Invoice) =>
  navigation.navigate('InvoiceDetail', { invoiceId: invoice.id, openDocument: true });
```

**Empty state**: "No payments or invoices for this project."

---

### 4.6 Route Addition

```
src/pages/projects/ProjectsNavigator.tsx  (modified)
```

```typescript
// Add to ProjectsStackParamList:
InvoiceDetail: { invoiceId: string; openMarkAsPaid?: boolean; openDocument?: boolean };

// Add Stack.Screen:
<Stack.Screen name="InvoiceDetail" component={InvoiceDetailPage}
  options={{ presentation: 'card' }} />
```

Import `InvoiceDetailPage` from `../invoices/InvoiceDetailPage`.

---

## 5. Component Sketch

```
┌─────────────────────────────────────────────────────────┐
│  PAYMENTS   (7)                              ▼ collapsed │
├─────────────────────────────────────────────────────────┤
│ 20       ●  Thu 20 Mar                          [2]     │
│ Thu      │  ┌───────────────────────────────────────┐  │
│          │  │ ▌ ABC Plumbing                    $4,200 │  │  ← TimelineInvoiceCard
│          │  │   INV-0042  •  [Issued] [Unpaid]        │  │    (amber left border)
│          │  │   [ View ] [ Mark Paid ] [ Attach ]     │  │
│          │  └───────────────────────────────────────┘  │
│          │  ┌───────────────────────────────────────┐  │
│          │  │  XYZ Electrical            $1,850       │  │  ← TimelinePaymentCard
│          │  │  Contract: Frame Stage  •  [Paid]       │  │    (existing, no change)
│          │  │   [ View ]              [ Attach ]      │  │
│          │  └───────────────────────────────────────┘  │
│ 25       ●  Tue 25 Mar                          [1]     │
│  Tue     │  ┌───────────────────────────────────────┐  │
│          │  │ ▌ Apex Roofing                   $9,500 │  │  ← TimelineInvoiceCard
│          │  │   INV-0043  •  [Overdue]                │  │    (red overdue chip)
│          │  │   [ View ] [ Mark Paid ] [ Attach ]     │  │
│          │  └───────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 6. Dependency Graph

```
ProjectDetail.tsx
  └── usePaymentsTimeline (updated)
        └── ListProjectPaymentsFeedUseCase  (new)
              ├── PaymentRepository (existing)
              └── InvoiceRepository (existing)
                    └── listInvoices({ projectId, status: ['issued','overdue'] })

ProjectDetail.tsx
  └── TimelineInvoiceCard  (new)
  └── TimelinePaymentCard  (existing, unchanged)
```

No new database schema changes. No new repository interfaces. No migrations.

---

## 7. Test Acceptance Criteria

### 7.1 Unit Tests

#### `ListProjectPaymentsFeedUseCase`
```
__tests__/unit/ListProjectPaymentsFeedUseCase.test.ts
```

| # | Given | When | Then |
|---|---|---|---|
| U1 | Project has 2 unlinked payments, 1 invoice (`issued`, `unpaid`) | `execute(projectId)` | Returns 3 items; invoice has `kind: 'invoice'` |
| U2 | Project has 1 `draft` invoice and 1 `paid` invoice | `execute(projectId)` | Both invoices included (all statuses included now) |
| U3 | Project has 1 payment with `invoiceId: 'x'` and 1 without | `execute(projectId)` | Only the payment without `invoiceId` is included |
| U4 | Project has 1 cancelled invoice | `execute(projectId)` | Invoice is included |
| U5 | Project has 1 overdue invoice with `paymentStatus: 'partial'` | `execute(projectId)` | Invoice included as `invoice` |
| U6 | 501 combined items | `execute(projectId)` | Returns 500 items, `truncated: true` |
| U7 | Mixed items with various due dates | `execute(projectId)` | Items sorted ascending by due date; no-date items trail |
| U8 | No invoices, no payments for project | `execute(projectId)` | Returns `{ items: [], truncated: false }` |

#### `groupFeedItemsByDay` (hook helper, pure function)
```
__tests__/unit/groupFeedItemsByDay.test.ts
```

| # | Given | Then |
|---|---|---|
| G1 | Payment with `dueDate '2026-04-20'` and invoice with `dateDue '2026-04-20'` | Both in same day bucket `'2026-04-20'` |
| G2 | Item with no date | Placed in `'__nodate__'` bucket at end |
| G3 | Multiple dates | Buckets sorted ascending |

#### `TimelineInvoiceCard`
```
__tests__/unit/TimelineInvoiceCard.test.tsx
```

| # | Given | Then |
|---|---|---|
| I1 | Invoice with `issuerName: 'ABC Plumbing'` | Renders issuer name |
| I2 | Invoice `total: 4200`, `currency: 'AUD'` | Renders `$4,200` |
| I3 | Invoice `status: 'overdue'` | Renders "Overdue" chip (red) |
| I4 | Invoice `status: 'draft'` | Renders "Draft" chip (gray) |
| I5 | Invoice `paymentStatus: 'partial'` | Renders "Partial" chip (amber) |
| I6 | User taps "View" button | `onView(invoice)` called |
| I7 | User taps "Mark Paid" button | `onMarkAsPaid(invoice)` called |
| I8 | User taps "Attach" button | `onAttachDocument(invoice)` called |

---

### 7.2 Integration Tests

#### `ProjectDetailPayments.integration.test.tsx` (update existing)

| # | Scenario | Assert |
|---|---|---|
| P1 | `paymentDayGroups` has group with mixed `items` (1 payment, 1 invoice) | Both `TimelinePaymentCard` and `TimelineInvoiceCard` render |
| P2 | Only `invoice` items in group | `TimelineInvoiceCard` renders; no `TimelinePaymentCard` |
| P3 | Only `payment` items in group | `TimelinePaymentCard` renders; no `TimelineInvoiceCard` |
| P4 | All items removed from feed | Empty state: "No payments or invoices for this project." |
| P5 | Tapping invoice "View" action | `navigation.navigate` called with `'InvoiceDetail', { invoiceId }` |

#### `ListProjectPaymentsFeedUseCase.integration.test.ts` (new)
```
__tests__/integration/ListProjectPaymentsFeedUseCase.integration.test.ts
```

| # | Scenario | Assert |
|---|---|---|
| F1 | DB has 1 settled unlinked payment + 1 unpaid invoice for project | Returns exactly 2 items |
| F2 | DB has 1 paid invoice with 1 linked payment for project | Returns 1 `invoice` item (payment is excluded as it is linked) |
| F3 | DB has invoices from different project | Cross-project invoices excluded |

---

## 8. Key Architectural Decisions

| Decision | Rationale |
|---|---|
| `PaymentFeedItem` as a discriminated union in domain layer | Zero coupling — components switch on `kind` without needing instanceof checks |
| New use case (`ListProjectPaymentsFeedUseCase`) rather than modifying the existing one | Preserves `ListProjectPaymentsUseCase` for callers that only need raw payments (global payments screen); follows SRP |
| Inclusive scope: all invoices + unlinked payments | Provides a unified view of all billing, preventing duplication for payments mapped to invoices |
| Amber left border for `TimelineInvoiceCard` | Visually distinct from `TimelinePaymentCard` without a full redesign; consistent with existing card geometry |
| No new DB schema | Both `PaymentRepository.findByProjectId` and `InvoiceRepository.listInvoices({ projectId })` already exist |
| `InvoiceDetail` added to `ProjectsStackParamList` | Keeps navigation self-contained in the projects stack; mirrors the existing `QuotationDetail` pattern |

---

## 9. Files Changed / Created

| File | Action |
|---|---|
| `src/domain/entities/PaymentFeedItem.ts` | **Create** |
| `src/application/usecases/payment/ListProjectPaymentsFeedUseCase.ts` | **Create** |
| `src/hooks/usePaymentsTimeline.ts` | **Modify** (swap use case, update types) |
| `src/components/projects/TimelineInvoiceCard.tsx` | **Create** |
| `src/pages/projects/ProjectDetail.tsx` | **Modify** (render mixed items, new handlers) |
| `src/pages/projects/ProjectsNavigator.tsx` | **Modify** (add `InvoiceDetail` route) |
| `__tests__/unit/ListProjectPaymentsFeedUseCase.test.ts` | **Create** |
| `__tests__/unit/groupFeedItemsByDay.test.ts` | **Create** |
| `__tests__/unit/TimelineInvoiceCard.test.tsx` | **Create** |
| `__tests__/integration/ListProjectPaymentsFeedUseCase.integration.test.ts` | **Create** |
| `__tests__/integration/ProjectDetailPayments.integration.test.tsx` | **Modify** |

---

## 10. Handoff

> This design document is ready for TDD.  
> **Agent**: `developer`  
> **Prompt**: "Plan approved. Write failing tests for these requirements."  
> **Design doc**: `design/issue-199-payments-list.md`
