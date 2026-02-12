# Payment Screen Design and Plan (Issue #55)

## Context
The goal is to implement a "Payments Screen" that provides visibility into financial obligations and history. The generic "Payment" module needs to handle both **Settled Payments** (historical transactions) and **Pending Payments** (scheduled or due obligations).

Currently, `Payment` entity lacks explicit `status` persistence and `dueDate` concept. We will enhance the domain model and repository to support these, enabling the required "Overdue", "Upcoming", and "Paid" lists.

## Domain Modeling

### Entities

**Payment**
Update `src/domain/entities/Payment.ts` to include:
- `status`: `'pending' | 'settled'` (Ensure strict typing and persistence)
- `dueDate`: string (ISO date) - needed for scheduling pending payments.
- `date`: string (ISO date) - represents the *Paid Date* when settled, or *Scheduled Date* when pending.
    - *Decision*: We will use `dueDate` for the deadline (similar to Invoice due date) and `date` for the logical scheduled/paid date.
    - *Clarification*: For an Invoice, `dueDate` is when it *must* be paid. `date` on a Payment is when it *is* paid.
    - For a "Pending Payment" (Scheduled), `date` is the *planned* payment date. `dueDate` might be derived from the Invoice or manually set.
    - Requirements say: "Upcoming = next 7 days". "Total pending ... dueDate in next 7 days".
    - So we *must* persist `dueDate` on the Payment mechanism to track when it *should* be paid, distinct from when we *plan* to pay it (though often they are the same).
    - Let's stick to adding `dueDate` as an optional field (since unexpected payments don't have a due date).

### Repository Interface

**IPaymentRepository** (`src/domain/repositories/PaymentRepository.ts`)

Add new methods:

```typescript
export interface PaymentFilters {
  projectId?: string;
  invoiceId?: string;
  status?: 'pending' | 'settled';
  dateFrom?: string; // Filter by 'date' (payment/scheduled date) NOT due date?
                     // Requirement: "Upcoming = next 7 days". Usually implies Due Date or Scheduled Date.
                     // Let's assume filters apply to the 'effective date' (date field).
                     // However, "Overdue" implies filtering by Due Date < Now AND Status=Pending.
                     // So we might need specific semantic filters or flexible query.
  
  // To keep it clean, we might expose specific "Overdue" / "Upcoming" methods or a general query.
  // Given "IPaymentRepository.list(filters...)" is requested:
  fromDate?: string;   // Applies to 'date'
  toDate?: string;     // Applies to 'date'
  isOverdue?: boolean; // Special filter: status=pending AND due_date < now
}

export interface PaymentRepository {
  // ... existing methods
  list(filters: PaymentFilters): Promise<{ items: Payment[], meta: any }>;
  
  // Aggregate for KPIs
  getMetrics(projectId?: string): Promise<{
    pendingTotalNext7Days: number; // sum of amount where status='pending' AND dueDate <= 7 days from now
    overdueCount: number;          // count where status='pending' AND dueDate < now
  }>;
}
```

Wait, requirement said: "Total pending ... sum of payment amounts with **dueDate** in next 7 days".
So `date` (payment date) might be empty for pending payments? Or set to future?
If `status` is 'pending', `date` acts as "Scheduled Date".
But "Pending (next 7 days)" metric relies on `dueDate`.
So we need `dueDate` persisted.

## Infrastructure (Drizzle)

### Schema (`src/infrastructure/database/schema.ts`)
Update `payments` table:
- Add `due_date` (integer/timestamp)
- Add `status` (text enum check)

### Migration
- Generate migration to alter table.

### DrizzlePaymentRepository
- Map `dueDate` <-> `due_date`.
- Map `status` <-> `status`.
- Implement `list` using dynamic SQL construction (or Drizzle's `where` builder).
- Implement `getMetrics` using aggregation queries (count, sum).

## Application Layer

### Use Cases

1.  **`ListPaymentsUseCase`**
    -   Input: `status` ('overdue', 'upcoming', 'paid'), `projectId` (optional).
    -   Logic:
        -   If `status` == 'overdue': call repo with `isOverdue=true`.
        -   If `status` == 'upcoming': call repo with `status='pending'`, `fromDate=now`, `toDate=now+7d`.
        -   If `status` == 'paid': call repo with `status='settled'`, `fromDate=now-7d`, `toDate=now`.
    -   Output: `Payment[]`.

2.  **`GetPaymentMetricsUseCase`**
    -   Input: `projectId`.
    -   Output: `{ pending7Days: number, overdueCount: number }`.

### Hook (`usePayments`)
-   Wraps the use cases.
-   Returns: `{ overdue: [], upcoming: [], paid: [], metrics: {}, loading, refresh }`.
-   This approach simplifies the UI by pre-bucketing the data.

## UI Components

### `PaymentsScreen` (`src/pages/payments/PaymentsScreen.tsx`)
-   **Header/KPI Section**:
    -   Row with "Pending (7d)" (Amount) and "Overdue" (Count).
-   **Lists Section**:
    -   Tabs or SectionList? Requirement says "Three sections/lists". Vertical scroll with headers is fine.
    -   Section 1: Overdue (Red badge/border).
    -   Section 2: Upcoming.
    -   Section 3: Paid (History).
-   **ListItem**:
    -   Shows Amount, Date, Reference/Notes, Status Badge.

## Test Plan (TDD)

1.  **Unit Tests (Use Case)**:
    -   Mock `PaymentRepository`.
    -   Test `ListPaymentsUseCase` returns correct filtered buckets.
    -   Test `GetPaymentMetricsUseCase` aggregates correctly (if logic is in UseCase) or just passes through (if logic in Repo). Since we put logic in Repo, we test that UseCase calls Repo with correct params.

2.  **Integration Tests (Repository)**:
    -   Test `DrizzlePaymentRepository`.
    -   Insert payments (past due/pending, future/pending, settled).
    -   Verify `list` returns correct subsets.
    -   Verify `getMetrics` returns correct sums/counts.
    
3.  **UI Tests**:
    -   Snapshot test of `PaymentsScreen` with mock data.
    -   Interaction test (pull to refresh).

## Migration Steps
1.  Update Schema & Entity.
2.  Generate DB Migration.
3.  Update Repo Interface.
4.  Write Tests for Repo (failing).
5.  Implement Repo.
6.  Write Tests for UseCase (failing).
7.  Implement UseCase.
8.  Implement UI.

