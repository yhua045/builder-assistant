# Design: Vertical-Slice Architecture — Invoices Module

**Date:** 2026-04-28
**Issue:** [#212 — Adopt Vertical-Slice (Modular) Architecture](https://github.com/yhua045/builder-assistant/issues/212)
**Inspired by:**
- [design/issue-212-vertical-slice-architecture.md](issue-212-vertical-slice-architecture.md) (Receipts pilot)
- [design/dashboard-vertical-slice-architecture.md](dashboard-vertical-slice-architecture.md) (Dashboard)
**Type:** Structural Refactor (no runtime behaviour changes)

---

## 1. Goal & Motivation

Apply the same vertical-slice (feature-module) pattern established for `receipts` and
`dashboard` to the `invoices` module.  All invoice-owned files are gathered into a
self-contained module under `src/features/invoices/`, making ownership explicit and
eliminating cross-layer scattering.

The Clean Architecture dependency direction is preserved inside the module:

```
screens/ → hooks/ → application/ → domain/
components/ ← hooks/ (ViewModel props)
                ↓
         infrastructure/
```

> **Key difference from `receipts`:** The `InvoiceRepository` interface is consumed by
> payment, quotation, and task use cases that live _outside_ the invoices feature.  It
> therefore **stays shared** in `src/domain/repositories/InvoiceRepository.ts`.  This
> is the same treatment applied to `domain/entities/Invoice.ts`.  The receipts module
> did not have this multi-consumer pattern for its repository interface.

---

## 2. Current (Horizontal) Layout

```
src/
├── application/
│   ├── ai/
│   │   ├── IInvoiceNormalizer.ts       ← invoice interface + types
│   │   └── InvoiceNormalizer.ts        ← concrete rules-based normalizer
│   └── usecases/invoice/
│       ├── CancelInvoiceUseCase.ts
│       ├── CreateInvoiceUseCase.ts
│       ├── DeleteInvoiceUseCase.ts
│       ├── GetInvoiceByIdUseCase.ts
│       ├── LinkInvoiceToProjectUseCase.ts
│       ├── ListInvoicesUseCase.ts
│       ├── MarkInvoiceAsPaidUseCase.ts
│       ├── ProcessInvoiceUploadUseCase.ts
│       └── UpdateInvoiceUseCase.ts
│
├── components/invoices/
│   ├── ExtractionResultsPanel.tsx
│   ├── InvoiceForm.tsx
│   ├── InvoiceLifecycleActions.tsx
│   └── InvoiceUploadSection.tsx
│
├── domain/
│   ├── entities/Invoice.ts             ← SHARED entity (unchanged)
│   └── repositories/InvoiceRepository.ts ← SHARED interface (unchanged)
│
├── hooks/
│   ├── useInvoices.ts
│   └── useInvoiceUpload.ts
│
├── infrastructure/repositories/
│   └── DrizzleInvoiceRepository.ts
│
├── pages/invoices/
│   ├── InvoiceDetailPage.tsx
│   ├── InvoiceListPage.tsx
│   └── InvoiceScreen.tsx
│
└── utils/
    ├── normalizedInvoiceToFormValues.ts
    ├── normalizedInvoiceToQuotationFormValues.ts
    └── resolveInvoiceDueDate.ts

__tests__/
├── unit/
│   ├── CancelInvoiceUseCase.test.ts
│   ├── CreateInvoiceUseCase.test.ts
│   ├── GetInvoiceByIdUseCase.test.ts
│   ├── InvoiceDetailPage.test.tsx
│   ├── InvoiceEntity.cancel.test.ts
│   ├── InvoiceEntity.validation.test.ts
│   ├── InvoiceForm.test.tsx
│   ├── InvoiceLifecycleActions.test.tsx
│   ├── InvoiceListPage.test.tsx
│   ├── InvoiceNormalizer.test.ts
│   ├── InvoiceScreen.test.tsx
│   ├── InvoiceUploadSection.test.tsx
│   ├── ListInvoicesUseCase.test.ts
│   ├── MarkInvoiceAsPaidUseCase.test.ts
│   ├── ProcessInvoiceUploadUseCase.test.ts
│   ├── TimelineInvoiceCard.test.tsx    ← STAYS (component not moved)
│   ├── UpdateInvoiceUseCase.test.ts
│   ├── normalizedInvoiceToFormValues.test.ts
│   ├── normalizedInvoiceToQuotationFormValues.test.ts
│   ├── resolveInvoiceDueDate.test.ts
│   ├── useInvoices.test.tsx
│   ├── hooks/useInvoiceUpload.test.ts
│   ├── payment/LinkInvoiceToProjectUseCase.test.ts
│   └── __snapshots__/
│       ├── InvoiceForm.test.tsx.snap
│       └── InvoiceLifecycleActions.test.tsx.snap
└── integration/
    ├── InvoicePayment.integration.test.tsx
    ├── InvoiceRepository.integration.test.ts
    ├── InvoiceScreen.integration.test.tsx
    ├── LinkInvoiceToProject.integration.test.ts
    └── ProcessInvoiceUpload.integration.test.ts
```

---

## 3. Target (Vertical-Slice) Layout

> **Mobile-UI review (2026-04-28):** Apply the same `screens/` / `components/` split
> used in the `receipts` and `dashboard` modules.
>
> - **`screens/`** — Routable entry points wired to React Navigation.
>   All three pages (`InvoiceScreen`, `InvoiceListPage`, `InvoiceDetailPage`) are
>   navigable routes and belong here.
> - **`components/`** — Composable sub-components used by screens or by each other.
>   `ExtractionResultsPanel`, `InvoiceForm`, `InvoiceLifecycleActions`, and
>   `InvoiceUploadSection` are all sub-components used internally by `InvoiceScreen`
>   or `InvoiceDetailPage` and belong in `components/`.
>
> `TimelineInvoiceCard` is currently in `src/components/projects/` and is consumed by
> `ProjectDetail.tsx` and `PaymentsNavigator.tsx` — neither of which is part of the
> invoices feature.  It is **not moved**; it remains a shared project/payments UI
> component.

```
src/
├── features/
│   └── invoices/
│       ├── application/
│       │   ├── IInvoiceNormalizer.ts           ← was src/application/ai/
│       │   ├── InvoiceNormalizer.ts            ← was src/application/ai/
│       │   ├── CancelInvoiceUseCase.ts         ← was src/application/usecases/invoice/
│       │   ├── CreateInvoiceUseCase.ts
│       │   ├── DeleteInvoiceUseCase.ts
│       │   ├── GetInvoiceByIdUseCase.ts
│       │   ├── LinkInvoiceToProjectUseCase.ts
│       │   ├── ListInvoicesUseCase.ts
│       │   ├── MarkInvoiceAsPaidUseCase.ts
│       │   ├── ProcessInvoiceUploadUseCase.ts
│       │   └── UpdateInvoiceUseCase.ts
│       ├── infrastructure/
│       │   └── DrizzleInvoiceRepository.ts     ← was src/infrastructure/repositories/
│       ├── screens/                            ← was src/pages/invoices/
│       │   ├── InvoiceScreen.tsx
│       │   ├── InvoiceListPage.tsx
│       │   └── InvoiceDetailPage.tsx
│       ├── components/                         ← was src/components/invoices/
│       │   ├── ExtractionResultsPanel.tsx
│       │   ├── InvoiceForm.tsx
│       │   ├── InvoiceLifecycleActions.tsx
│       │   └── InvoiceUploadSection.tsx
│       ├── hooks/                              ← was src/hooks/
│       │   ├── useInvoices.ts
│       │   └── useInvoiceUpload.ts
│       ├── utils/                              ← was src/utils/
│       │   ├── normalizedInvoiceToFormValues.ts
│       │   ├── normalizedInvoiceToQuotationFormValues.ts
│       │   └── resolveInvoiceDueDate.ts
│       ├── tests/
│       │   ├── unit/
│       │   │   ├── screens/
│       │   │   │   ├── InvoiceScreen.test.tsx
│       │   │   │   ├── InvoiceListPage.test.tsx
│       │   │   │   └── InvoiceDetailPage.test.tsx
│       │   │   ├── components/
│       │   │   │   ├── InvoiceForm.test.tsx
│       │   │   │   ├── InvoiceLifecycleActions.test.tsx
│       │   │   │   ├── InvoiceUploadSection.test.tsx
│       │   │   │   └── __snapshots__/
│       │   │   │       ├── InvoiceForm.test.tsx.snap
│       │   │   │       └── InvoiceLifecycleActions.test.tsx.snap
│       │   │   ├── CancelInvoiceUseCase.test.ts
│       │   │   ├── CreateInvoiceUseCase.test.ts
│       │   │   ├── DeleteInvoiceUseCase.test.ts  ← new (if missing, scaffold)
│       │   │   ├── GetInvoiceByIdUseCase.test.ts
│       │   │   ├── InvoiceEntity.cancel.test.ts
│       │   │   ├── InvoiceEntity.validation.test.ts
│       │   │   ├── InvoiceNormalizer.test.ts
│       │   │   ├── LinkInvoiceToProjectUseCase.test.ts
│       │   │   ├── ListInvoicesUseCase.test.ts
│       │   │   ├── MarkInvoiceAsPaidUseCase.test.ts
│       │   │   ├── ProcessInvoiceUploadUseCase.test.ts
│       │   │   ├── UpdateInvoiceUseCase.test.ts
│       │   │   ├── normalizedInvoiceToFormValues.test.ts
│       │   │   ├── normalizedInvoiceToQuotationFormValues.test.ts
│       │   │   ├── resolveInvoiceDueDate.test.ts
│       │   │   ├── useInvoices.test.tsx
│       │   │   └── useInvoiceUpload.test.ts
│       │   └── integration/
│       │       ├── InvoicePayment.integration.test.tsx
│       │       ├── InvoiceRepository.integration.test.ts
│       │       ├── InvoiceScreen.integration.test.tsx
│       │       ├── LinkInvoiceToProject.integration.test.ts
│       │       └── ProcessInvoiceUpload.integration.test.ts
│       └── index.ts                             ← public barrel export
│
├── domain/                                      ← SHARED (unchanged)
│   ├── entities/Invoice.ts                      ← stays shared
│   └── repositories/InvoiceRepository.ts        ← stays shared (multi-consumer)
│
├── infrastructure/                              ← SHARED infra (unchanged except DI)
│   ├── di/registerServices.ts                   ← updated import paths only
│   └── …                                        ← other adapters unchanged
│
├── application/
│   ├── ai/                                      ← IInvoiceNormalizer + InvoiceNormalizer DELETED
│   └── usecases/invoice/                        ← all use cases DELETED
│
├── components/invoices/                         ← DELETED (all moved to feature)
├── pages/invoices/                              ← DELETED (all moved to feature)
├── hooks/                                       ← useInvoices + useInvoiceUpload DELETED
└── utils/                                       ← 3 invoice utils DELETED
```

---

## 4. Shared vs. Feature-Owned Boundaries

| Asset | Owner | Rationale |
|---|---|---|
| `domain/entities/Invoice.ts` | **Shared** | Used by invoices, payments, quotations, tasks, dashboard |
| `domain/repositories/InvoiceRepository.ts` | **Shared** | Consumed by 5 payment use cases, 3 quotation use cases, 3 task use cases, and 6 global hooks — **multi-consumer** |
| `application/ai/IInvoiceNormalizer.ts` | **Feature** (`invoices/application/`) | Consumed only by invoice-owned code + dashboard (dashboard updated to use barrel) |
| `application/ai/InvoiceNormalizer.ts` | **Feature** (`invoices/application/`) | Same as above |
| `application/usecases/invoice/*` | **Feature** (`invoices/application/`) | Invoice-specific business logic |
| `infrastructure/repositories/DrizzleInvoiceRepository.ts` | **Feature** (`invoices/infrastructure/`) | Implements `InvoiceRepository`; invoice-only adapter |
| `components/invoices/*` | **Feature** (`invoices/components/`) | UI sub-components exclusively used by invoice screens |
| `pages/invoices/*` | **Feature** (`invoices/screens/`) | Routable invoice screens |
| `hooks/useInvoices.ts` | **Feature** (`invoices/hooks/`) | Only called by invoice screens and `useInvoiceUpload` |
| `hooks/useInvoiceUpload.ts` | **Feature** (`invoices/hooks/`) | Only called by `InvoiceScreen` |
| `utils/normalizedInvoiceToFormValues.ts` | **Feature** (`invoices/utils/`) | Only used within invoice code |
| `utils/normalizedInvoiceToQuotationFormValues.ts` | **Feature** (`invoices/utils/`) | Uses `NormalizedInvoice` types; no current callers outside invoices — barrel-exported for future quotation use |
| `utils/resolveInvoiceDueDate.ts` | **Feature** (`invoices/utils/`) | Invoice business logic; `usePayments.ts` updated to import via barrel |
| `components/projects/TimelineInvoiceCard.tsx` | **Shared** (`components/projects/`) | Used by `ProjectDetail.tsx` and `PaymentsNavigator.tsx` — stays put |
| `infrastructure/ocr/MobileOcrAdapter.ts` | **Shared** | Used by invoices + receipts + quotations |
| `application/services/IOcrAdapter.ts` | **Shared** | Cross-feature OCR port |
| `infrastructure/database/schema.ts` | **Shared** | Single Drizzle schema |
| `infrastructure/di/container.ts` | **Shared** | Global DI container (no API changes, import paths updated) |

> **Why `InvoiceRepository` stays shared:**
> Five payment use cases, three quotation use cases, three task use cases, and six
> global hooks (`usePayments`, `usePaymentsTimeline`, `useQuotationTimeline`,
> `useQuotations`, `useTasks`, `useAcceptQuote`) all depend on `InvoiceRepository`.
> Moving it into the invoices feature would create a web of cross-feature barrel
> imports in non-invoice code.  The shared boundary is the correct call here — this
> mirrors `domain/entities/Invoice.ts` which is similarly shared.

---

## 5. Barrel Export Design (`src/features/invoices/index.ts`)

Exports only the **public API** needed by other modules:

```typescript
// Public screens (navigation entry points)
export { InvoiceScreen } from './screens/InvoiceScreen';
export { default as InvoiceListPage } from './screens/InvoiceListPage';
export { default as InvoiceDetailPage } from './screens/InvoiceDetailPage';

// Public hooks consumed by cross-feature callers
export { useInvoices } from './hooks/useInvoices';

// Public types consumed by dashboard, payments, tests
export type { IInvoiceNormalizer, NormalizedInvoice, NormalizedInvoiceLineItem, InvoiceCandidates } from './application/IInvoiceNormalizer';
export { InvoiceNormalizer } from './application/InvoiceNormalizer';

// Utility consumed by usePayments (global hook)
export { resolveInvoiceDueDate } from './utils/resolveInvoiceDueDate';

// Utility that may be consumed by quotation feature in future
export { normalizedInvoiceToQuotationFormValues } from './utils/normalizedInvoiceToQuotationFormValues';
```

Internal files (`DrizzleInvoiceRepository`, individual use cases, `useInvoiceUpload`,
`normalizedInvoiceToFormValues`, components, `ExtractionResultsPanel`) are **not**
re-exported — they are implementation details accessed only through hooks or the DI
container.

---

## 6. Import Path Strategy

### 6.1 Within the invoices feature (relative imports)

```typescript
// screens/InvoiceScreen.tsx
import { useInvoiceUpload } from '../hooks/useInvoiceUpload';
import { ExtractionResultsPanel } from '../components/ExtractionResultsPanel';
import { InvoiceForm } from '../components/InvoiceForm';
import type { IInvoiceNormalizer } from '../application/IInvoiceNormalizer';

// screens/InvoiceDetailPage.tsx
import { useInvoices } from '../hooks/useInvoices';
import { InvoiceForm } from '../components/InvoiceForm';

// hooks/useInvoices.ts  — InvoiceRepository stays SHARED
import { InvoiceRepository } from '../../../domain/repositories/InvoiceRepository';
import { CreateInvoiceUseCase } from '../application/CreateInvoiceUseCase';
// …

// hooks/useInvoiceUpload.ts
import { IInvoiceNormalizer, NormalizedInvoice } from '../application/IInvoiceNormalizer';
import { ProcessInvoiceUploadUseCase } from '../application/ProcessInvoiceUploadUseCase';
import { normalizedInvoiceToFormValues } from '../utils/normalizedInvoiceToFormValues';
import { useInvoices } from './useInvoices';

// application/ProcessInvoiceUploadUseCase.ts — InvoiceRepository stays SHARED
import { InvoiceRepository } from '../../../domain/repositories/InvoiceRepository';
import { IInvoiceNormalizer } from './IInvoiceNormalizer';

// infrastructure/DrizzleInvoiceRepository.ts — InvoiceRepository stays SHARED
import { InvoiceRepository, InvoiceFilterParams } from '../../../domain/repositories/InvoiceRepository';
```

### 6.2 External callers updated to use barrel

| Caller | Current import | New import (via barrel) |
|---|---|---|
| `features/dashboard/hooks/useDashboard.ts` | `'../../../application/ai/InvoiceNormalizer'` | `'../../invoices'` |
| `features/dashboard/tests/integration/DashboardInvoiceIntegration.integration.test.tsx` | `'../../../../hooks/useInvoices'` | `'../../../../features/invoices'` |
| `hooks/usePayments.ts` (`resolveInvoiceDueDate`) | `'../utils/resolveInvoiceDueDate'` | `'../features/invoices'` |
| `pages/projects/ProjectsNavigator.tsx` (`InvoiceDetailPage`) | `'../invoices/InvoiceDetailPage'` | `'../../features/invoices'` |
| `features/dashboard/screens/DashboardScreen.tsx` (`InvoiceScreen`) | `'../../../pages/invoices/InvoiceScreen'` | `'../../invoices'` |

### 6.3 Shared `InvoiceRepository` — NO import changes required

All callers of `InvoiceRepository` outside the invoices feature
(`usePayments`, `usePaymentsTimeline`, `useQuotationTimeline`, `useQuotations`,
`useTasks`, `useAcceptQuote`, and the payment/quotation/task use cases) continue to
import from `src/domain/repositories/InvoiceRepository.ts`.  **No path changes
needed for these files.**

### 6.4 DI registration (`registerServices.ts`)

```typescript
// Before
import { DrizzleInvoiceRepository } from '../repositories/DrizzleInvoiceRepository';
import { LinkInvoiceToProjectUseCase } from '../../application/usecases/invoice/LinkInvoiceToProjectUseCase';

// After
import { DrizzleInvoiceRepository } from '../../features/invoices/infrastructure/DrizzleInvoiceRepository';
import { LinkInvoiceToProjectUseCase } from '../../features/invoices/application/LinkInvoiceToProjectUseCase';
// (same for other invoice use cases registered in DI)
```

DI tokens (`'InvoiceRepository'`, class tokens for each use case) remain unchanged.

---

## 7. File Migration Map

All moves are **renames only** — no logic changes.

### 7.1 Application layer

| Source (current) | Destination (new) |
|---|---|
| `src/application/ai/IInvoiceNormalizer.ts` | `src/features/invoices/application/IInvoiceNormalizer.ts` |
| `src/application/ai/InvoiceNormalizer.ts` | `src/features/invoices/application/InvoiceNormalizer.ts` |
| `src/application/usecases/invoice/CancelInvoiceUseCase.ts` | `src/features/invoices/application/CancelInvoiceUseCase.ts` |
| `src/application/usecases/invoice/CreateInvoiceUseCase.ts` | `src/features/invoices/application/CreateInvoiceUseCase.ts` |
| `src/application/usecases/invoice/DeleteInvoiceUseCase.ts` | `src/features/invoices/application/DeleteInvoiceUseCase.ts` |
| `src/application/usecases/invoice/GetInvoiceByIdUseCase.ts` | `src/features/invoices/application/GetInvoiceByIdUseCase.ts` |
| `src/application/usecases/invoice/LinkInvoiceToProjectUseCase.ts` | `src/features/invoices/application/LinkInvoiceToProjectUseCase.ts` |
| `src/application/usecases/invoice/ListInvoicesUseCase.ts` | `src/features/invoices/application/ListInvoicesUseCase.ts` |
| `src/application/usecases/invoice/MarkInvoiceAsPaidUseCase.ts` | `src/features/invoices/application/MarkInvoiceAsPaidUseCase.ts` |
| `src/application/usecases/invoice/ProcessInvoiceUploadUseCase.ts` | `src/features/invoices/application/ProcessInvoiceUploadUseCase.ts` |
| `src/application/usecases/invoice/UpdateInvoiceUseCase.ts` | `src/features/invoices/application/UpdateInvoiceUseCase.ts` |

### 7.2 Infrastructure layer

| Source (current) | Destination (new) |
|---|---|
| `src/infrastructure/repositories/DrizzleInvoiceRepository.ts` | `src/features/invoices/infrastructure/DrizzleInvoiceRepository.ts` |

### 7.3 Screens (formerly `pages/invoices/`)

| Source (current) | Destination (new) |
|---|---|
| `src/pages/invoices/InvoiceScreen.tsx` | `src/features/invoices/screens/InvoiceScreen.tsx` |
| `src/pages/invoices/InvoiceListPage.tsx` | `src/features/invoices/screens/InvoiceListPage.tsx` |
| `src/pages/invoices/InvoiceDetailPage.tsx` | `src/features/invoices/screens/InvoiceDetailPage.tsx` |

### 7.4 Components (formerly `components/invoices/`)

| Source (current) | Destination (new) |
|---|---|
| `src/components/invoices/ExtractionResultsPanel.tsx` | `src/features/invoices/components/ExtractionResultsPanel.tsx` |
| `src/components/invoices/InvoiceForm.tsx` | `src/features/invoices/components/InvoiceForm.tsx` |
| `src/components/invoices/InvoiceLifecycleActions.tsx` | `src/features/invoices/components/InvoiceLifecycleActions.tsx` |
| `src/components/invoices/InvoiceUploadSection.tsx` | `src/features/invoices/components/InvoiceUploadSection.tsx` |

### 7.5 Hooks (formerly `hooks/`)

| Source (current) | Destination (new) |
|---|---|
| `src/hooks/useInvoices.ts` | `src/features/invoices/hooks/useInvoices.ts` |
| `src/hooks/useInvoiceUpload.ts` | `src/features/invoices/hooks/useInvoiceUpload.ts` |

### 7.6 Utils (formerly `utils/`)

| Source (current) | Destination (new) |
|---|---|
| `src/utils/normalizedInvoiceToFormValues.ts` | `src/features/invoices/utils/normalizedInvoiceToFormValues.ts` |
| `src/utils/normalizedInvoiceToQuotationFormValues.ts` | `src/features/invoices/utils/normalizedInvoiceToQuotationFormValues.ts` |
| `src/utils/resolveInvoiceDueDate.ts` | `src/features/invoices/utils/resolveInvoiceDueDate.ts` |

### 7.7 NOT moved (stays shared)

| File | Reason |
|---|---|
| `src/domain/entities/Invoice.ts` | Multi-feature entity |
| `src/domain/repositories/InvoiceRepository.ts` | Consumed by 11+ non-invoice use cases and 6 global hooks |
| `src/components/projects/TimelineInvoiceCard.tsx` | Consumed by `ProjectDetail.tsx` and `PaymentsNavigator.tsx` |

---

## 8. Test Migration Map

### 8.1 Unit tests

> **Convention (established by receipts module):**
> - Screen tests mirror `screens/` → `tests/unit/screens/`
> - Component tests mirror `components/` → `tests/unit/components/`
> - All other tests (use cases, hooks, utils, entity) sit flat under `tests/unit/`
> - Snapshot files follow their test file into the new `__snapshots__/` directory

| Source (current) | Destination (new) |
|---|---|
| `__tests__/unit/CancelInvoiceUseCase.test.ts` | `src/features/invoices/tests/unit/CancelInvoiceUseCase.test.ts` |
| `__tests__/unit/CreateInvoiceUseCase.test.ts` | `src/features/invoices/tests/unit/CreateInvoiceUseCase.test.ts` |
| `__tests__/unit/GetInvoiceByIdUseCase.test.ts` | `src/features/invoices/tests/unit/GetInvoiceByIdUseCase.test.ts` |
| `__tests__/unit/InvoiceEntity.cancel.test.ts` | `src/features/invoices/tests/unit/InvoiceEntity.cancel.test.ts` |
| `__tests__/unit/InvoiceEntity.validation.test.ts` | `src/features/invoices/tests/unit/InvoiceEntity.validation.test.ts` |
| `__tests__/unit/InvoiceNormalizer.test.ts` | `src/features/invoices/tests/unit/InvoiceNormalizer.test.ts` |
| `__tests__/unit/ListInvoicesUseCase.test.ts` | `src/features/invoices/tests/unit/ListInvoicesUseCase.test.ts` |
| `__tests__/unit/MarkInvoiceAsPaidUseCase.test.ts` | `src/features/invoices/tests/unit/MarkInvoiceAsPaidUseCase.test.ts` |
| `__tests__/unit/ProcessInvoiceUploadUseCase.test.ts` | `src/features/invoices/tests/unit/ProcessInvoiceUploadUseCase.test.ts` |
| `__tests__/unit/UpdateInvoiceUseCase.test.ts` | `src/features/invoices/tests/unit/UpdateInvoiceUseCase.test.ts` |
| `__tests__/unit/normalizedInvoiceToFormValues.test.ts` | `src/features/invoices/tests/unit/normalizedInvoiceToFormValues.test.ts` |
| `__tests__/unit/normalizedInvoiceToQuotationFormValues.test.ts` | `src/features/invoices/tests/unit/normalizedInvoiceToQuotationFormValues.test.ts` |
| `__tests__/unit/resolveInvoiceDueDate.test.ts` | `src/features/invoices/tests/unit/resolveInvoiceDueDate.test.ts` |
| `__tests__/unit/useInvoices.test.tsx` | `src/features/invoices/tests/unit/useInvoices.test.tsx` |
| `__tests__/unit/hooks/useInvoiceUpload.test.ts` | `src/features/invoices/tests/unit/useInvoiceUpload.test.ts` |
| `__tests__/unit/payment/LinkInvoiceToProjectUseCase.test.ts` | `src/features/invoices/tests/unit/LinkInvoiceToProjectUseCase.test.ts` |
| `__tests__/unit/InvoiceDetailPage.test.tsx` | `src/features/invoices/tests/unit/screens/InvoiceDetailPage.test.tsx` |
| `__tests__/unit/InvoiceListPage.test.tsx` | `src/features/invoices/tests/unit/screens/InvoiceListPage.test.tsx` |
| `__tests__/unit/InvoiceScreen.test.tsx` | `src/features/invoices/tests/unit/screens/InvoiceScreen.test.tsx` |
| `__tests__/unit/InvoiceForm.test.tsx` | `src/features/invoices/tests/unit/components/InvoiceForm.test.tsx` |
| `__tests__/unit/InvoiceLifecycleActions.test.tsx` | `src/features/invoices/tests/unit/components/InvoiceLifecycleActions.test.tsx` |
| `__tests__/unit/InvoiceUploadSection.test.tsx` | `src/features/invoices/tests/unit/components/InvoiceUploadSection.test.tsx` |
| `__tests__/unit/__snapshots__/InvoiceForm.test.tsx.snap` | `src/features/invoices/tests/unit/components/__snapshots__/InvoiceForm.test.tsx.snap` |
| `__tests__/unit/__snapshots__/InvoiceLifecycleActions.test.tsx.snap` | `src/features/invoices/tests/unit/components/__snapshots__/InvoiceLifecycleActions.test.tsx.snap` |
| `__tests__/unit/TimelineInvoiceCard.test.tsx` | **STAYS** — component not moved |

### 8.2 Integration tests

| Source (current) | Destination (new) |
|---|---|
| `__tests__/integration/InvoicePayment.integration.test.tsx` | `src/features/invoices/tests/integration/InvoicePayment.integration.test.tsx` |
| `__tests__/integration/InvoiceRepository.integration.test.ts` | `src/features/invoices/tests/integration/InvoiceRepository.integration.test.ts` |
| `__tests__/integration/InvoiceScreen.integration.test.tsx` | `src/features/invoices/tests/integration/InvoiceScreen.integration.test.tsx` |
| `__tests__/integration/LinkInvoiceToProject.integration.test.ts` | `src/features/invoices/tests/integration/LinkInvoiceToProject.integration.test.ts` |
| `__tests__/integration/ProcessInvoiceUpload.integration.test.ts` | `src/features/invoices/tests/integration/ProcessInvoiceUpload.integration.test.ts` |

### 8.3 Dashboard tests updated (cross-feature)

| File | Change |
|---|---|
| `src/features/dashboard/tests/unit/useDashboard.test.ts` | Update mock path: `'../../../../application/ai/InvoiceNormalizer'` → `'../../../../features/invoices/application/InvoiceNormalizer'` (or barrel) |
| `src/features/dashboard/tests/integration/DashboardInvoiceIntegration.integration.test.tsx` | Update import: `'../../../../hooks/useInvoices'` → `'../../../../features/invoices'` |

---

## 9. Import Updates Required After Migration

### 9.1 Within-module imports (all become relative)

Every file inside `src/features/invoices/` uses relative paths:

```typescript
// e.g. screens/InvoiceScreen.tsx → hooks
import { useInvoiceUpload } from '../hooks/useInvoiceUpload';
// e.g. hooks/useInvoices.ts → shared domain (not moved)
import { InvoiceRepository } from '../../../domain/repositories/InvoiceRepository';
```

### 9.2 External files to update

| File | What changes |
|---|---|
| `src/features/dashboard/hooks/useDashboard.ts` | `InvoiceNormalizer` import → `'../../invoices'` |
| `src/features/dashboard/tests/unit/useDashboard.test.ts` | Jest mock path for `InvoiceNormalizer` |
| `src/features/dashboard/tests/integration/DashboardInvoiceIntegration.integration.test.tsx` | `useInvoices` import → `'../../../../features/invoices'` |
| `src/features/dashboard/screens/DashboardScreen.tsx` | `InvoiceScreen` import → `'../../invoices'` |
| `src/hooks/usePayments.ts` | `resolveInvoiceDueDate` import → `'../features/invoices'` |
| `src/pages/projects/ProjectsNavigator.tsx` | `InvoiceDetailPage` import → `'../../features/invoices'` |
| `src/infrastructure/di/registerServices.ts` | `DrizzleInvoiceRepository` + invoice use case import paths |

### 9.3 Files that do NOT need import changes

All files importing `InvoiceRepository` from `src/domain/repositories/InvoiceRepository.ts`
remain unchanged — the shared repository interface is not moved.

This includes:
- `src/application/usecases/payment/*.ts` (all 5 files)
- `src/application/usecases/quotation/AcceptQuotationUseCase.ts`,  `AcceptStandaloneQuotationUseCase.ts`, `ApproveQuotationUseCase.ts`
- `src/application/usecases/task/CompleteTaskAndSettlePaymentsUseCase.ts`, `GetTaskDetailsUseCase.ts`, `ProcessTaskFormUseCase.ts`
- `src/hooks/useAcceptQuote.ts`, `usePayments.ts` (the `InvoiceRepository` import only — `resolveInvoiceDueDate` import DOES change), `usePaymentsTimeline.ts`, `useQuotationTimeline.ts`, `useQuotations.ts`, `useTasks.ts`

---

## 10. DI Registration Update

`src/infrastructure/di/registerServices.ts` changes are **import path only**;
DI tokens and factory logic are unchanged:

```typescript
// Before
import { DrizzleInvoiceRepository } from '../repositories/DrizzleInvoiceRepository';
import { LinkInvoiceToProjectUseCase } from '../../application/usecases/invoice/LinkInvoiceToProjectUseCase';
// (and other invoice use cases registered in DI)

// After
import { DrizzleInvoiceRepository } from '../../features/invoices/infrastructure/DrizzleInvoiceRepository';
import { LinkInvoiceToProjectUseCase } from '../../features/invoices/application/LinkInvoiceToProjectUseCase';
// (same pattern for other invoice use cases)
```

---

## 11. UI Component Design

_Reviewed with `@mobile-ui` agent — 2026-04-28._

### 11.1 `screens/` directory — Routable entry points

| Screen | Route | Notes |
|---|---|---|
| `InvoiceScreen.tsx` | Launched as a modal from `DashboardScreen` | Upload entry point; hosts `ExtractionResultsPanel` + `InvoiceForm` |
| `InvoiceListPage.tsx` | Stack navigator root (standalone invoice browsing) | Hosts filter chips + invoice list; uses `useInvoices` |
| `InvoiceDetailPage.tsx` | `InvoiceDetail` in `ProjectsNavigator` | Hosts `InvoiceForm` in view/edit mode; uses `useInvoices` |

All three are navigable routes and correctly placed in `screens/`.

### 11.2 `components/` directory — Composable sub-components

| Component | Used by | Role |
|---|---|---|
| `ExtractionResultsPanel.tsx` | `InvoiceScreen` | Displays AI extraction confidence + results |
| `InvoiceForm.tsx` | `InvoiceScreen`, `InvoiceDetailPage` | Controlled form for invoice fields |
| `InvoiceLifecycleActions.tsx` | `InvoiceDetailPage` | Action buttons (Cancel, Mark Paid, etc.) |
| `InvoiceUploadSection.tsx` | `InvoiceScreen` | File picker + camera upload UI |

None of these are routable — they are correctly placed in `components/`.

### 11.3 `TimelineInvoiceCard.tsx` — Stays in `src/components/projects/`

`TimelineInvoiceCard` renders a card-style invoice summary within timeline and payment
views (`ProjectDetail.tsx`, `PaymentsNavigator.tsx`).  Neither of those callers will
move to the invoices feature in this PR.  Moving the card would create a `projects/` or
`payments/` dependency on the `invoices` barrel, which is premature coupling before
those modules are migrated.

**No change required.** The test `__tests__/unit/TimelineInvoiceCard.test.tsx` also stays.

---

## 12. Jest Configuration

No changes to `jest.config.js` are required.  The default `testMatch` pattern
`**/?(*.)+(spec|test).[jt]s?(x)` discovers tests anywhere under `src/`, including
the new `src/features/invoices/tests/` location.

---

## 13. Acceptance Criteria

1. `src/features/invoices/` exists with `application`, `infrastructure`, `screens`,
   `components`, `hooks`, `utils`, `tests` sub-directories.
2. All invoice-owned files have been moved per Section 7; original paths deleted.
3. `src/domain/repositories/InvoiceRepository.ts` and `src/domain/entities/Invoice.ts`
   remain untouched at their current paths.
4. All within-module import paths are relative; external callers updated per Section 9.
5. `npx tsc --noEmit` passes with 0 errors.
6. All invoice-specific tests (unit + integration) pass from their new location
   under `src/features/invoices/tests/`.
7. Dashboard tests (`useDashboard.test.ts`, `DashboardInvoiceIntegration.integration.test.tsx`)
   continue to pass with updated mock/import paths.
8. No other feature's tests regress (full suite green).
9. `src/features/invoices/index.ts` barrel exports the public API per Section 5.
10. **No runtime behaviour changes** — existing screens, navigation, and DI wiring
    function identically.

---

## 14. Out of Scope (This PR)

- Migration of other features (payments, quotations, tasks, etc.)
- Any `@/features/*` TypeScript path aliases
- Any new functionality or UI changes beyond relocation

---

## 15. Migration Steps (Developer Checklist)

- [ ] Create `src/features/invoices/` directory structure
- [ ] Move application layer: `IInvoiceNormalizer`, `InvoiceNormalizer`, all 9 use cases
- [ ] Move infrastructure: `DrizzleInvoiceRepository`
- [ ] Move screens: `InvoiceScreen`, `InvoiceListPage`, `InvoiceDetailPage` → `screens/`
- [ ] Move components: `ExtractionResultsPanel`, `InvoiceForm`, `InvoiceLifecycleActions`, `InvoiceUploadSection` → `components/`
- [ ] Move hooks: `useInvoices`, `useInvoiceUpload` → `hooks/`
- [ ] Move utils: `normalizedInvoiceToFormValues`, `normalizedInvoiceToQuotationFormValues`, `resolveInvoiceDueDate` → `utils/`
- [ ] Create `src/features/invoices/index.ts` barrel
- [ ] Update all within-module relative imports
- [ ] Update `registerServices.ts` import paths (tokens unchanged)
- [ ] Update `DashboardScreen.tsx`: `InvoiceScreen` import → barrel
- [ ] Update `useDashboard.ts`: `InvoiceNormalizer` import → barrel
- [ ] Update `ProjectsNavigator.tsx`: `InvoiceDetailPage` import → barrel
- [ ] Update `usePayments.ts`: `resolveInvoiceDueDate` import → barrel
- [ ] Move all invoice test files to `src/features/invoices/tests/` (see Section 8)
- [ ] Update test import paths (relative within module; barrel for cross-feature mocks)
- [ ] Update dashboard test mock paths (`useDashboard.test.ts`, `DashboardInvoiceIntegration`)
- [ ] Move snapshot files alongside their test files
- [ ] Run `npx tsc --noEmit` — 0 errors
- [ ] Run `npm test` — full suite green
- [ ] Delete vacated source directories:
  - `src/application/ai/IInvoiceNormalizer.ts`, `InvoiceNormalizer.ts`
  - `src/application/usecases/invoice/`
  - `src/components/invoices/`
  - `src/pages/invoices/`
  - (individual hooks and utils in `src/hooks/` and `src/utils/`)
