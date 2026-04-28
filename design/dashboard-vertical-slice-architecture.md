# Design: Vertical-Slice Architecture — Dashboard Module

**Date:** 2026-04-28
**Inspired by:** [design/issue-212-vertical-slice-architecture.md](issue-212-vertical-slice-architecture.md) (Receipts pilot)
**Type:** Structural Refactor (no runtime behaviour changes)

---

## 1. Goal & Motivation

Apply the same vertical-slice (feature-module) pattern established for the `receipts`
pilot to the `dashboard` module.  All dashboard-owned files are gathered into a single
self-contained module under `src/features/dashboard/`, making ownership explicit and
eliminating cross-layer scattering.

The Clean Architecture dependency direction is preserved inside the module:

```
screens/ → hooks/ → (domain repositories accessed via DI container)
components/ ← hooks/ (ViewModel props)
```

Unlike the `receipts` module, the `dashboard` feature does **not** own any repository
interface or application-layer use case.  Its "application layer" is the
`useProjectsOverview` hook (a pure aggregation query) and the `useDashboard` hook (a
ViewModel). Both move into the feature.

---

## 2. Current (Horizontal) Layout

```
src/
├── pages/
│   └── dashboard/
│       ├── index.tsx                     ← DashboardScreen (routable entry point)
│       └── components/
│           ├── ActiveTasks.tsx
│           ├── AttentionRequiredSection.tsx
│           ├── CashOutflow.tsx
│           ├── HeroSection.tsx
│           ├── PaymentList.tsx
│           ├── PhaseProgressRow.tsx
│           ├── ProjectOverviewCard.tsx
│           ├── TaskIconRow.tsx
│           └── UrgentAlerts.tsx
│
├── components/
│   └── dashboard/
│       └── PendingPaymentBadge.tsx       ← misplaced; dashboard-specific only
│
└── hooks/
    ├── useDashboard.ts                   ← ViewModel for DashboardScreen
    └── useProjectsOverview.ts            ← aggregation query; dashboard-only consumers

__tests__/
├── unit/
│   ├── hooks/useDashboard.test.ts
│   ├── pages/DashboardScreen.test.tsx
│   ├── ProjectOverviewCard.test.tsx
│   ├── TaskIconRow.test.tsx
│   └── useProjectsOverview.test.ts
└── integration/
    ├── DashboardAdHocTask.integration.test.tsx
    └── DashboardInvoiceIntegration.test.tsx
```

---

## 3. Target (Vertical-Slice) Layout

> **Mobile-UI review (2026-04-28):** Apply the same `screens/` / `components/`
> split used in the `receipts` module. `DashboardScreen` is the sole routable entry
> point and belongs in `screens/`. All nine sub-components are composable pieces and
> belong in `components/`. `PendingPaymentBadge` currently lives in the global
> `src/components/dashboard/` folder; since it is consumed exclusively within the
> dashboard feature, it consolidates into `components/`.

```
src/
├── features/
│   └── dashboard/
│       ├── screens/
│       │   └── DashboardScreen.tsx       ← was src/pages/dashboard/index.tsx
│       ├── components/
│       │   ├── ActiveTasks.tsx           ← was src/pages/dashboard/components/
│       │   ├── AttentionRequiredSection.tsx
│       │   ├── CashOutflow.tsx
│       │   ├── HeroSection.tsx
│       │   ├── PaymentList.tsx
│       │   ├── PhaseProgressRow.tsx
│       │   ├── ProjectOverviewCard.tsx
│       │   ├── TaskIconRow.tsx
│       │   ├── UrgentAlerts.tsx
│       │   └── PendingPaymentBadge.tsx   ← was src/components/dashboard/
│       ├── hooks/
│       │   ├── useDashboard.ts           ← was src/hooks/
│       │   └── useProjectsOverview.ts    ← was src/hooks/ (dashboard-only consumers)
│       ├── tests/
│       │   ├── unit/
│       │   │   ├── screens/
│       │   │   │   └── DashboardScreen.test.tsx
│       │   │   ├── useDashboard.test.ts
│       │   │   ├── useProjectsOverview.test.ts
│       │   │   ├── ProjectOverviewCard.test.tsx
│       │   │   └── TaskIconRow.test.tsx
│       │   └── integration/
│       │       ├── DashboardAdHocTask.integration.test.tsx
│       │       └── DashboardInvoiceIntegration.integration.test.tsx
│       └── index.ts                      ← public barrel export
│
├── domain/                               ← SHARED entities (unchanged)
├── infrastructure/                       ← SHARED infra (unchanged)
├── application/                          ← non-dashboard use cases (unchanged)
├── components/                           ← non-dashboard shared components (unchanged)
│   └── dashboard/                        ← DELETED — PendingPaymentBadge moved to feature
├── hooks/                                ← non-dashboard hooks (unchanged)
│   ├── useDashboard.ts                   ← DELETED — moved to feature
│   └── useProjectsOverview.ts            ← DELETED — moved to feature
└── pages/
    └── dashboard/                        ← DELETED — moved to feature
```

