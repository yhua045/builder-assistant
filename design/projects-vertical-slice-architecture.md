# Design: Vertical-Slice Architecture — Projects Module

**Date:** 2026-04-28  
**Issue:** [#212 — Adopt Vertical-Slice (Modular) Architecture](https://github.com/yhua045/builder-assistant/issues/212)  
**Inspired by:**
- [design/issue-212-vertical-slice-architecture.md](issue-212-vertical-slice-architecture.md) (Receipts pilot)
- [design/dashboard-vertical-slice-architecture.md](dashboard-vertical-slice-architecture.md) (Dashboard)
- [design/issue-212-invoices-vertical-slice-architecture.md](issue-212-invoices-vertical-slice-architecture.md) (Invoices)
- [design/payments-vertical-slice-architecture.md](payments-vertical-slice-architecture.md) (Payments)

**Type:** Structural Refactor — file moves and import updates only; no runtime behaviour changes.

---

## 1. Goal & Motivation

Apply the same vertical-slice (feature-module) pattern established for `receipts`,
`dashboard`, `invoices`, and `payments` to the `projects` module.  All
project-owned files are gathered into a self-contained module under
`src/features/projects/`, making ownership explicit and eliminating cross-layer
scattering.

The Clean Architecture dependency direction is preserved inside the module:

```
screens/ → hooks/ → application/ → domain/
components/ ← hooks/ (ViewModel props)
                ↓
         infrastructure/
```

> **Key cross-feature constraints for `projects`:**
>
> 1. `ProjectRepository` is consumed by `payments` (`GetPaymentDetailsUseCase`,
>    `usePayments`) and `dashboard` (`useProjectsOverview`).  It therefore **stays
>    shared** in `src/domain/repositories/ProjectRepository.ts`.
>
> 2. `Project` and `ProjectDetails` entities are used across `payments`, `invoices`,
>    `receipts`, `dashboard`, and `tasks` — they stay in `src/domain/entities/`.
>
> 3. `ProjectPicker` and `ProjectPickerModal` are used by task forms, quotation
>    forms, and payment/receipt forms — they stay in `src/components/inputs/` and
>    `src/components/shared/` respectively.
>
> 4. `GetNearbyProjectsUseCase` lives in the `location/` namespace, wired through
>    `RemoteLocationAdapter` — it stays in `src/application/usecases/location/`.
>
> 5. `GetAuditLogsByProjectUseCase` lives in the `auditlog/` namespace and
>    `useAuditLog.ts` is used in both task and project contexts — both stay in the
>    shared application layer.
>
> 6. `ManualProjectEntry` and `ManualProjectEntryButton` are imported directly by
>    `DashboardScreen` and `HeroSection` in the already-migrated `dashboard` feature;
>    after migration these imports will be updated to use the `projects` barrel.
>
> 7. `QuotationDetail` (the project-stack quotation detail screen) is imported by the
>    already-migrated `PaymentsNavigator`; that import will update to the `projects`
>    barrel.
>
> 8. `useProjects` is consumed by `src/components/inputs/ProjectPicker.tsx` (shared)
>    and `src/pages/tasks/index.tsx`; both will update to the `projects` barrel.

---

## 2. Current (Horizontal) Layout

```
src/
├── application/
│   ├── dtos/
│   │   └── ProjectCardDto.ts
│   └── usecases/
│       ├── project/
│       │   ├── ArchiveProjectUseCase.ts
│       │   ├── BulkUpdateProjectsUseCase.ts
│       │   ├── CreateProjectUseCase.ts
│       │   ├── GetProjectAnalysisUseCase.ts
│       │   ├── GetProjectDetailsUseCase.ts
│       │   ├── MergeProjectsUseCase.ts
│       │   ├── UnarchiveProjectUseCase.ts
│       │   ├── UpdateProjectStatusUseCase.ts
│       │   └── UpdateProjectUseCase.ts
│       └── quotation/
│           └── ListProjectQuotationsUseCase.ts    ← project-context only
│
├── components/
│   ├── CriticalPathPreview/                       ← only used by ManualProjectEntryForm
│   │   ├── CriticalPathPreview.tsx
│   │   ├── CriticalPathTaskRow.tsx
│   │   └── index.tsx
│   ├── ManualProjectEntry.tsx                     ← used by DashboardScreen
│   ├── ManualProjectEntryButton.tsx               ← used by HeroSection (dashboard)
│   ├── ManualProjectEntryForm.tsx
│   ├── ProjectCard.tsx
│   ├── ProjectList.tsx
│   ├── ProjectsList.tsx
│   ├── inputs/
│   │   └── ProjectPicker.tsx                      ← SHARED (tasks, quotations, payments)
│   ├── projects/
│   │   ├── QuotationCard.tsx
│   │   ├── StickyOverlay.tsx
│   │   ├── TimelineDayGroup.tsx
│   │   ├── TimelineInvoiceCard.tsx
│   │   ├── TimelineList.tsx
│   │   ├── TimelinePaymentCard.tsx
│   │   ├── TimelineQuotationCard.tsx
│   │   ├── TimelineSectionHeader.tsx
│   │   └── TimelineTaskCard.tsx
│   └── shared/
│       └── ProjectPickerModal.tsx                 ← SHARED (payments, receipts, quotations)
│
├── domain/
│   ├── entities/
│   │   ├── Project.ts                             ← SHARED entity (unchanged)
│   │   └── ProjectDetails.ts                      ← SHARED entity (unchanged)
│   ├── repositories/
│   │   └── ProjectRepository.ts                   ← SHARED interface (unchanged)
│   └── services/
│       ├── ProjectValidationService.ts            ← feature-owned (only project use cases)
│       └── ProjectWorkflowService.ts              ← feature-owned (only project use cases)
│
├── hooks/
│   ├── useProjectDetail.ts
│   ├── useProjectTimeline.ts                      ← deprecated shim (re-exports focused hooks)
│   ├── useProjects.ts
│   ├── useProjectsPage.ts
│   ├── useQuotationTimeline.ts                    ← project-context only
│   ├── useQuotationsTimeline.ts                   ← project-context only
│   └── useUpdateProject.ts
│
├── infrastructure/
│   ├── mappers/
│   │   └── ProjectMapper.ts
│   └── repositories/
│       ├── DrizzleProjectRepository.ts
│       ├── InMemoryProjectRepository.ts           ← test helper
│       └── LocalSqliteProjectRepository.ts        ← legacy adapter
│
└── pages/projects/
    ├── ProjectDetail.tsx
    ├── ProjectEditScreen.tsx
    ├── ProjectsNavigator.tsx
    ├── ProjectsPage.tsx
    └── QuotationDetail.tsx                        ← also used by PaymentsNavigator

__tests__/
├── unit/
│   ├── ArchiveProjectUseCase.test.ts
│   ├── BulkUpdateProjectsUseCase.test.ts
│   ├── CreateProjectUseCase.test.ts
│   ├── GetAuditLogsByProjectUseCase.test.ts       ← stays (audit concern)
│   ├── GetNearbyProjectsUseCase.test.ts           ← stays (location concern)
│   ├── GetProjectDetailsUseCase.test.ts
│   ├── ManualProjectEntry.test.tsx
│   ├── ManualProjectEntryButton.test.tsx
│   ├── ManualProjectEntryForm.test.tsx
│   ├── MergeProjectsUseCase.test.ts
│   ├── ProjectCard.status.test.tsx
│   ├── ProjectRepository.contract.test.ts
│   ├── ProjectValidationService.workflow.test.ts
│   ├── ProjectWorkflowService.test.ts
│   ├── ProjectsPage.test.tsx
│   ├── UnarchiveProjectUseCase.test.ts
│   ├── UpdateProjectStatusUseCase.test.ts
│   ├── UpdateProjectUseCase.test.ts
│   ├── hooks/
│   │   └── useProjectsPage.test.ts
│   ├── useProjectTimeline.test.ts
│   ├── useProjects.test.tsx
│   └── useUpdateProject.test.tsx
└── integration/
    ├── CreateProjectUseCase.integration.test.ts
    ├── DrizzleProjectRepository.integration.test.ts
    ├── ManualProjectEntryForm.integration.test.tsx
    ├── ProjectCardPendingPaymentUpdate.integration.test.tsx
    ├── ProjectDetail.integration.test.tsx
    ├── ProjectDetailPayments.integration.test.tsx
    ├── ProjectDetailQuotes.integration.test.tsx
    ├── ProjectEditScreen.integration.test.tsx
    └── useProjects.integration.test.tsx
```

---

## 3. Target (Vertical-Slice) Layout

> **Mobile-UI review alignment (2026-04-28):** Following the established convention
> from `receipts`, `invoices`, and `payments`, the `projects` module uses:
>
> - **`screens/`** — top-level navigable routes wired to the navigator stack
> - **`components/`** — composable sub-components (cards, forms, timeline items)
>
> This keeps import paths expressive and prevents the flat-`ui/` anti-pattern.
> The `components/projects/` sub-directory in the current layout collapses into
> the feature's `components/` folder.

```
src/
├── features/
│   └── projects/
│       ├── domain/
│       │   ├── ProjectValidationService.ts        ← was src/domain/services/
│       │   └── ProjectWorkflowService.ts          ← was src/domain/services/
│       │
│       ├── application/
│       │   ├── ProjectCardDto.ts                  ← was src/application/dtos/
│       │   ├── ArchiveProjectUseCase.ts
│       │   ├── BulkUpdateProjectsUseCase.ts
│       │   ├── CreateProjectUseCase.ts
│       │   ├── GetProjectAnalysisUseCase.ts
│       │   ├── GetProjectDetailsUseCase.ts
│       │   ├── ListProjectQuotationsUseCase.ts    ← was application/usecases/quotation/
│       │   ├── MergeProjectsUseCase.ts
│       │   ├── UnarchiveProjectUseCase.ts
│       │   ├── UpdateProjectStatusUseCase.ts
│       │   └── UpdateProjectUseCase.ts
│       │
│       ├── infrastructure/
│       │   ├── DrizzleProjectRepository.ts
│       │   ├── InMemoryProjectRepository.ts       ← test helper
│       │   ├── LocalSqliteProjectRepository.ts    ← legacy adapter
│       │   └── ProjectMapper.ts                   ← was src/infrastructure/mappers/
│       │
│       ├── screens/                               ← was src/pages/projects/
│       │   ├── ProjectDetail.tsx
│       │   ├── ProjectEditScreen.tsx
│       │   ├── ProjectsNavigator.tsx
│       │   ├── ProjectsPage.tsx
│       │   └── QuotationDetail.tsx                ← also exported via barrel
│       │
│       ├── components/
│       │   ├── CriticalPathPreview/               ← was src/components/CriticalPathPreview/
│       │   │   ├── CriticalPathPreview.tsx
│       │   │   ├── CriticalPathTaskRow.tsx
│       │   │   └── index.tsx
│       │   ├── ManualProjectEntry.tsx             ← was src/components/ (export via barrel)
│       │   ├── ManualProjectEntryButton.tsx       ← was src/components/ (export via barrel)
│       │   ├── ManualProjectEntryForm.tsx         ← was src/components/
│       │   ├── ProjectCard.tsx
│       │   ├── ProjectList.tsx
│       │   ├── ProjectsList.tsx
│       │   ├── QuotationCard.tsx                  ← was src/components/projects/
│       │   ├── StickyOverlay.tsx
│       │   ├── TimelineDayGroup.tsx
│       │   ├── TimelineInvoiceCard.tsx
│       │   ├── TimelineList.tsx
│       │   ├── TimelinePaymentCard.tsx
│       │   ├── TimelineQuotationCard.tsx
│       │   ├── TimelineSectionHeader.tsx
│       │   └── TimelineTaskCard.tsx
│       │
│       ├── hooks/
│       │   ├── useProjectDetail.ts
│       │   ├── useProjectTimeline.ts              ← deprecated shim (preserved)
│       │   ├── useProjects.ts                     ← exported via barrel (cross-feature)
│       │   ├── useProjectsPage.ts
│       │   ├── useQuotationTimeline.ts
│       │   ├── useQuotationsTimeline.ts
│       │   └── useUpdateProject.ts
│       │
│       ├── tests/
│       │   ├── unit/
│       │   │   ├── ArchiveProjectUseCase.test.ts
│       │   │   ├── BulkUpdateProjectsUseCase.test.ts
│       │   │   ├── CreateProjectUseCase.test.ts
│       │   │   ├── GetProjectDetailsUseCase.test.ts
│       │   │   ├── MergeProjectsUseCase.test.ts
│       │   │   ├── ProjectRepository.contract.test.ts
│       │   │   ├── ProjectValidationService.workflow.test.ts
│       │   │   ├── ProjectWorkflowService.test.ts
│       │   │   ├── UnarchiveProjectUseCase.test.ts
│       │   │   ├── UpdateProjectStatusUseCase.test.ts
│       │   │   ├── UpdateProjectUseCase.test.ts
│       │   │   ├── useProjects.test.tsx
│       │   │   ├── useProjectTimeline.test.ts
│       │   │   ├── useUpdateProject.test.tsx
│       │   │   ├── components/
│       │   │   │   ├── ManualProjectEntry.test.tsx
│       │   │   │   ├── ManualProjectEntryButton.test.tsx
│       │   │   │   ├── ManualProjectEntryForm.test.tsx
│       │   │   │   └── ProjectCard.status.test.tsx
│       │   │   ├── hooks/
│       │   │   │   └── useProjectsPage.test.ts
│       │   │   └── screens/
│       │   │       └── ProjectsPage.test.tsx
│       │   └── integration/
│       │       ├── CreateProjectUseCase.integration.test.ts
│       │       ├── DrizzleProjectRepository.integration.test.ts
│       │       ├── ManualProjectEntryForm.integration.test.tsx
│       │       ├── ProjectCardPendingPaymentUpdate.integration.test.tsx
│       │       ├── ProjectDetail.integration.test.tsx
│       │       ├── ProjectDetailPayments.integration.test.tsx
│       │       ├── ProjectDetailQuotes.integration.test.tsx
│       │       ├── ProjectEditScreen.integration.test.tsx
│       │       └── useProjects.integration.test.tsx
│       │
│       └── index.ts                              ← public barrel export
│
├── domain/                                       ← SHARED (unchanged)
│   ├── entities/
│   │   ├── Project.ts                            ← SHARED
│   │   └── ProjectDetails.ts                     ← SHARED
│   ├── repositories/
│   │   └── ProjectRepository.ts                  ← SHARED
│   └── services/
│       ├── ProjectValidationService.ts            ← REMOVE (or keep as re-export shim)
│       └── ProjectWorkflowService.ts              ← REMOVE (or keep as re-export shim)
│
├── application/                                  ← SHARED remaining use cases (unchanged)
│   ├── usecases/
│   │   ├── location/
│   │   │   └── GetNearbyProjectsUseCase.ts       ← STAYS SHARED
│   │   └── auditlog/
│   │       └── GetAuditLogsByProjectUseCase.ts   ← STAYS SHARED
│   └── …
│
├── components/                                   ← SHARED components (unchanged)
│   ├── inputs/
│   │   └── ProjectPicker.tsx                     ← STAYS SHARED (updated import)
│   └── shared/
│       └── ProjectPickerModal.tsx                ← STAYS SHARED
│
├── infrastructure/
│   ├── di/
│   │   └── registerServices.ts                   ← updated import path only
│   └── …
│
├── hooks/                                        ← non-project hooks (unchanged)
└── pages/                                        ← non-project pages (unchanged)
```

---

## 4. Shared vs. Feature-Owned Boundaries

| Asset | Owner | Rationale |
|---|---|---|
| `domain/entities/Project.ts` | **Shared** | Used by payments, invoices, dashboard, tasks, receipts |
| `domain/entities/ProjectDetails.ts` | **Shared** | Used by payments hooks, dashboard, repository interface |
| `domain/repositories/ProjectRepository.ts` | **Shared** | Consumed by payments and dashboard features |
| `domain/services/ProjectValidationService.ts` | **Feature** (`projects/domain/`) | Only used by project use cases |
| `domain/services/ProjectWorkflowService.ts` | **Feature** (`projects/domain/`) | Only used by project use cases |
| `application/dtos/ProjectCardDto.ts` | **Feature** (`projects/application/`) | Only used by project hooks and components |
| `application/usecases/project/*` | **Feature** (`projects/application/`) | Exclusively project-owned |
| `application/usecases/quotation/ListProjectQuotationsUseCase.ts` | **Feature** (`projects/application/`) | Only used in project timeline context |
| `application/usecases/location/GetNearbyProjectsUseCase.ts` | **Shared** | Location cross-cutting concern |
| `application/usecases/auditlog/GetAuditLogsByProjectUseCase.ts` | **Shared** | Audit cross-cutting concern |
| `infrastructure/repositories/DrizzleProjectRepository.ts` | **Feature** (`projects/infrastructure/`) | Project-owned persistence |
| `infrastructure/repositories/InMemoryProjectRepository.ts` | **Feature** (`projects/infrastructure/`) | Test helper for projects only |
| `infrastructure/repositories/LocalSqliteProjectRepository.ts` | **Feature** (`projects/infrastructure/`) | Legacy adapter for projects only |
| `infrastructure/mappers/ProjectMapper.ts` | **Feature** (`projects/infrastructure/`) | Only used by DrizzleProjectRepository |
| `infrastructure/database/schema.ts` | **Shared** | Single Drizzle schema for all modules |
| `infrastructure/di/container.ts` | **Shared** | Global DI container (import paths updated) |
| `components/inputs/ProjectPicker.tsx` | **Shared** | Used by tasks, quotations, and payments forms |
| `components/shared/ProjectPickerModal.tsx` | **Shared** | Used by payments, receipts, and quotation forms |
| `components/ManualProjectEntry.tsx` | **Feature** (`projects/components/`) | Used by dashboard via barrel |
| `components/ManualProjectEntryButton.tsx` | **Feature** (`projects/components/`) | Used by dashboard via barrel |
| `components/CriticalPathPreview/` | **Feature** (`projects/components/`) | Only used by ManualProjectEntryForm |
| `components/projects/*` (Timeline*, etc.) | **Feature** (`projects/components/`) | Project-owned UI |
| `hooks/useProjects.ts` | **Feature** (`projects/hooks/`) — **exported** | Consumed by ProjectPicker and tasks page via barrel |
| `hooks/useProjectDetail.ts` | **Feature** (`projects/hooks/`) | Project-owned |
| `hooks/useQuotationTimeline.ts` | **Feature** (`projects/hooks/`) | Project-context only |
| `hooks/useQuotationsTimeline.ts` | **Feature** (`projects/hooks/`) | Project-context only |
| `pages/projects/QuotationDetail.tsx` | **Feature** (`projects/screens/`) — **exported** | Used by PaymentsNavigator via barrel |
| `pages/projects/ProjectsNavigator.tsx` | **Feature** (`projects/screens/`) — **exported** | Used by tabs/index.tsx via barrel |

---

## 5. UI Component Design Considerations

_Aligned with `@mobile-ui` agent conventions established across `receipts`, `invoices`,
and `payments` — 2026-04-28._

### 5.1 `screens/` vs `components/` distinction

| Directory | Purpose | Contents |
|---|---|---|
| `screens/` | Top-level navigable routes, wired to `ProjectsNavigator` | `ProjectsPage`, `ProjectDetail`, `ProjectEditScreen`, `QuotationDetail` |
| `components/` | Composable sub-components consumed by screens or other features | `ProjectCard`, `ManualProjectEntry*`, `CriticalPathPreview`, `Timeline*` |

The `components/projects/` flat directory in the current horizontal layout naturally
collapses into `features/projects/components/` — no sub-directory needed since all
timeline cards are uniform siblings.

### 5.2 `ProjectsNavigator.tsx` → `screens/ProjectsNavigator.tsx`
- React Navigation stack wrapping the project sub-screens.
- `tabs/index.tsx` currently imports directly; after migration it imports via the barrel.
- No visual or layout changes.

### 5.3 `ManualProjectEntry` / `ManualProjectEntryButton` cross-feature concern
- These are project-creation entry points, clearly project-owned, but they are
  embedded in the `dashboard` feature's `DashboardScreen` and `HeroSection`.
- **Pattern**: move to `features/projects/components/`, export from barrel.
  Dashboard feature updates its import to `../../features/projects`.
- Props interfaces and StyleSheet conventions are unchanged.

### 5.4 `QuotationDetail.tsx` cross-feature concern
- A project-stack screen (navigated from `ProjectDetail` when the user taps a
  quotation row), also embedded in `PaymentsNavigator` for quotation viewing in the
  payments flow.
- **Pattern**: move to `features/projects/screens/`, export from barrel.
  `PaymentsNavigator` updates its import to `../../features/projects`.

---

## 6. Barrel Export Design (`src/features/projects/index.ts`)

The barrel exports only the **public API** needed by other modules:

```typescript
// Navigation entry point (consumed by src/pages/tabs/index.tsx)
export { default as ProjectsNavigator } from './screens/ProjectsNavigator';

// Screens consumed cross-feature
export { default as QuotationDetail } from './screens/QuotationDetail';

// Components consumed cross-feature (dashboard)
export { default as ManualProjectEntry } from './components/ManualProjectEntry';
export { ManualProjectEntryButton } from './components/ManualProjectEntryButton';

// Hooks consumed cross-feature
export { useProjects } from './hooks/useProjects';

// Types needed by callers
export type { ProjectsPageViewModel } from './hooks/useProjectsPage';
```

Internal module files (`DrizzleProjectRepository`, `ProjectValidationService`,
`ProjectCard`, etc.) are **not** re-exported — accessed only via the DI container
or within the module.

---

## 7. File Migration Map

All moves are **renames only** — no logic changes.

### 7.1 Domain layer

| Source (current) | Destination (new) |
|---|---|
| `src/domain/services/ProjectValidationService.ts` | `src/features/projects/domain/ProjectValidationService.ts` |
| `src/domain/services/ProjectWorkflowService.ts` | `src/features/projects/domain/ProjectWorkflowService.ts` |

> `src/domain/services/index.ts` currently only exports `ProjectValidationService`
> and `ProjectWorkflowService`. After migration it should either be deleted or
> reduced to a comment noting that project services are now in the projects feature.
> The other services in `domain/services/` (`ILookupProvider`,
> `VendorDetailsResolver`, `DocumentStorageEngine`) are imported directly by path
> and are unaffected.

### 7.2 Application layer

| Source (current) | Destination (new) |
|---|---|
| `src/application/dtos/ProjectCardDto.ts` | `src/features/projects/application/ProjectCardDto.ts` |
| `src/application/usecases/project/ArchiveProjectUseCase.ts` | `src/features/projects/application/ArchiveProjectUseCase.ts` |
| `src/application/usecases/project/BulkUpdateProjectsUseCase.ts` | `src/features/projects/application/BulkUpdateProjectsUseCase.ts` |
| `src/application/usecases/project/CreateProjectUseCase.ts` | `src/features/projects/application/CreateProjectUseCase.ts` |
| `src/application/usecases/project/GetProjectAnalysisUseCase.ts` | `src/features/projects/application/GetProjectAnalysisUseCase.ts` |
| `src/application/usecases/project/GetProjectDetailsUseCase.ts` | `src/features/projects/application/GetProjectDetailsUseCase.ts` |
| `src/application/usecases/project/MergeProjectsUseCase.ts` | `src/features/projects/application/MergeProjectsUseCase.ts` |
| `src/application/usecases/project/UnarchiveProjectUseCase.ts` | `src/features/projects/application/UnarchiveProjectUseCase.ts` |
| `src/application/usecases/project/UpdateProjectStatusUseCase.ts` | `src/features/projects/application/UpdateProjectStatusUseCase.ts` |
| `src/application/usecases/project/UpdateProjectUseCase.ts` | `src/features/projects/application/UpdateProjectUseCase.ts` |
| `src/application/usecases/quotation/ListProjectQuotationsUseCase.ts` | `src/features/projects/application/ListProjectQuotationsUseCase.ts` |

### 7.3 Infrastructure layer

| Source (current) | Destination (new) |
|---|---|
| `src/infrastructure/repositories/DrizzleProjectRepository.ts` | `src/features/projects/infrastructure/DrizzleProjectRepository.ts` |
| `src/infrastructure/repositories/InMemoryProjectRepository.ts` | `src/features/projects/infrastructure/InMemoryProjectRepository.ts` |
| `src/infrastructure/repositories/LocalSqliteProjectRepository.ts` | `src/features/projects/infrastructure/LocalSqliteProjectRepository.ts` |
| `src/infrastructure/mappers/ProjectMapper.ts` | `src/features/projects/infrastructure/ProjectMapper.ts` |

### 7.4 Components

| Source (current) | Destination (new) |
|---|---|
| `src/components/CriticalPathPreview/CriticalPathPreview.tsx` | `src/features/projects/components/CriticalPathPreview/CriticalPathPreview.tsx` |
| `src/components/CriticalPathPreview/CriticalPathTaskRow.tsx` | `src/features/projects/components/CriticalPathPreview/CriticalPathTaskRow.tsx` |
| `src/components/CriticalPathPreview/index.tsx` | `src/features/projects/components/CriticalPathPreview/index.tsx` |
| `src/components/ManualProjectEntry.tsx` | `src/features/projects/components/ManualProjectEntry.tsx` |
| `src/components/ManualProjectEntryButton.tsx` | `src/features/projects/components/ManualProjectEntryButton.tsx` |
| `src/components/ManualProjectEntryForm.tsx` | `src/features/projects/components/ManualProjectEntryForm.tsx` |
| `src/components/ProjectCard.tsx` | `src/features/projects/components/ProjectCard.tsx` |
| `src/components/ProjectList.tsx` | `src/features/projects/components/ProjectList.tsx` |
| `src/components/ProjectsList.tsx` | `src/features/projects/components/ProjectsList.tsx` |
| `src/components/projects/QuotationCard.tsx` | `src/features/projects/components/QuotationCard.tsx` |
| `src/components/projects/StickyOverlay.tsx` | `src/features/projects/components/StickyOverlay.tsx` |
| `src/components/projects/TimelineDayGroup.tsx` | `src/features/projects/components/TimelineDayGroup.tsx` |
| `src/components/projects/TimelineInvoiceCard.tsx` | `src/features/projects/components/TimelineInvoiceCard.tsx` |
| `src/components/projects/TimelineList.tsx` | `src/features/projects/components/TimelineList.tsx` |
| `src/components/projects/TimelinePaymentCard.tsx` | `src/features/projects/components/TimelinePaymentCard.tsx` |
| `src/components/projects/TimelineQuotationCard.tsx` | `src/features/projects/components/TimelineQuotationCard.tsx` |
| `src/components/projects/TimelineSectionHeader.tsx` | `src/features/projects/components/TimelineSectionHeader.tsx` |
| `src/components/projects/TimelineTaskCard.tsx` | `src/features/projects/components/TimelineTaskCard.tsx` |

### 7.5 Hooks

| Source (current) | Destination (new) |
|---|---|
| `src/hooks/useProjectDetail.ts` | `src/features/projects/hooks/useProjectDetail.ts` |
| `src/hooks/useProjectTimeline.ts` | `src/features/projects/hooks/useProjectTimeline.ts` |
| `src/hooks/useProjects.ts` | `src/features/projects/hooks/useProjects.ts` |
| `src/hooks/useProjectsPage.ts` | `src/features/projects/hooks/useProjectsPage.ts` |
| `src/hooks/useQuotationTimeline.ts` | `src/features/projects/hooks/useQuotationTimeline.ts` |
| `src/hooks/useQuotationsTimeline.ts` | `src/features/projects/hooks/useQuotationsTimeline.ts` |
| `src/hooks/useUpdateProject.ts` | `src/features/projects/hooks/useUpdateProject.ts` |

### 7.6 Screens

| Source (current) | Destination (new) |
|---|---|
| `src/pages/projects/ProjectDetail.tsx` | `src/features/projects/screens/ProjectDetail.tsx` |
| `src/pages/projects/ProjectEditScreen.tsx` | `src/features/projects/screens/ProjectEditScreen.tsx` |
| `src/pages/projects/ProjectsNavigator.tsx` | `src/features/projects/screens/ProjectsNavigator.tsx` |
| `src/pages/projects/ProjectsPage.tsx` | `src/features/projects/screens/ProjectsPage.tsx` |
| `src/pages/projects/QuotationDetail.tsx` | `src/features/projects/screens/QuotationDetail.tsx` |

### 7.7 Tests

| Source (current) | Destination (new) |
|---|---|
| `__tests__/unit/ArchiveProjectUseCase.test.ts` | `src/features/projects/tests/unit/ArchiveProjectUseCase.test.ts` |
| `__tests__/unit/BulkUpdateProjectsUseCase.test.ts` | `src/features/projects/tests/unit/BulkUpdateProjectsUseCase.test.ts` |
| `__tests__/unit/CreateProjectUseCase.test.ts` | `src/features/projects/tests/unit/CreateProjectUseCase.test.ts` |
| `__tests__/unit/GetProjectDetailsUseCase.test.ts` | `src/features/projects/tests/unit/GetProjectDetailsUseCase.test.ts` |
| `__tests__/unit/ManualProjectEntry.test.tsx` | `src/features/projects/tests/unit/components/ManualProjectEntry.test.tsx` |
| `__tests__/unit/ManualProjectEntryButton.test.tsx` | `src/features/projects/tests/unit/components/ManualProjectEntryButton.test.tsx` |
| `__tests__/unit/ManualProjectEntryForm.test.tsx` | `src/features/projects/tests/unit/components/ManualProjectEntryForm.test.tsx` |
| `__tests__/unit/MergeProjectsUseCase.test.ts` | `src/features/projects/tests/unit/MergeProjectsUseCase.test.ts` |
| `__tests__/unit/ProjectCard.status.test.tsx` | `src/features/projects/tests/unit/components/ProjectCard.status.test.tsx` |
| `__tests__/unit/ProjectRepository.contract.test.ts` | `src/features/projects/tests/unit/ProjectRepository.contract.test.ts` |
| `__tests__/unit/ProjectValidationService.workflow.test.ts` | `src/features/projects/tests/unit/ProjectValidationService.workflow.test.ts` |
| `__tests__/unit/ProjectWorkflowService.test.ts` | `src/features/projects/tests/unit/ProjectWorkflowService.test.ts` |
| `__tests__/unit/ProjectsPage.test.tsx` | `src/features/projects/tests/unit/screens/ProjectsPage.test.tsx` |
| `__tests__/unit/UnarchiveProjectUseCase.test.ts` | `src/features/projects/tests/unit/UnarchiveProjectUseCase.test.ts` |
| `__tests__/unit/UpdateProjectStatusUseCase.test.ts` | `src/features/projects/tests/unit/UpdateProjectStatusUseCase.test.ts` |
| `__tests__/unit/UpdateProjectUseCase.test.ts` | `src/features/projects/tests/unit/UpdateProjectUseCase.test.ts` |
| `__tests__/unit/hooks/useProjectsPage.test.ts` | `src/features/projects/tests/unit/hooks/useProjectsPage.test.ts` |
| `__tests__/unit/useProjectTimeline.test.ts` | `src/features/projects/tests/unit/useProjectTimeline.test.ts` |
| `__tests__/unit/useProjects.test.tsx` | `src/features/projects/tests/unit/useProjects.test.tsx` |
| `__tests__/unit/useUpdateProject.test.tsx` | `src/features/projects/tests/unit/useUpdateProject.test.tsx` |
| `__tests__/integration/CreateProjectUseCase.integration.test.ts` | `src/features/projects/tests/integration/CreateProjectUseCase.integration.test.ts` |
| `__tests__/integration/DrizzleProjectRepository.integration.test.ts` | `src/features/projects/tests/integration/DrizzleProjectRepository.integration.test.ts` |
| `__tests__/integration/ManualProjectEntryForm.integration.test.tsx` | `src/features/projects/tests/integration/ManualProjectEntryForm.integration.test.tsx` |
| `__tests__/integration/ProjectCardPendingPaymentUpdate.integration.test.tsx` | `src/features/projects/tests/integration/ProjectCardPendingPaymentUpdate.integration.test.tsx` |
| `__tests__/integration/ProjectDetail.integration.test.tsx` | `src/features/projects/tests/integration/ProjectDetail.integration.test.tsx` |
| `__tests__/integration/ProjectDetailPayments.integration.test.tsx` | `src/features/projects/tests/integration/ProjectDetailPayments.integration.test.tsx` |
| `__tests__/integration/ProjectDetailQuotes.integration.test.tsx` | `src/features/projects/tests/integration/ProjectDetailQuotes.integration.test.tsx` |
| `__tests__/integration/ProjectEditScreen.integration.test.tsx` | `src/features/projects/tests/integration/ProjectEditScreen.integration.test.tsx` |
| `__tests__/integration/useProjects.integration.test.tsx` | `src/features/projects/tests/integration/useProjects.integration.test.tsx` |

> **Tests that stay in `__tests__/`** (not project-owned):
> - `__tests__/unit/GetAuditLogsByProjectUseCase.test.ts` — audit concern
> - `__tests__/unit/GetNearbyProjectsUseCase.test.ts` — location concern

> **Test co-location note:** Component tests mirror `components/` under
> `tests/unit/components/`. Screen tests mirror `screens/` under
> `tests/unit/screens/`. Hook tests go in `tests/unit/hooks/`. Use-case and
> service tests sit flat under `tests/unit/`.

---

## 8. Import Updates Required After Migration

### 8.1 Within the projects feature module
All cross-file imports become relative within `src/features/projects/`.

Key import path updates inside the module:

| File | Old import | New relative import |
|---|---|---|
| All use cases | `'../../../domain/services/ProjectValidationService'` | `'../domain/ProjectValidationService'` |
| All use cases | `'../../../domain/repositories/ProjectRepository'` | `'../../../domain/repositories/ProjectRepository'` ← **unchanged** (shared) |
| `DrizzleProjectRepository.ts` | `'../../mappers/ProjectMapper'` | `'./ProjectMapper'` |
| `DrizzleProjectRepository.ts` | `'../../domain/entities/Project'` | `'../../../domain/entities/Project'` ← **unchanged** |
| `screens/ProjectsPage.tsx` | `'../../components/ManualProjectEntry'` | `'../components/ManualProjectEntry'` |
| `screens/ProjectsPage.tsx` | `'../../components/ProjectCard'` | `'../components/ProjectCard'` |
| `screens/ProjectsPage.tsx` | `'../../hooks/useProjectsPage'` | `'../hooks/useProjectsPage'` |
| All hooks | `'../domain/entities/ProjectDetails'` | `'../../../domain/entities/ProjectDetails'` ← **unchanged** |
| `hooks/useQuotationsTimeline.ts` | `'../application/usecases/quotation/ListProjectQuotationsUseCase'` | `'../application/ListProjectQuotationsUseCase'` |
| `components/ManualProjectEntryForm.tsx` | `'./CriticalPathPreview/CriticalPathPreview'` | `'./CriticalPathPreview/CriticalPathPreview'` ← unchanged (same dir) |

### 8.2 External callers that import projects files

| File | Current import | New import |
|---|---|---|
| `src/pages/tabs/index.tsx` | `'../projects/ProjectsNavigator'` | `'../../features/projects'` |
| `src/features/dashboard/screens/DashboardScreen.tsx` | `'../../../components/ManualProjectEntry'` | `'../../features/projects'` or `'../../../features/projects'` |
| `src/features/dashboard/components/HeroSection.tsx` | `'../../../components/ManualProjectEntryButton'` | `'../../../features/projects'` |
| `src/features/payments/screens/PaymentsNavigator.tsx` | `'../../../pages/projects/QuotationDetail'` | `'../../features/projects'` or `'../../../features/projects'` |
| `src/components/inputs/ProjectPicker.tsx` | `'../../hooks/useProjects'` | `'../../features/projects'` |
| `src/pages/tasks/index.tsx` | `'../../hooks/useProjects'` | `'../../features/projects'` |
| `src/infrastructure/di/registerServices.ts` | `'../repositories/DrizzleProjectRepository'` | `'../../features/projects/infrastructure/DrizzleProjectRepository'` |

> **Note on relative import depth:** Exact relative paths depend on file locations.
> Where callers are already in `src/features/`, the relative depth to
> `src/features/projects/` is `'../projects'`.

### 8.3 Test import path updates
All moved tests use paths such as `../../src/application/usecases/project/...`.
After migration, these become relative within `src/features/projects/tests/`:

```typescript
// Before (in __tests__/unit/CreateProjectUseCase.test.ts)
import { CreateProjectUseCase } from '../../src/application/usecases/project/CreateProjectUseCase';

// After (in src/features/projects/tests/unit/CreateProjectUseCase.test.ts)
import { CreateProjectUseCase } from '../../application/CreateProjectUseCase';
```

---

## 9. DI Registration Update

`src/infrastructure/di/registerServices.ts` registers `DrizzleProjectRepository`
as `'ProjectRepository'`. After migration, only the import path changes:

```typescript
// Before
import { DrizzleProjectRepository } from '../repositories/DrizzleProjectRepository';

// After
import { DrizzleProjectRepository } from '../../features/projects/infrastructure/DrizzleProjectRepository';
```

The DI token (`'ProjectRepository'`) and runtime behaviour are identical.

---

## 10. Domain Services Barrel Update

`src/domain/services/index.ts` currently only exports `ProjectValidationService` and
`ProjectWorkflowService`. After migration the file should be:

- **Option A (clean):** Delete `index.ts`. All non-project services in `domain/services/`
  (`ILookupProvider`, `VendorDetailsResolver`, `DocumentStorageEngine`) are imported
  directly by path and will be unaffected.
- **Option B (compatibility shim):** Replace the file body with forwarding re-exports
  from the feature for a transition period:

```typescript
// DEPRECATED — use src/features/projects/domain directly
export { ProjectValidationService } from '../features/projects/domain/ProjectValidationService';
export type { IProjectWorkflowService, WorkflowCheck } from '../features/projects/domain/ProjectWorkflowService';
export { ProjectWorkflowService } from '../features/projects/domain/ProjectWorkflowService';
```

The **preferred approach is Option A** (delete), since test files that import
`ProjectValidationService` and `ProjectWorkflowService` will also be relocated to the
projects feature, and no other callers reference these types.

---

## 11. Acceptance Criteria (Structural Refactor Only)

This is a **move-only** refactor. The following must all hold after the PR:

- [ ] All project files listed in §7 exist at their new paths.
- [ ] All original source paths in §7 are deleted.
- [ ] `npx tsc --noEmit` passes with zero errors.
- [ ] All project-related tests pass at their new paths (import paths updated).
- [ ] `GetAuditLogsByProjectUseCase.test.ts` and `GetNearbyProjectsUseCase.test.ts`
      remain in `__tests__/unit/` and continue passing (not moved).
- [ ] `ProjectRepository.ts` remains in `src/domain/repositories/` (not moved).
- [ ] `ProjectPicker.tsx` remains in `src/components/inputs/` (not moved).
- [ ] `ProjectPickerModal.tsx` remains in `src/components/shared/` (not moved).
- [ ] `src/features/projects/index.ts` barrel exports all items listed in §6.
- [ ] No new test scenarios introduced — existing assertions unchanged.
- [ ] `src/domain/services/index.ts` is deleted (Option A from §10).

---

## 12. Migration Execution Order (for developer)

To minimise intermediate TypeScript errors during migration, apply in this order:

1. Create `src/features/projects/` directory skeleton.
2. Move **domain** services (`ProjectValidationService`, `ProjectWorkflowService`).
3. Move **application** use cases and `ProjectCardDto`.
4. Move **infrastructure** (`DrizzleProjectRepository`, `ProjectMapper`,
   `InMemoryProjectRepository`, `LocalSqliteProjectRepository`).
5. Update `registerServices.ts` import path.
6. Move **components** (including `CriticalPathPreview/` subtree).
7. Move **hooks** (all 7 hooks).
8. Move **screens** (all 5 screens).
9. Create `src/features/projects/index.ts` barrel.
10. Update **external callers** (tabs, dashboard, payments, shared ProjectPicker,
    tasks page) to use barrel imports.
11. Move **tests** to `src/features/projects/tests/` and update import paths.
12. Update or delete `src/domain/services/index.ts`.
13. Run `npx tsc --noEmit` and `npm test` — fix any residual import issues.
