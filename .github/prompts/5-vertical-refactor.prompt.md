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