---

## 4. Shared vs. Feature-Owned Boundaries

| Asset | Owner | Rationale |
|---|---|---|
| `domain/entities/Task.ts` | **Shared** | Used by tasks, dashboard, cockpit … |
| `domain/entities/Project.ts` | **Shared** | Used by projects, dashboard … |
| `domain/entities/Payment.ts` | **Shared** | Used by payments, dashboard … |
| `domain/repositories/ProjectRepository.ts` | **Shared** | Multi-feature |
| `domain/repositories/TaskRepository.ts` | **Shared** | Multi-feature |
| `domain/repositories/PaymentRepository.ts` | **Shared** | Multi-feature |
| `infrastructure/database/schema.ts` | **Shared** | Single Drizzle schema |
| `infrastructure/di/container.ts` | **Shared** | Global DI container (no changes) |
| `infrastructure/ocr/MobileOcrAdapter.ts` | **Shared** | Used by invoices + dashboard |
| `application/ai/InvoiceNormalizer.ts` | **Shared** | Used by invoices + dashboard |
| `infrastructure/files/PdfThumbnailConverter.ts` | **Shared** | Used by invoices + dashboard |
| `infrastructure/ai/LlmQuotationParser.ts` | **Shared** | Used by quotations + dashboard |
| `features/receipts/infrastructure/LlmReceiptParser.ts` | **receipts feature** | Imported by `useDashboard` via cross-feature barrel |
| `hooks/useProjectsOverview.ts` | **Feature** (`dashboard/hooks/`) | Only consumed by dashboard files |
| `hooks/useDashboard.ts` | **Feature** (`dashboard/hooks/`) | Dashboard ViewModel |
| `pages/dashboard/` (all) | **Feature** (`dashboard/screens/` + `components/`) | Dashboard UI |
| `components/dashboard/PendingPaymentBadge.tsx` | **Feature** (`dashboard/components/`) | Exclusively dashboard |

> **Note on `LlmReceiptParser`:** `useDashboard` imports
> `LlmReceiptParser` from the `receipts` feature barrel to wire the snap-receipt
> parsing strategy. This is a **legitimate cross-feature barrel import** — the
> receipts barrel exports `LlmReceiptParser` as an infrastructure type consumed
> by the dashboard's wiring layer. No direct internal path import is used.

---

## 5. Barrel Export Design (`src/features/dashboard/index.ts`)

```typescript
// Public screen (navigation entry point)
export { default as DashboardScreen } from './screens/DashboardScreen';

// Public types needed by cross-feature callers (e.g. tests, navigation)
export type { ProjectOverview, PhaseOverview } from './hooks/useProjectsOverview';
```

Internal files (`useDashboard`, components, `useProjectsOverview` internals) are **not**
re-exported — they are an implementation detail of the feature.

---

## 6. Import Path Strategy

### 6.1 Within the dashboard feature (relative imports)

```typescript
// screens/DashboardScreen.tsx
import { useDashboard } from '../hooks/useDashboard';

// components/ProjectOverviewCard.tsx
import { ProjectOverview } from '../hooks/useProjectsOverview';
import { PendingPaymentBadge }  from './PendingPaymentBadge';

// components/PhaseProgressRow.tsx
import { PhaseOverview } from '../hooks/useProjectsOverview';
```

### 6.2 Cross-feature import (receipts barrel)

```typescript
// hooks/useDashboard.ts — already correct after receipts migration
import { LlmReceiptParser } from '../receipts/infrastructure/LlmReceiptParser';
// (or via barrel: import type { IReceiptParsingStrategy } from '../receipts')
```

