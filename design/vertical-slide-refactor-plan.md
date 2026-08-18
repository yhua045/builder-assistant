# Vertical Slice Refactor Plan

## Goal

Refactor the app from a mixed layer-first structure into a clean feature-first vertical slice layout while preserving the existing domain/application/infrastructure separation that the repository already follows. The target architecture should make each feature self-contained, reduce cross-feature coupling, and make onboarding easier without breaking the current business logic and repository contracts.

## 1. Domain Model & Entities

### Core bounded contexts

1. Project management
   - Project
   - ProjectDetails
   - ProjectStatus
   - Property / Milestone
   - ChangeOrder / Variation

2. Task execution
   - Task
   - TaskDependency
   - DelayReason
   - ProgressLog
   - TaskCockpitState

3. Finance & procurement
   - Invoice
   - Payment
   - Quotation
   - Expense / Receipt

4. Knowledge & document processing
   - Document
   - KnowledgeChunk
   - ChunkingContext
   - DocumentSource / OCR metadata

### Relationships

- A Project owns many Tasks, Invoices, Quotations, and Documents.
- A Task may depend on other Tasks and can have multiple ProgressLog entries and DelayReason records.
- An Invoice can have many Payments and relate to a Quotation or Project.
- A Document belongs to a Project and produces multiple KnowledgeChunk records.
- Domain services enforce state transitions and invariants rather than UI code:
  - ProjectWorkflowService: allowed status changes
  - ProjectValidationService: project creation rules
  - DocumentChunkingService: chunk boundaries and overlap

### State model conventions

- Domain entities should be immutable or near-immutable at runtime.
- State transitions remain explicit in use cases and domain services.
- The app should not store “screen state” in domain entities; presentation state remains in UI hooks.

## 2. Key Abstractions & Interfaces

### Domain contracts

- ProjectRepository
- TaskRepository
- InvoiceRepository
- PaymentRepository
- QuotationRepository
- DocumentRepository
- KnowledgeChunkRepository

These remain the core ports used by application use cases. They should remain thin and free of infrastructure concerns.

### Application contracts

- CreateProjectUseCase
- GetProjectAnalysisUseCase
- CreateTaskUseCase
- GetTaskDetailUseCase
- RecordPaymentUseCase
- ProcessInvoiceUploadUseCase
- SnapReceiptUseCase
- ChunkDocumentUseCase

These orchestrate repository access and validation without directly importing database or React code.

### Feature-level ports

Each feature owns a feature-specific interface layer:

- Projects feature: ProjectGateway, ProjectQueryService, ProjectAnalyzer
- Tasks feature: TaskScheduler, TaskDependencyValidator, TaskCockpitCalculator
- Invoices feature: InvoiceNormalizationService, PaymentLedgerService
- Knowledge feature: DocumentChunkingService, EmbeddingProvider

### Infrastructure implementations

- DrizzleProjectRepository
- DrizzleTaskRepository
- LocalDocumentStorageEngine
- MobileOcrAdapter
- GroqTranscriptParser
- MobileAudioRecorder
- StubSuggestionService

These remain behind the domain/application interfaces and are registered in the composition root, not imported deep into feature logic.

## 3. Source Code Structure

### Proposed target layout

```text
src/
  app/
    App.tsx
    navigation/
      tabs/
      stacks/
    providers/
      QueryProvider.tsx
      ThemeProvider.tsx
    bootstrap/
      registerServices.ts
      initDatabase.ts

  features/
    projects/
      domain/
        entities/
        services/
        repositories/
      application/
        usecases/
        dto/
      infrastructure/
        repositories/
        mappers/
      ui/
        screens/
        components/
        hooks/
        index.ts

    tasks/
      domain/
      application/
      infrastructure/
      ui/

    invoices/
      domain/
      application/
      infrastructure/
      ui/

    payments/
      domain/
      application/
      infrastructure/
      ui/

    knowledge/
      domain/
      application/
      infrastructure/
      ui/

    auth/
      domain/
      application/
      infrastructure/
      ui/

  shared/
    domain/
      entities/
      value-objects/
      services/
    application/
      ports/
      usecases/
      dto/
    infrastructure/
      db/
      storage/
      analytics/
      adapters/
      di/
      config/
    ui/
      components/
      hooks/
      theme/
```

### Practical migration strategy

1. Keep the current feature modules (`src/features/projects`, `src/features/tasks`, etc.) as the base for the vertical-slice refactor.
2. Move feature-specific domain logic under each feature’s `domain/` folder.
3. Keep only truly shared cross-cutting types in `src/shared`.
4. Move screen-level orchestration into `src/features/.../ui` and remove direct repository usage from hooks where possible.
5. Keep the `src/app` layer responsible for composition and dependency wiring only.
6. Preserve the existing `src/domain` and `src/application` folders temporarily as compatibility shims or deprecate them after migration.

