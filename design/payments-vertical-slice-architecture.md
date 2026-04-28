# Design: Vertical-Slice Architecture — Payments Module

**Date:** 2026-04-28
**Issue:** [#212 — Adopt Vertical-Slice (Modular) Architecture](https://github.com/yhua045/builder-assistant/issues/212)
**Inspired by:**
- [design/issue-212-vertical-slice-architecture.md](issue-212-vertical-slice-architecture.md) (Receipts pilot)
- [design/dashboard-vertical-slice-architecture.md](dashboard-vertical-slice-architecture.md) (Dashboard)
- [design/issue-212-invoices-vertical-slice-architecture.md](issue-212-invoices-vertical-slice-architecture.md) (Invoices)
**Type:** Structural Refactor — file moves and import updates only; no runtime behaviour changes.

---

## 1. Goal & Motivation

Apply the same vertical-slice (feature-module) pattern established for `receipts`,
`dashboard`, and `invoices` to the `payments` module.  All payment-owned files are
gathered into a self-contained module under `src/features/payments/`, making
ownership explicit and eliminating cross-layer scattering.

The Clean Architecture dependency direction is preserved inside the module:

```
screens/ → hooks/ → application/ → domain/
components/ ← hooks/ (ViewModel props)
                ↓
         infrastructure/
```

> **Key difference from `receipts`:** The `PaymentRepository` interface is consumed
> by task use cases (`CompleteTaskAndSettlePaymentsUseCase`, `TaskPaymentValidator`,
> `CompleteTaskUseCase`), the invoice cancel use case, and dashboard hooks — all
> outside the payments feature.  It therefore **stays shared** in
> `src/domain/repositories/PaymentRepository.ts`.  The same applies to the
> `Payment.ts` entity, which is a first-class domain object used across receipts,
> invoices, tasks, and dashboard.

---

## 2. Current (Horizontal) Layout

```
src/
├── application/
│   ├── errors/
│   │   └── PaymentErrors.ts                      ← PaymentNotPendingError, InvoiceNotEditableError
│   └── usecases/payment/
│       ├── AssignProjectToPaymentRecordUseCase.ts
│       ├── GetGlobalAmountPayableUseCase.ts
│       ├── GetPaymentDetailsUseCase.ts
│       ├── GetPaymentMetricsUseCase.ts
│       ├── LinkPaymentToProjectUseCase.ts
│       ├── ListGlobalPaymentsUseCase.ts
│       ├── ListPaymentsUseCase.ts
│       ├── ListProjectPaymentsFeedUseCase.ts
│       ├── ListProjectPaymentsUseCase.ts
│       ├── MarkPaymentAsPaidUseCase.ts
│       └── RecordPaymentUseCase.ts
│
├── components/payments/
│   ├── AmountPayableBanner.tsx
│   ├── GlobalQuotationCard.tsx
│   ├── PaymentCard.tsx
│   ├── PaymentTypeFilterChips.tsx
│   ├── PendingPaymentForm.tsx
│   └── ProjectPickerModal.tsx                    ← stale duplicate; superseded by
│                                                    src/components/shared/ProjectPickerModal.tsx (#192)
│
├── domain/
│   ├── entities/
│   │   ├── Payment.ts                            ← SHARED entity (unchanged)
│   │   └── PaymentFeedItem.ts                    ← feature-owned view type (moves)
│   └── repositories/
│       └── PaymentRepository.ts                  ← SHARED interface (unchanged)
│
├── hooks/
│   ├── useGlobalPaymentsScreen.ts
│   ├── usePaymentDetails.ts
│   ├── usePayments.ts
│   └── usePaymentsTimeline.ts
│
├── infrastructure/repositories/
│   └── DrizzlePaymentRepository.ts
│
├── pages/payments/
│   ├── index.tsx                                 ← GlobalPaymentsScreen (list view)
│   ├── PaymentDetails.tsx
│   └── PaymentsNavigator.tsx
│
└── utils/
    ├── getDueStatus.ts                           ← SHARED (also used by project timeline)
    ├── mapFeedItemToPaymentCard.ts
    └── sortByPaymentPriority.ts                  ← also exports sortByPaidDateDesc

__tests__/
├── unit/
│   ├── ListPaymentsUseCase.test.ts
│   ├── ListProjectPaymentsFeedUseCase.test.ts
│   ├── MarkPaymentAsPaidUseCase.test.ts
│   ├── RecordPaymentUseCase.test.ts
│   ├── PaymentEntity.test.ts
│   ├── PaymentCard.paidDate.test.tsx
│   ├── PaymentDetails.project.test.tsx
│   ├── PaymentTypeFilterChips.unassigned.test.tsx
│   ├── PaymentsFilterBar.test.tsx
│   ├── DrizzlePaymentRepository.unassigned.test.ts
│   ├── ListGlobalPaymentsUseCase.noProject.test.ts
│   ├── ListGlobalPaymentsUseCase.paid.test.ts
│   ├── useGlobalPaymentsScreen.test.tsx
│   ├── useGlobalPaymentsScreen.unassigned.test.ts
│   ├── mapFeedItemToPaymentCard.test.ts
│   ├── groupPaymentsByDay.test.ts
│   ├── application/usecases/payment/
│   │   ├── AssignProjectToPaymentRecordUseCase.test.ts
│   │   └── GetPaymentDetailsUseCase.test.ts
│   ├── hooks/
│   │   └── usePaymentDetails.test.ts
│   └── payment/
│       ├── GetGlobalAmountPayableUseCase.test.ts
│       ├── LinkPaymentToProjectUseCase.test.ts
│       ├── ListGlobalPaymentsUseCase.test.ts
│       ├── getDueStatus.test.ts
│       ├── sortByPaidDateDesc.test.ts
│       └── sortByPaymentPriority.test.ts
│
└── integration/
    ├── DrizzlePaymentRepository.cardFields.integration.test.ts
    ├── DrizzlePaymentRepository.integration.test.ts
    ├── LinkPaymentToProject.integration.test.ts
    ├── ListProjectPaymentsFeedUseCase.integration.test.ts
    ├── Payment.integration.test.ts
    ├── PaymentDetailsSyntheticProject.integration.test.tsx
    └── PendingPaymentForm.integration.test.tsx
```

> **Tests NOT moved** (task-owned or cross-feature):
> - `__tests__/unit/TaskPaymentValidator.test.ts` — task use case
> - `__tests__/unit/CompleteTaskAndSettlePaymentsUseCase.test.ts` — task use case
> - `__tests__/unit/CompleteTaskUseCase.payment.test.ts` — task use case
> - `__tests__/unit/TimelinePaymentCard.test.tsx` — shared project component
> - `__tests__/integration/CompleteTaskWithPendingPayments.integration.test.ts` — task-owned
> - `__tests__/integration/ProjectCardPendingPaymentUpdate.integration.test.tsx` — cross-feature
> - `__tests__/integration/ProjectDetailPayments.integration.test.tsx` — cross-feature

---

## 3. Target (Vertical-Slice) Layout

> **Mobile-UI review guidance (aligned with receipts/dashboard/invoices conventions):**
>
> - **`screens/`** — Routable, navigator-registered views. All three payments pages
>   (`index.tsx` → `PaymentsScreen.tsx`, `PaymentDetails.tsx`, `PaymentsNavigator.tsx`)
>   are navigation entry-points and belong here.  `PaymentsNavigator` is a stack
>   navigator that is registered directly in the tab bar — it lives in `screens/`
>   alongside the screens it composes.
> - **`components/`** — Composable sub-components used internally by screens.
>   `AmountPayableBanner`, `GlobalQuotationCard`, `PaymentCard`,
>   `PaymentTypeFilterChips`, and `PendingPaymentForm` are all consumed exclusively
>   within the payments screens and belong in `components/`.
> - **`TimelinePaymentCard.tsx`** remains in `src/components/projects/` — it is a
>   project-feature component consumed by `ProjectDetail.tsx`.
> - **`ProjectPickerModal` (payments copy)** is deleted — the canonical version at
>   `src/components/shared/ProjectPickerModal.tsx` (moved there in #192) is the
>   one to use.

```
src/
├── features/
│   └── payments/
│       ├── domain/
│       │   └── PaymentFeedItem.ts              ← was src/domain/entities/ (payment-only type)
│       ├── application/
│       │   ├── PaymentErrors.ts                ← was src/application/errors/
│       │   ├── AssignProjectToPaymentRecordUseCase.ts
│       │   ├── GetGlobalAmountPayableUseCase.ts
│       │   ├── GetPaymentDetailsUseCase.ts
│       │   ├── GetPaymentMetricsUseCase.ts
│       │   ├── LinkPaymentToProjectUseCase.ts
│       │   ├── ListGlobalPaymentsUseCase.ts
│       │   ├── ListPaymentsUseCase.ts
│       │   ├── ListProjectPaymentsFeedUseCase.ts
│       │   ├── ListProjectPaymentsUseCase.ts
│       │   ├── MarkPaymentAsPaidUseCase.ts
│       │   └── RecordPaymentUseCase.ts
│       ├── infrastructure/
│       │   └── DrizzlePaymentRepository.ts     ← was src/infrastructure/repositories/
│       ├── screens/                            ← was src/pages/payments/
│       │   ├── PaymentsScreen.tsx              ← was index.tsx (renamed for clarity)
│       │   ├── PaymentDetails.tsx
│       │   └── PaymentsNavigator.tsx
│       ├── components/                         ← was src/components/payments/
│       │   ├── AmountPayableBanner.tsx
│       │   ├── GlobalQuotationCard.tsx
│       │   ├── PaymentCard.tsx
│       │   ├── PaymentTypeFilterChips.tsx
│       │   └── PendingPaymentForm.tsx
│       │   (ProjectPickerModal.tsx DELETED — use src/components/shared/ version)
│       ├── hooks/                              ← was src/hooks/
│       │   ├── useGlobalPaymentsScreen.ts
│       │   ├── usePaymentDetails.ts
│       │   ├── usePayments.ts
│       │   └── usePaymentsTimeline.ts
│       ├── utils/                              ← was src/utils/
│       │   ├── mapFeedItemToPaymentCard.ts
│       │   └── sortByPaymentPriority.ts
│       ├── tests/
│       │   ├── unit/
│       │   │   ├── screens/
│       │   │   │   └── PaymentDetails.project.test.tsx
│       │   │   ├── components/
│       │   │   │   ├── PaymentCard.paidDate.test.tsx
│       │   │   │   ├── PaymentTypeFilterChips.unassigned.test.tsx
│       │   │   │   └── PaymentsFilterBar.test.tsx
│       │   │   ├── AssignProjectToPaymentRecordUseCase.test.ts
│       │   │   ├── DrizzlePaymentRepository.unassigned.test.ts
│       │   │   ├── GetGlobalAmountPayableUseCase.test.ts
│       │   │   ├── GetPaymentDetailsUseCase.test.ts
│       │   │   ├── LinkPaymentToProjectUseCase.test.ts
│       │   │   ├── ListGlobalPaymentsUseCase.test.ts
│       │   │   ├── ListGlobalPaymentsUseCase.noProject.test.ts
│       │   │   ├── ListGlobalPaymentsUseCase.paid.test.ts
│       │   │   ├── ListPaymentsUseCase.test.ts
│       │   │   ├── ListProjectPaymentsFeedUseCase.test.ts
│       │   │   ├── MarkPaymentAsPaidUseCase.test.ts
│       │   │   ├── PaymentEntity.test.ts
│       │   │   ├── RecordPaymentUseCase.test.ts
│       │   │   ├── getDueStatus.test.ts         ← NOTE: tests shared util; import stays pointing to src/utils/
│       │   │   ├── groupPaymentsByDay.test.ts
│       │   │   ├── mapFeedItemToPaymentCard.test.ts
│       │   │   ├── sortByPaidDateDesc.test.ts
│       │   │   ├── sortByPaymentPriority.test.ts
│       │   │   ├── useGlobalPaymentsScreen.test.tsx
│       │   │   ├── useGlobalPaymentsScreen.unassigned.test.ts
│       │   │   └── usePaymentDetails.test.ts
│       │   └── integration/
│       │       ├── DrizzlePaymentRepository.cardFields.integration.test.ts
│       │       ├── DrizzlePaymentRepository.integration.test.ts
│       │       ├── LinkPaymentToProject.integration.test.ts
│       │       ├── ListProjectPaymentsFeedUseCase.integration.test.ts
│       │       ├── Payment.integration.test.ts
│       │       ├── PaymentDetailsSyntheticProject.integration.test.tsx
│       │       └── PendingPaymentForm.integration.test.tsx
│       └── index.ts                            ← public barrel export
│
├── domain/
│   ├── entities/
│   │   ├── Payment.ts                          ← SHARED — unchanged
│   │   └── PaymentFeedItem.ts                  ← DELETED (moved to feature/domain/)
│   └── repositories/
│       └── PaymentRepository.ts                ← SHARED — unchanged (multi-consumer)
│
├── utils/
│   └── getDueStatus.ts                         ← SHARED — unchanged
│                                                  (also consumed by TimelinePaymentCard,
│                                                   TimelineInvoiceCard which are not
│                                                   part of the payments feature)
│
├── components/
│   ├── payments/                               ← DELETED (all 5 components moved; ProjectPickerModal.tsx deleted)
│   ├── projects/
│   │   └── TimelinePaymentCard.tsx             ← SHARED — unchanged
│   └── shared/
│       └── ProjectPickerModal.tsx              ← SHARED — unchanged (canonical version)
│
├── infrastructure/
│   └── di/registerServices.ts                  ← updated import path only
│
├── application/
│   ├── errors/PaymentErrors.ts                 ← DELETED (moved to feature)
│   └── usecases/payment/                       ← DELETED (all use cases moved)
│
├── hooks/                                      ← 4 payment hooks DELETED (moved to feature)
└── pages/payments/                             ← DELETED (all moved to feature screens/)
```

---

## 4. Shared vs. Feature-Owned Boundaries

| Asset | Owner | Rationale |
|---|---|---|
| `domain/entities/Payment.ts` | **Shared** | Multi-consumer: tasks, invoices, receipts, dashboard, projects |
| `domain/entities/PaymentFeedItem.ts` | **Feature** (`payments/domain/`) | Only consumed by `ListProjectPaymentsFeedUseCase` and `mapFeedItemToPaymentCard` — both payment-owned |
| `domain/repositories/PaymentRepository.ts` | **Shared** | Multi-consumer: task use cases (`CompleteTaskAndSettlePaymentsUseCase`, `TaskPaymentValidator`, `CompleteTaskUseCase`, `ProcessTaskFormUseCase`), invoice cancel use case, dashboard hooks |
| `application/errors/PaymentErrors.ts` | **Feature** (`payments/application/`) | `PaymentNotPendingError` is payment-domain; `InvoiceNotEditableError` is thrown by invoice-cancel but semantically payment-payment boundary — moved and barrel-exported |
| `application/usecases/payment/*` | **Feature** (`payments/application/`) | Payment-specific business logic |
| `infrastructure/repositories/DrizzlePaymentRepository.ts` | **Feature** (`payments/infrastructure/`) | Implements `PaymentRepository`; payment-only adapter |
| `components/payments/AmountPayableBanner.tsx` | **Feature** (`payments/components/`) | Only rendered inside `PaymentsScreen` |
| `components/payments/GlobalQuotationCard.tsx` | **Feature** (`payments/components/`) | Only rendered inside `PaymentsScreen` |
| `components/payments/PaymentCard.tsx` | **Feature** (`payments/components/`) | Only rendered inside `PaymentsScreen` and `PaymentDetails` |
| `components/payments/PaymentTypeFilterChips.tsx` | **Feature** (`payments/components/`) | Only rendered inside `PaymentsScreen` |
| `components/payments/PendingPaymentForm.tsx` | **Feature** (`payments/components/`) | Only rendered inside `PaymentDetails` |
| `components/payments/ProjectPickerModal.tsx` | **Delete** | Superseded by `src/components/shared/ProjectPickerModal.tsx` in #192; `PendingPaymentForm` already imports the shared version |
| `components/projects/TimelinePaymentCard.tsx` | **Shared** | Consumed by `ProjectDetail.tsx` — project-feature component |
| `components/shared/ProjectPickerModal.tsx` | **Shared** | Canonical version used across features |
| `hooks/useGlobalPaymentsScreen.ts` | **Feature** (`payments/hooks/`) | Only consumed by `PaymentsScreen` |
| `hooks/usePayments.ts` | **Feature** (`payments/hooks/`) | Only consumed within payment hooks/screens |
| `hooks/usePaymentDetails.ts` | **Feature** (`payments/hooks/`) | Only consumed by `PaymentDetails` screen |
| `hooks/usePaymentsTimeline.ts` | **Feature** (`payments/hooks/`) | Consumed by `ProjectDetail.tsx` — barrel-exported so callers can update to the barrel import |
| `utils/mapFeedItemToPaymentCard.ts` | **Feature** (`payments/utils/`) | Only used by payment-owned code |
| `utils/sortByPaymentPriority.ts` | **Feature** (`payments/utils/`) | Only used by payment-owned hooks |
| `utils/getDueStatus.ts` | **Shared** | Used by `TimelinePaymentCard`, `TimelineInvoiceCard` (project components) — stays in `src/utils/` |
| `application/usecases/task/CompleteTaskAndSettlePaymentsUseCase.ts` | **Stays** (task layer) | Task use case — not payment-owned; imports `PaymentRepository` from shared domain |
| `application/usecases/task/TaskPaymentValidator.ts` | **Stays** (task layer) | Task use case — not payment-owned |

---

## 5. Barrel Export Design (`src/features/payments/index.ts`)

The barrel exports only the **public API** needed by other modules (navigation, DI wiring, cross-feature callers):

```typescript
// Public screens (navigation entry points)
export { default as PaymentsNavigator } from './screens/PaymentsNavigator';
export { default as PaymentsScreen } from './screens/PaymentsScreen';

// Hooks consumed by cross-feature callers (ProjectDetail.tsx)
export { usePaymentsTimeline } from './hooks/usePaymentsTimeline';
export type { PaymentDayGroup } from './hooks/usePaymentsTimeline';

// Hook consumed by dashboard or other cross-feature callers (if any)
export { usePayments } from './hooks/usePayments';
export type { PaymentsMode, PaymentWithProject } from './hooks/usePayments';

// Errors barrel-exported so CancelInvoiceUseCase can import InvoiceNotEditableError
export { PaymentNotPendingError, InvoiceNotEditableError } from './application/PaymentErrors';

// Domain type (used internally; exported for cross-feature type needs)
export type { PaymentFeedItem } from './domain/PaymentFeedItem';
```

Internal module files (`DrizzlePaymentRepository`, individual use cases, etc.) are **not** re-exported — they are accessed only via the DI container or within the feature.

---

## 6. Import Path Strategy

Relative imports within the module; barrel import for cross-module consumption.

```typescript
// ✅ Within payments module (relative)
import { PaymentRepository } from '../../../domain/repositories/PaymentRepository';
import { PaymentFeedItem } from '../domain/PaymentFeedItem';
import { getDueStatus } from '../../../utils/getDueStatus';     // shared util

// ✅ Cross-module usage (barrel)
import { usePaymentsTimeline, PaymentDayGroup } from '../features/payments';
// or with path alias (Phase 2):
import { PaymentsNavigator } from '@/features/payments';
```

---

## 7. File Migration Map

All moves are **renames only** — no logic changes inside files (only import path strings updated).

### 7.1 Domain

| Source | Destination |
|---|---|
| `src/domain/entities/PaymentFeedItem.ts` | `src/features/payments/domain/PaymentFeedItem.ts` |

> `src/domain/entities/Payment.ts` — **unchanged** (stays shared)
> `src/domain/repositories/PaymentRepository.ts` — **unchanged** (stays shared)

### 7.2 Application — errors

| Source | Destination |
|---|---|
| `src/application/errors/PaymentErrors.ts` | `src/features/payments/application/PaymentErrors.ts` |

### 7.3 Application — use cases

| Source | Destination |
|---|---|
| `src/application/usecases/payment/AssignProjectToPaymentRecordUseCase.ts` | `src/features/payments/application/AssignProjectToPaymentRecordUseCase.ts` |
| `src/application/usecases/payment/GetGlobalAmountPayableUseCase.ts` | `src/features/payments/application/GetGlobalAmountPayableUseCase.ts` |
| `src/application/usecases/payment/GetPaymentDetailsUseCase.ts` | `src/features/payments/application/GetPaymentDetailsUseCase.ts` |
| `src/application/usecases/payment/GetPaymentMetricsUseCase.ts` | `src/features/payments/application/GetPaymentMetricsUseCase.ts` |
| `src/application/usecases/payment/LinkPaymentToProjectUseCase.ts` | `src/features/payments/application/LinkPaymentToProjectUseCase.ts` |
| `src/application/usecases/payment/ListGlobalPaymentsUseCase.ts` | `src/features/payments/application/ListGlobalPaymentsUseCase.ts` |
| `src/application/usecases/payment/ListPaymentsUseCase.ts` | `src/features/payments/application/ListPaymentsUseCase.ts` |
| `src/application/usecases/payment/ListProjectPaymentsFeedUseCase.ts` | `src/features/payments/application/ListProjectPaymentsFeedUseCase.ts` |
| `src/application/usecases/payment/ListProjectPaymentsUseCase.ts` | `src/features/payments/application/ListProjectPaymentsUseCase.ts` |
| `src/application/usecases/payment/MarkPaymentAsPaidUseCase.ts` | `src/features/payments/application/MarkPaymentAsPaidUseCase.ts` |
| `src/application/usecases/payment/RecordPaymentUseCase.ts` | `src/features/payments/application/RecordPaymentUseCase.ts` |

### 7.4 Infrastructure

| Source | Destination |
|---|---|
| `src/infrastructure/repositories/DrizzlePaymentRepository.ts` | `src/features/payments/infrastructure/DrizzlePaymentRepository.ts` |

### 7.5 Screens (was `pages/payments/`)

| Source | Destination | Notes |
|---|---|---|
| `src/pages/payments/index.tsx` | `src/features/payments/screens/PaymentsScreen.tsx` | Renamed from `index.tsx` for clarity |
| `src/pages/payments/PaymentDetails.tsx` | `src/features/payments/screens/PaymentDetails.tsx` | |
| `src/pages/payments/PaymentsNavigator.tsx` | `src/features/payments/screens/PaymentsNavigator.tsx` | |

> `PaymentsNavigator.tsx` imports `PaymentsScreen` (was `./index`) and `PaymentDetails` — relative paths update accordingly.

### 7.6 Components (was `components/payments/`)

| Source | Destination | Notes |
|---|---|---|
| `src/components/payments/AmountPayableBanner.tsx` | `src/features/payments/components/AmountPayableBanner.tsx` | |
| `src/components/payments/GlobalQuotationCard.tsx` | `src/features/payments/components/GlobalQuotationCard.tsx` | |
| `src/components/payments/PaymentCard.tsx` | `src/features/payments/components/PaymentCard.tsx` | |
| `src/components/payments/PaymentTypeFilterChips.tsx` | `src/features/payments/components/PaymentTypeFilterChips.tsx` | |
| `src/components/payments/PendingPaymentForm.tsx` | `src/features/payments/components/PendingPaymentForm.tsx` | |
| `src/components/payments/ProjectPickerModal.tsx` | **DELETE** | Use `src/components/shared/ProjectPickerModal.tsx` |

### 7.7 Hooks (was `hooks/`)

| Source | Destination |
|---|---|
| `src/hooks/useGlobalPaymentsScreen.ts` | `src/features/payments/hooks/useGlobalPaymentsScreen.ts` |
| `src/hooks/usePaymentDetails.ts` | `src/features/payments/hooks/usePaymentDetails.ts` |
| `src/hooks/usePayments.ts` | `src/features/payments/hooks/usePayments.ts` |
| `src/hooks/usePaymentsTimeline.ts` | `src/features/payments/hooks/usePaymentsTimeline.ts` |

### 7.8 Utils (was `utils/`)

| Source | Destination | Notes |
|---|---|---|
| `src/utils/mapFeedItemToPaymentCard.ts` | `src/features/payments/utils/mapFeedItemToPaymentCard.ts` | |
| `src/utils/sortByPaymentPriority.ts` | `src/features/payments/utils/sortByPaymentPriority.ts` | Exports both `sortByPaymentPriority` and `sortByPaidDateDesc` |
| `src/utils/getDueStatus.ts` | **STAYS** in `src/utils/getDueStatus.ts` | Multi-consumer (TimelinePaymentCard, TimelineInvoiceCard) |

### 7.9 Tests

**Unit tests → `src/features/payments/tests/unit/`**

| Source | Destination |
|---|---|
| `__tests__/unit/ListPaymentsUseCase.test.ts` | `src/features/payments/tests/unit/ListPaymentsUseCase.test.ts` |
| `__tests__/unit/ListProjectPaymentsFeedUseCase.test.ts` | `src/features/payments/tests/unit/ListProjectPaymentsFeedUseCase.test.ts` |
| `__tests__/unit/MarkPaymentAsPaidUseCase.test.ts` | `src/features/payments/tests/unit/MarkPaymentAsPaidUseCase.test.ts` |
| `__tests__/unit/RecordPaymentUseCase.test.ts` | `src/features/payments/tests/unit/RecordPaymentUseCase.test.ts` |
| `__tests__/unit/PaymentEntity.test.ts` | `src/features/payments/tests/unit/PaymentEntity.test.ts` |
| `__tests__/unit/DrizzlePaymentRepository.unassigned.test.ts` | `src/features/payments/tests/unit/DrizzlePaymentRepository.unassigned.test.ts` |
| `__tests__/unit/ListGlobalPaymentsUseCase.noProject.test.ts` | `src/features/payments/tests/unit/ListGlobalPaymentsUseCase.noProject.test.ts` |
| `__tests__/unit/ListGlobalPaymentsUseCase.paid.test.ts` | `src/features/payments/tests/unit/ListGlobalPaymentsUseCase.paid.test.ts` |
| `__tests__/unit/useGlobalPaymentsScreen.test.tsx` | `src/features/payments/tests/unit/useGlobalPaymentsScreen.test.tsx` |
| `__tests__/unit/useGlobalPaymentsScreen.unassigned.test.ts` | `src/features/payments/tests/unit/useGlobalPaymentsScreen.unassigned.test.ts` |
| `__tests__/unit/mapFeedItemToPaymentCard.test.ts` | `src/features/payments/tests/unit/mapFeedItemToPaymentCard.test.ts` |
| `__tests__/unit/groupPaymentsByDay.test.ts` | `src/features/payments/tests/unit/groupPaymentsByDay.test.ts` |
| `__tests__/unit/application/usecases/payment/AssignProjectToPaymentRecordUseCase.test.ts` | `src/features/payments/tests/unit/AssignProjectToPaymentRecordUseCase.test.ts` |
| `__tests__/unit/application/usecases/payment/GetPaymentDetailsUseCase.test.ts` | `src/features/payments/tests/unit/GetPaymentDetailsUseCase.test.ts` |
| `__tests__/unit/hooks/usePaymentDetails.test.ts` | `src/features/payments/tests/unit/usePaymentDetails.test.ts` |
| `__tests__/unit/payment/GetGlobalAmountPayableUseCase.test.ts` | `src/features/payments/tests/unit/GetGlobalAmountPayableUseCase.test.ts` |
| `__tests__/unit/payment/LinkPaymentToProjectUseCase.test.ts` | `src/features/payments/tests/unit/LinkPaymentToProjectUseCase.test.ts` |
| `__tests__/unit/payment/ListGlobalPaymentsUseCase.test.ts` | `src/features/payments/tests/unit/ListGlobalPaymentsUseCase.test.ts` |
| `__tests__/unit/payment/getDueStatus.test.ts` | `src/features/payments/tests/unit/getDueStatus.test.ts` |
| `__tests__/unit/payment/sortByPaidDateDesc.test.ts` | `src/features/payments/tests/unit/sortByPaidDateDesc.test.ts` |
| `__tests__/unit/payment/sortByPaymentPriority.test.ts` | `src/features/payments/tests/unit/sortByPaymentPriority.test.ts` |

**Unit tests — component/screen sub-directories:**

| Source | Destination |
|---|---|
| `__tests__/unit/PaymentCard.paidDate.test.tsx` | `src/features/payments/tests/unit/components/PaymentCard.paidDate.test.tsx` |
| `__tests__/unit/PaymentTypeFilterChips.unassigned.test.tsx` | `src/features/payments/tests/unit/components/PaymentTypeFilterChips.unassigned.test.tsx` |
| `__tests__/unit/PaymentsFilterBar.test.tsx` | `src/features/payments/tests/unit/components/PaymentsFilterBar.test.tsx` |
| `__tests__/unit/PaymentDetails.project.test.tsx` | `src/features/payments/tests/unit/screens/PaymentDetails.project.test.tsx` |

**Integration tests → `src/features/payments/tests/integration/`**

| Source | Destination |
|---|---|
| `__tests__/integration/DrizzlePaymentRepository.cardFields.integration.test.ts` | `src/features/payments/tests/integration/DrizzlePaymentRepository.cardFields.integration.test.ts` |
| `__tests__/integration/DrizzlePaymentRepository.integration.test.ts` | `src/features/payments/tests/integration/DrizzlePaymentRepository.integration.test.ts` |
| `__tests__/integration/LinkPaymentToProject.integration.test.ts` | `src/features/payments/tests/integration/LinkPaymentToProject.integration.test.ts` |
| `__tests__/integration/ListProjectPaymentsFeedUseCase.integration.test.ts` | `src/features/payments/tests/integration/ListProjectPaymentsFeedUseCase.integration.test.ts` |
| `__tests__/integration/Payment.integration.test.ts` | `src/features/payments/tests/integration/Payment.integration.test.ts` |
| `__tests__/integration/PaymentDetailsSyntheticProject.integration.test.tsx` | `src/features/payments/tests/integration/PaymentDetailsSyntheticProject.integration.test.tsx` |
| `__tests__/integration/PendingPaymentForm.integration.test.tsx` | `src/features/payments/tests/integration/PendingPaymentForm.integration.test.tsx` |

**Tests that STAY in `__tests__/` (task-owned or cross-feature):**

| File | Reason |
|---|---|
| `__tests__/unit/TaskPaymentValidator.test.ts` | Task use case — not payment-owned |
| `__tests__/unit/CompleteTaskAndSettlePaymentsUseCase.test.ts` | Task use case |
| `__tests__/unit/CompleteTaskUseCase.payment.test.ts` | Task use case |
| `__tests__/unit/TimelinePaymentCard.test.tsx` | Shared project component |
| `__tests__/integration/CompleteTaskWithPendingPayments.integration.test.ts` | Task-owned integration |
| `__tests__/integration/ProjectCardPendingPaymentUpdate.integration.test.tsx` | Cross-feature (project + payment) |
| `__tests__/integration/ProjectDetailPayments.integration.test.tsx` | Cross-feature (project + payment) |

---

## 8. Import Updates Required After Migration

### 8.1 Within-module imports (relative — updated automatically on rename)

All files within `src/features/payments/` import each other relatively:

```typescript
// Example: PaymentsScreen.tsx (was src/pages/payments/index.tsx)
// Before: import { useGlobalPaymentsScreen } from '../../hooks/useGlobalPaymentsScreen';
// After:  import { useGlobalPaymentsScreen } from '../hooks/useGlobalPaymentsScreen';

// Example: GetPaymentDetailsUseCase.ts (was src/application/usecases/payment/...)
// Before: import { getDueStatus } from '../../../utils/getDueStatus';
// After:  import { getDueStatus } from '../../../utils/getDueStatus';  // stays (shared util)

// Before: import { PaymentFeedItem } from '../../../domain/entities/PaymentFeedItem';
// After:  import { PaymentFeedItem } from '../domain/PaymentFeedItem';
```

### 8.2 External callers that must update imports

| File | Current import | New import |
|---|---|---|
| `src/pages/tabs/index.tsx` | `'../payments/PaymentsNavigator'` | `'../../features/payments'` (barrel) |
| `src/pages/projects/ProjectDetail.tsx` | `'../../hooks/usePaymentsTimeline'` | `'../../features/payments'` (barrel) |
| `src/application/usecases/task/CompleteTaskAndSettlePaymentsUseCase.ts` | `'../payment/MarkPaymentAsPaidUseCase'` | `'../../../features/payments/application/MarkPaymentAsPaidUseCase'` |
| `src/features/invoices/application/CancelInvoiceUseCase.ts` | `'../../../application/errors/PaymentErrors'` (if applicable) | `'../../../features/payments'` (barrel) |
| `src/infrastructure/di/registerServices.ts` | `'../repositories/DrizzlePaymentRepository'` | `'../../features/payments/infrastructure/DrizzlePaymentRepository'` |
| `src/components/projects/TimelinePaymentCard.tsx` | `'../../utils/getDueStatus'` | **unchanged** (`getDueStatus` stays in `src/utils/`) |
| `src/features/dashboard/hooks/useProjectsOverview.ts` | payment hook imports | via barrel if applicable |

> **Note on `PendingPaymentForm.tsx` → `ProjectPickerModal`:** Verify whether
> `PendingPaymentForm` currently imports from `'./ProjectPickerModal'` (the stale
> payments copy) or `'../shared/ProjectPickerModal'` (canonical). If the former,
> update the import to point to `src/components/shared/ProjectPickerModal` as part
> of this refactor.

### 8.3 Test import path updates

All moved test files use paths like `../../src/application/usecases/payment/...`.
After migration, paths become relative within the module:

```typescript
// Before (from __tests__/unit/ListPaymentsUseCase.test.ts):
import { ListPaymentsUseCase } from '../../src/application/usecases/payment/ListPaymentsUseCase';

// After (from src/features/payments/tests/unit/ListPaymentsUseCase.test.ts):
import { ListPaymentsUseCase } from '../../application/ListPaymentsUseCase';
```

---

## 9. DI Registration Update

`src/infrastructure/di/registerServices.ts` registers `DrizzlePaymentRepository` as
`'PaymentRepository'`. After migration only the import path changes; the token and
runtime behaviour are identical:

```typescript
// Before
import { DrizzlePaymentRepository } from '../repositories/DrizzlePaymentRepository';

// After
import { DrizzlePaymentRepository } from '../../features/payments/infrastructure/DrizzlePaymentRepository';
```

No new DI tokens are introduced.

---

## 10. UI Component Design Considerations

_Reviewed with `@mobile-ui` agent — consistent with receipts/dashboard/invoices conventions._

### 10.1 `screens/` — navigation entry points

| Screen | Notes |
|---|---|
| `PaymentsScreen.tsx` (was `index.tsx`) | Rename provides a self-describing name consistent with the codebase convention (`DashboardScreen`, `InvoiceScreen`). The `PaymentsNavigator` registers this as `PaymentsList`. |
| `PaymentDetails.tsx` | Detail/edit screen; registered as `PaymentDetails` stack screen. |
| `PaymentsNavigator.tsx` | Stack navigator; registered in the tab bar via `src/pages/tabs/index.tsx`. Lives in `screens/` as it is the navigation entry-point for the entire payments tab. |

### 10.2 `components/` — sub-components

All five components are used exclusively within payments screens:

| Component | Host screen |
|---|---|
| `AmountPayableBanner.tsx` | `PaymentsScreen` |
| `GlobalQuotationCard.tsx` | `PaymentsScreen` |
| `PaymentCard.tsx` | `PaymentsScreen`, `PaymentDetails` |
| `PaymentTypeFilterChips.tsx` | `PaymentsScreen` |
| `PendingPaymentForm.tsx` | `PaymentDetails` |

No visual or prop-interface changes in this refactor.

### 10.3 `TimelinePaymentCard` (shared — stays)

`TimelinePaymentCard.tsx` lives in `src/components/projects/` and is consumed by
`ProjectDetail.tsx`. It is **not** part of the payments feature module.  It imports
`getDueStatus` from `src/utils/getDueStatus.ts` (stays shared) and `Payment` from
`src/domain/entities/Payment.ts` (stays shared) — neither of those paths change.

---

## 11. Jest Configuration

No changes to `jest.config.js`. The default `testMatch` pattern
`**/?(*.)+(spec|test).[jt]s?(x)` discovers tests anywhere under `src/`, so tests
inside `src/features/payments/tests/` are found automatically.

---

## 12. Acceptance Criteria

1. `src/features/payments/` exists with `domain`, `application`, `infrastructure`, `screens`, `components`, `hooks`, `utils`, `tests` sub-directories.
2. All payment-owned files have been moved (see Section 7); old source paths deleted.
3. `src/domain/entities/Payment.ts` and `src/domain/repositories/PaymentRepository.ts` **are unchanged and in place**.
4. `src/utils/getDueStatus.ts` **is unchanged and in place**.
5. `src/components/payments/ProjectPickerModal.tsx` is **deleted**.
6. All import paths updated; `npx tsc --noEmit` passes with 0 errors.
7. All payment-specific tests (unit + integration) pass from their new location under `src/features/payments/tests/`.
8. Tests that stayed in `__tests__/` (task-owned, cross-feature) continue to pass.
9. No other feature's tests regress (full suite green).
10. `src/features/payments/index.ts` barrel exports the public API (Section 5).
11. **No runtime behaviour changes** — existing screens, navigation, and DI wiring function identically.

---

## 13. Out of Scope (This PR)

- Migration of other features (`tasks`, `quotations`, `projects`, etc.)
- Adding `@/features/*` TypeScript path aliases
- Any new functionality, UI changes, or new test scenarios beyond file relocation
- Moving `getDueStatus.ts` (used by cross-feature project timeline components)
- Moving `TimelinePaymentCard.tsx` (owned by project feature)
- Refactoring `CompleteTaskAndSettlePaymentsUseCase` or `TaskPaymentValidator` (task-owned)

---

## 14. Migration Steps (Developer Checklist)

- [ ] Create `src/features/payments/` directory structure
- [ ] Move domain type: `PaymentFeedItem.ts` → `features/payments/domain/`
- [ ] Move `PaymentErrors.ts` → `features/payments/application/`
- [ ] Move all 11 payment use cases → `features/payments/application/`
- [ ] Move `DrizzlePaymentRepository.ts` → `features/payments/infrastructure/`
- [ ] Move routable screens (`index.tsx` → `PaymentsScreen.tsx`, `PaymentDetails.tsx`, `PaymentsNavigator.tsx`) → `features/payments/screens/`
- [ ] Move 5 components (excluding `ProjectPickerModal.tsx`) → `features/payments/components/`
- [ ] Delete `src/components/payments/ProjectPickerModal.tsx` (stale duplicate); verify `PendingPaymentForm` imports from `src/components/shared/`
- [ ] Move 4 hooks → `features/payments/hooks/`
- [ ] Move 2 utils (`mapFeedItemToPaymentCard`, `sortByPaymentPriority`) → `features/payments/utils/`
- [ ] Create `src/features/payments/index.ts` barrel
- [ ] Update all within-module relative imports
- [ ] Update external callers (DI, navigation, project screens) to use new paths / barrel
- [ ] Update `CompleteTaskAndSettlePaymentsUseCase.ts` import for `MarkPaymentAsPaidUseCase`
- [ ] Update `CancelInvoiceUseCase.ts` import for `InvoiceNotEditableError` (if applicable — via barrel)
- [ ] Move test files to `src/features/payments/tests/` (see Section 7.9)
- [ ] Update test import paths (relative within module)
- [ ] Run `npx tsc --noEmit` — 0 errors
- [ ] Run `npm test` — full suite green
- [ ] Delete empty source directories (`src/application/usecases/payment/`, `src/components/payments/`, `src/pages/payments/`)