### 6.3 Navigation caller (tabs)

```typescript
// src/pages/tabs/index.tsx — BEFORE
import DashboardScreen from '../dashboard';

// src/pages/tabs/index.tsx — AFTER
import { DashboardScreen } from '../../features/dashboard';
```

### 6.4 TypeScript path alias (optional / Phase 2)

The `@/features/*` alias deferred from the receipts pilot equally applies here.
No new alias is required for this refactor.

---

## 7. File Migration Map

All moves are **renames only** — no logic changes.

| Source (current) | Destination (new) |
|---|---|
| `src/pages/dashboard/index.tsx` | `src/features/dashboard/screens/DashboardScreen.tsx` |
| `src/pages/dashboard/components/ActiveTasks.tsx` | `src/features/dashboard/components/ActiveTasks.tsx` |
| `src/pages/dashboard/components/AttentionRequiredSection.tsx` | `src/features/dashboard/components/AttentionRequiredSection.tsx` |
| `src/pages/dashboard/components/CashOutflow.tsx` | `src/features/dashboard/components/CashOutflow.tsx` |
| `src/pages/dashboard/components/HeroSection.tsx` | `src/features/dashboard/components/HeroSection.tsx` |
| `src/pages/dashboard/components/PaymentList.tsx` | `src/features/dashboard/components/PaymentList.tsx` |
| `src/pages/dashboard/components/PhaseProgressRow.tsx` | `src/features/dashboard/components/PhaseProgressRow.tsx` |
| `src/pages/dashboard/components/ProjectOverviewCard.tsx` | `src/features/dashboard/components/ProjectOverviewCard.tsx` |
| `src/pages/dashboard/components/TaskIconRow.tsx` | `src/features/dashboard/components/TaskIconRow.tsx` |
| `src/pages/dashboard/components/UrgentAlerts.tsx` | `src/features/dashboard/components/UrgentAlerts.tsx` |
| `src/components/dashboard/PendingPaymentBadge.tsx` | `src/features/dashboard/components/PendingPaymentBadge.tsx` |
| `src/hooks/useDashboard.ts` | `src/features/dashboard/hooks/useDashboard.ts` |
| `src/hooks/useProjectsOverview.ts` | `src/features/dashboard/hooks/useProjectsOverview.ts` |
| `__tests__/unit/hooks/useDashboard.test.ts` | `src/features/dashboard/tests/unit/useDashboard.test.ts` |
| `__tests__/unit/pages/DashboardScreen.test.tsx` | `src/features/dashboard/tests/unit/screens/DashboardScreen.test.tsx` |
| `__tests__/unit/ProjectOverviewCard.test.tsx` | `src/features/dashboard/tests/unit/ProjectOverviewCard.test.tsx` |
| `__tests__/unit/TaskIconRow.test.tsx` | `src/features/dashboard/tests/unit/TaskIconRow.test.tsx` |
| `__tests__/unit/useProjectsOverview.test.ts` | `src/features/dashboard/tests/unit/useProjectsOverview.test.ts` |
| `__tests__/integration/DashboardAdHocTask.integration.test.tsx` | `src/features/dashboard/tests/integration/DashboardAdHocTask.integration.test.tsx` |
| `__tests__/integration/DashboardInvoiceIntegration.test.tsx` | `src/features/dashboard/tests/integration/DashboardInvoiceIntegration.integration.test.tsx` |

> **Test co-location convention (identical to receipts pilot):**
> - Screen-level tests mirror `screens/` → `tests/unit/screens/DashboardScreen.test.tsx`
> - Component, hook, and util tests sit flat under `tests/unit/`
> - Integration tests sit flat under `tests/integration/`

---

## 8. Import Updates Required After Migration

### 8.1 Within the dashboard feature module

| File | Old import | New import |
|---|---|---|
| `screens/DashboardScreen.tsx` | `'../../hooks/useDashboard'` | `'../hooks/useDashboard'` |
| `components/ProjectOverviewCard.tsx` | `'../../../hooks/useProjectsOverview'` | `'../hooks/useProjectsOverview'` |
| `components/ProjectOverviewCard.tsx` | `'../../../components/dashboard/PendingPaymentBadge'` | `'./PendingPaymentBadge'` |
| `components/PhaseProgressRow.tsx` | `'../../../hooks/useProjectsOverview'` | `'../hooks/useProjectsOverview'` |