### How this maps to the current repo

- `src/features/projects` is already close to a vertical slice and should become the model for the rest of the app.
- `src/pages/` and `src/components/` should be gradually absorbed into feature-specific `ui/` folders.
- `src/infrastructure/di/registerServices.ts` becomes the composition root, with feature registration delegated from `src/app/bootstrap`.
- The current `App.tsx` should be reduced to app composition: providers, navigation, startup wiring, and environment bootstrapping.

## 4. Architectural Trade-offs & Risks

### Benefits

- Feature ownership becomes clearer and easier to reason about.
- Changes to a feature are less likely to touch unrelated screens or infrastructure code.
- New onboarding is faster because each feature contains its own domain, use cases, and UI.
- It aligns better with the repo’s real “feature module” pattern already present in `src/features/*`.

### Risks

1. Shared entity duplication
   - Without strict rules, the same entity can be copied across features.
   - Mitigation: place only cross-feature primitives in `src/shared`, and feature-specific business objects in the owning feature slice.

2. Hidden cross-feature coupling
   - A screen may still import another feature’s repository or service directly.
   - Mitigation: enforce dependency direction via review rules and a composition root.

3. Over-aggregation in feature folders
   - Large features may become “god modules” if not split by bounded contexts.
   - Mitigation: split by subdomains such as `projects/list`, `projects/analysis`, `tasks/detail`, `tasks/cockpit`.

4. Migration churn
   - A full rewrite is risky in an active app.
   - Mitigation: do the refactor incrementally; build the new structure around existing feature boundaries and keep stable exports while migrating imports.

5. DI complexity
   - If every feature creates its own container wiring, the app can become harder to follow.
   - Mitigation: centralize registration in the app bootstrap and keep feature packages simple.

### Recommended migration rule

> Feature modules may depend on shared infrastructure and shared domain services, but they must not import from arbitrary app or page-level modules. UI code may call feature hooks, and hooks may call feature use cases, but database and platform adapters stay hidden behind the composition root.

## Recommended Final Direction

The app should become a hybrid of Clean Architecture and vertical slicing:

- feature-first organizational structure
- strict dependency inversion inside each slice
- shared primitives only for truly reusable logic
- app bootstrap for wiring and startup

This preserves the current architecture’s intent while matching the project’s real implementation style and making the repo easier to scale.

## Remaining Task Summary

The migration is already partially complete and the repo is in a safe compatibility-first state: feature entry points have been moved under `src/features/.../ui`, while legacy imports remain re-exported so the app continues to compile without a destructive rewrite. The remaining work is to continue normalizing the remaining direct feature-to-screen imports and finish moving the last feature screens into their vertical-slice `ui/` entry points, keeping the public API stable until the final cleanup phase. Validation is maintained via `npx tsc --noEmit` after each migration batch.

## Appendix: Use-case layer split proposal

Use cases should be split by responsibility, not just by folder name:

- Move to `src/app` / feature app layer:
  - auth session actions (`LoginUseCase`, `LogoutUseCase`, `GetAuthStateUseCase`)
  - UI-driven workflows such as quick-add/import flows for contacts
  - any use case that is directly orchestrating a screen-level action or user session transition

- Keep in `src/shared/application` / shared service layer:
  - document parsing, location fallback logic, audit log queries, lookup provider search, suggestion engines, and critical-path orchestration
  - any use case that is repository/service-driven and has no direct UI or app-state dependency

### Rule of thumb

- App-level use cases: user flow, provider state, screen actions, session transitions
- Shared use cases: business/service orchestration, adapters, repository access, policy logic, fallback behavior

### Recommended structure

```text
src/app/
  auth/
  contacts/

src/shared/application/
  usecases/
  services/
```

This keeps the architecture consistent with the repo’s existing feature modules while preserving the Clean Architecture dependency direction: UI -> app feature -> shared application -> domain/infrastructure.

## Hooks migration plan

### Goal

The root `src/hooks` folder should be dissolved as a migration step. The refactor is not about renaming files only; it is about making each hook live next to the feature or shared concern that owns it. This reduces hidden cross-feature imports, keeps screen logic near the relevant feature, and removes the last “global utility bucket” that violates the vertical-slice direction.

### Migration rule

1. Feature-owned hooks stay with their feature slice.
2. Reused UI hooks that are not tied to a single business domain move under `src/shared/ui/hooks` or `src/shared/infrastructure/query`.
3. No hook should live in a root-level folder once the migration is complete.
4. `src/hooks` becomes a temporary compatibility shim only during the transition; it should be removed before final cleanup.

### Proposed mapping of the current hook set

