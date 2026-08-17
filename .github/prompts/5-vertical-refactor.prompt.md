---
description: Perform the vertical slice refactor of the codebase according to the approved design plan and existing test suite.
---
Implement the vertical slice refactor of the codebase strictly following the approved design plan as ##3 outlined.

1. Ensure all import path are updated to reflect the new folder structure.
2. Ensure the code are compiled.
3. Remove any unused code, files, or folders that are no longer needed after the refactor.

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

### Component migration proposal from `src/components`

- Move reusable form primitives to `src/shared/ui/components/inputs/`:
  - `ContactSelector`, `ContractorLookupField`, `DatePickerInput`, `Dropdown`, `OptionList`, `ProjectPicker`, `TeamSelector`
- Move shared UI shell utilities to `src/shared/ui/components/`:
  - `ErrorBoundary`, `ThemeToggle`
- Move feature-owned pickers/modals into their feature slice:
  - `ProjectPickerModal` -> `src/features/projects/ui/components/ProjectPickerModal.tsx`
  - `QuickAddContractorModal` -> `src/features/projects/ui/components/QuickAddContractorModal.tsx` or `src/shared/ui/components/forms/` if reused by multiple features
- Move dashboard-only widgets to the feature slice:
  - `QuickStats.tsx` -> `src/features/dashboard/ui/components/QuickStats.tsx`
- Remove the top-level `src/components` directory after migration; only shared UI should remain in `src/shared` and feature-specific UI should remain under each `src/features/*/ui` folder.