All other intra-component imports within `pages/dashboard/components/` are already
relative (`'./PaymentList'`, etc.) and remain unchanged after the move.

### 8.2 External caller in `src/`

| File | Old import | New import |
|---|---|---|
| `src/pages/tabs/index.tsx` | `import DashboardScreen from '../dashboard'` | `import { DashboardScreen } from '../../features/dashboard'` |

> `DashboardScreen` changes from a **default export** to a **named export** via the
> barrel to align with the receipts module convention. The tab screen passes it
> directly to `<Tab.Screen component={DashboardScreen} />` — no functional impact.

### 8.3 Test import path updates

Each test file's imports are updated to resolve from within `src/features/dashboard/`:

**`tests/unit/useDashboard.test.ts`**

| Old | New |
|---|---|
| `'../../../src/hooks/useProjectsOverview'` | `'../../hooks/useProjectsOverview'` |
| `'../../../src/hooks/useDashboard'` | `'../../hooks/useDashboard'` |
| `import type { ProjectOverview } from '../../../src/hooks/useProjectsOverview'` | `import type { ProjectOverview } from '../../hooks/useProjectsOverview'` |
| `import type { QuickAction } from '../../../src/hooks/useDashboard'` | `import type { QuickAction } from '../../hooks/useDashboard'` |

**`tests/unit/screens/DashboardScreen.test.tsx`**

| Old | New |
|---|---|
| `import DashboardScreen from '../../../src/pages/dashboard'` | `import { DashboardScreen } from '../../../screens/DashboardScreen'` |
| `jest.mock('../../../src/pages/dashboard/components/ProjectOverviewCard', ...)` | `jest.mock('../../../components/ProjectOverviewCard', ...)` |
| `jest.mock('../../../src/pages/dashboard/components/HeroSection', ...)` | `jest.mock('../../../components/HeroSection', ...)` |
| `jest.mock('../../../src/features/receipts/screens/SnapReceiptScreen', ...)` | *(unchanged — cross-feature path)* |
| `jest.mock('../../../src/hooks/useDashboard', ...)` | `jest.mock('../../../hooks/useDashboard', ...)` |
| `import { useDashboard } from '../../../src/hooks/useDashboard'` | `import { useDashboard } from '../../../hooks/useDashboard'` |
| `import type { QuickAction } from '../../../src/hooks/useDashboard'` | `import type { QuickAction } from '../../../hooks/useDashboard'` |

**`tests/unit/ProjectOverviewCard.test.tsx`**

| Old | New |
|---|---|
| `'../../src/pages/dashboard/components/ProjectOverviewCard'` | `'../../components/ProjectOverviewCard'` |
| `'../../src/hooks/useProjectsOverview'` | `'../../hooks/useProjectsOverview'` |
| `jest.mock('../../src/pages/dashboard/components/PhaseProgressRow', ...)` | `jest.mock('../../components/PhaseProgressRow', ...)` |
| `jest.mock('../../src/components/dashboard/PendingPaymentBadge', ...)` | `jest.mock('../../components/PendingPaymentBadge', ...)` |

**`tests/unit/TaskIconRow.test.tsx`**

| Old | New |
|---|---|
| `'../../src/pages/dashboard/components/TaskIconRow'` | `'../../components/TaskIconRow'` |

**`tests/unit/useProjectsOverview.test.ts`**

| Old | New |
|---|---|
| `'../../src/hooks/useProjectsOverview'` | `'../../hooks/useProjectsOverview'` |

**`tests/integration/DashboardAdHocTask.integration.test.tsx`**

| Old | New |
|---|---|
| `import DashboardScreen from '../../src/pages/dashboard'` | `import { DashboardScreen } from '../../screens/DashboardScreen'` |

**`tests/integration/DashboardInvoiceIntegration.integration.test.tsx`**

| Old | New |
|---|---|
| `import DashboardScreen from '../../src/pages/dashboard'` | `import { DashboardScreen } from '../../screens/DashboardScreen'` |
| `jest.mock('../../src/pages/dashboard/components/HeroSection', ...)` | `jest.mock('../../components/HeroSection', ...)` |
| `jest.mock('../../src/pages/dashboard/components/CashOutflow', ...)` | `jest.mock('../../components/CashOutflow', ...)` |
| `jest.mock('../../src/pages/dashboard/components/ActiveTasks', ...)` | `jest.mock('../../components/ActiveTasks', ...)` |
| `jest.mock('../../src/pages/dashboard/components/UrgentAlerts', ...)` | `jest.mock('../../components/UrgentAlerts', ...)` |