| Current hook | Final location | Reason |
| --- | --- | --- |
| `useBlockerBar` | `src/features/tasks/hooks/useBlockerBar.ts` | It computes task blocker data and is owned by the task cockpit flow. |
| `useCockpitData` | `src/features/tasks/hooks/useCockpitData.ts` | Task cockpit is part of the tasks feature boundary. |
| `useCriticalPath` | `src/features/tasks/hooks/useCriticalPath.ts` | This is tightly coupled to task scheduling and suggestion creation. |
| `useAuditLog.ts` | `src/features/projects/hooks/useAuditLogsByProject.ts` and `src/features/tasks/hooks/useAuditLogsByTask.ts` or a shared query wrapper under `src/shared/infrastructure/query` | Audit log access is consumed by both projects and tasks, so the final form should be a shared query abstraction with feature-specific adapters. |
| `useContacts` | `src/shared/ui/hooks/useContacts.ts` | It is used across task forms, quotation forms, and shared selectors rather than a single feature. |
| `useTeams` | `src/shared/ui/hooks/useTeams.ts` | It is used by shared selector inputs rather than a domain feature. |
| `useQuickLookup` | `src/shared/ui/hooks/useQuickLookup.ts` | It powers reusable contractor lookup and quick-add flows across multiple features. |
| `useConfirm` | `src/shared/ui/hooks/useConfirm.ts` | This is a presentation utility for any confirm flow. |
| `useAnalytics`, `useScreenTracking`, `useScreenView` | `src/shared/ui/hooks/useAnalytics.ts`, `src/shared/ui/hooks/useScreenTracking.ts`, `src/shared/ui/hooks/useScreenView.ts` | These are app-wide tracking concerns and should live with cross-cutting UI hooks. |
| `useAnalyticsOptOut` | `src/shared/ui/hooks/useAnalyticsOptOut.ts` | Privacy preference is app-wide and not scoped to a business feature. |
| `useDelayReasonTypes` | `src/features/tasks/hooks/useDelayReasonTypes.ts` | The delay reason taxonomy is part of the task detail workflow. |
| `queryKeys.ts` | `src/shared/infrastructure/query/queryKeys.ts` | This is a cross-feature cache registry and should not sit in a feature folder. |

### Recommended source structure after the hook refactor

```text
src/
  app/
    App.tsx
    navigation/
    providers/
    bootstrap/

  features/
    auth/
      hooks/
      ui/
      application/
      infrastructure/

    dashboard/
      hooks/
      screens/
      components/

    projects/
      domain/
      application/
      infrastructure/
      hooks/
      ui/

    tasks/
      domain/
      application/
      infrastructure/
      hooks/
      ui/

    payments/
      hooks/
      ui/

    quotations/
      hooks/
      ui/

    receipts/
      hooks/
      ui/

  shared/
    infrastructure/
      query/
        queryKeys.ts
      di/
      analytics/
    ui/
      hooks/
        useAnalytics.ts
        useAnalyticsOptOut.ts
        useScreenTracking.ts
        useScreenView.ts
        useConfirm.ts
        useContacts.ts
        useTeams.ts
        useQuickLookup.ts
      components/
      theme/
```

### Implementation approach

1. Start with the clearly feature-owned hooks under `src/features/*/hooks`.
2. Move the shared UI and analytics hooks into `src/shared/ui/hooks`.
3. Promote the query cache definitions into `src/shared/infrastructure/query` and update imports to the new path.
4. Replace deep root imports with feature/domain-appropriate imports.
5. Keep compatibility re-exports temporarily so the app continues to compile during the transition.
6. Remove the root `src/hooks` directory only after all imports have been migrated and TypeScript validation is green.

### Why this structure works

- Feature hooks stay close to the feature they serve.
- Cross-cutting hooks are not hidden behind a root-level “miscellaneous” folder.
- `queryKeys` remains a shared source of truth for cache invalidation without coupling a cache registry to one feature.
- The final layout aligns with the vertical slice principle: stateful logic, orchestration, and UI stay inside the feature boundary unless the concern is truly cross-cutting.

### Migration checklist for the hook cleanup

- [ ] Move task cockpit hooks under `src/features/tasks/hooks`
- [ ] Move project-specific audit-log hooks under the owning feature
- [ ] Move reusable contact and lookup hooks under `src/shared/ui/hooks`
- [ ] Move analytics and confirmation hooks under `src/shared/ui/hooks`
- [ ] Move `queryKeys.ts` under `src/shared/infrastructure/query`
- [ ] Delete `src/hooks` once all imports are updated
- [ ] Validate with `npx tsc --noEmit`

This hook migration is the final architectural cleanup step that makes the vertical-slice structure consistent end-to-end: features own their stateful logic, while the shared layer owns only truly cross-cutting concerns.