---

## 9. DI Registration

The dashboard module does **not** register any adapter in `src/infrastructure/di/`.
The `useDashboard` hook instantiates infrastructure services directly via `useMemo`
(e.g. `MobileOcrAdapter`, `InvoiceNormalizer`, `PdfThumbnailConverter`,
`LlmQuotationParser`, `LlmReceiptParser`).  These are shared infrastructure classes
that remain in their current locations — no DI changes are required.

---

## 10. UI Component Design Considerations

_Reviewed with `@mobile-ui` agent — 2026-04-28._

### Rationale: `screens/` + `components/` (matching receipts convention)

| Directory | Purpose | Contents |
|---|---|---|
| `screens/` | Top-level, **routable** view wired to the bottom-tab navigator | `DashboardScreen.tsx` |
| `components/` | Composable **sub-components** used by the screen | All 9 `pages/dashboard/components/` files + `PendingPaymentBadge` |

### 10.1 `DashboardScreen.tsx`
- Sole routable entry point; registered in `src/pages/tabs/index.tsx`
- MVVM pattern: consumes `useDashboard()` ViewModel hook exclusively — zero
  direct infrastructure imports remain in the screen file
- Layout, modal structure, FAB, and `SafeAreaView` wrapping are unchanged
- Navigation wiring updates import path only (default→named export via barrel)

### 10.2 Sub-components (`components/`)

All nine sub-components are UI-only composable pieces:

| Component | Role | Notes |
|---|---|---|
| `HeroSection` | Empty-state onboarding card | Renders when `!hasProjects` |
| `ProjectOverviewCard` | Per-project summary card with expand/collapse | Uses `PendingPaymentBadge`, `PhaseProgressRow` |
| `PhaseProgressRow` | Progress bar + task icons per phase | Uses `TaskIconRow`, `AttentionRequiredSection` |
| `TaskIconRow` | Icon strip of task statuses | Pure presentational |
| `AttentionRequiredSection` | Blocked task warning strip | Pure presentational |
| `PendingPaymentBadge` | Monetary badge (was in shared `components/dashboard/`) | Moved to feature; no callers outside dashboard |
| `ActiveTasks` | Horizontal scroll of upcoming tasks | Not wired to live data yet (static props) |
| `CashOutflow` | Payment-due summary + list | Uses `PaymentList` |
| `PaymentList` | Renders individual payment rows | Pure presentational |
| `UrgentAlerts` | Overdue / expired alerts | Pure presentational |

No visual or layout changes in this refactor. Prop interfaces, `StyleSheet`
conventions, `className` NativeWind usage, and `testID` attributes are all preserved.

---

## 11. Acceptance Criteria

> This is a refactor — no new test scenarios are required. Existing tests are
> updated (import paths only) and must pass green after migration.

- [ ] **R1** All 13 source files moved to `src/features/dashboard/` with internal
      import paths corrected
- [ ] **R2** `src/features/dashboard/index.ts` barrel created and exporting
      `DashboardScreen` (named) and public types
- [ ] **R3** `src/pages/tabs/index.tsx` updated to import from barrel
- [ ] **R4** `src/pages/dashboard/` directory deleted (empty after move)
- [ ] **R5** `src/components/dashboard/` directory deleted (empty after move)
- [ ] **R6** `src/hooks/useDashboard.ts` deleted (moved to feature)
- [ ] **R7** `src/hooks/useProjectsOverview.ts` deleted (moved to feature)
- [ ] **R8** All 7 test files relocated with import paths updated
- [ ] **R9** `npx tsc --noEmit` passes with zero errors
- [ ] **R10** All unit and integration tests pass (`npm test`)
- [ ] **R11** No logic changes — diff shows only file moves and import path strings

---

## 12. Out of Scope

- Migrating other feature modules (`payments`, `tasks`, `invoices`, …) — these are
  separate work items
- Adding new test scenarios for dashboard behaviour
- Changing the `useDashboard` ViewModel interface or DashboardScreen layout
- Setting up `@/features/*` TypeScript path aliases (deferred to Phase 2 per the
  receipts design)
