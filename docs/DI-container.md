# Dependency Injection (DI) — tsyringe

This project uses `tsyringe` as the canonical dependency injection (DI) container. The container is used to register and resolve infrastructure implementations (for example, the `ProjectRepository`) so use-cases, hooks, and components receive dependencies via the container rather than constructing them directly.

Why `tsyringe`?
- Lightweight and TypeScript-friendly.
- Minimal boilerplate and good constructor injection support.
- Works well in React Native and Jest test environments.

Installation

Install the runtime and the required metadata helper:

```bash
npm install tsyringe reflect-metadata
```

Important: Import `reflect-metadata` once (early) in your app. `registerServices.ts` included in this project imports it for you.

Where to find the DI setup
- Service registrations: `src/infrastructure/di/registerServices.ts`
  - Registers default implementations used by the app (for example, `DrizzleProjectRepository` registered as the `ProjectRepository` token).
- Usage example (resolving a dependency): `src/hooks/useProjects.ts`
  - The hook resolves `ProjectRepository` from the tsyringe container: `container.resolve<ProjectRepository>('ProjectRepository')`.

How we register services

- The file `src/infrastructure/di/registerServices.ts` performs the app-level registration. Example:

```ts
import 'reflect-metadata';
import { container } from 'tsyringe';
import { DrizzleProjectRepository } from '../repositories/DrizzleProjectRepository';

container.registerSingleton('ProjectRepository', DrizzleProjectRepository);

export default container;
```

Notes:
- We use a string token (`'ProjectRepository'`) for clarity and to avoid coupling to concrete classes. You can also use symbols or classes as tokens.

Where to call registration

- Ensure `registerServices.ts` is imported early in your app bootstrap (for example, in the app entry file) so registrations are available before other modules resolve dependencies. In this repo we import `registerServices` in modules that resolve dependencies (for example `src/hooks/useProjects.ts`) — you may optionally import the file directly from your app entry (`App.tsx` or `index.js`) for explicit bootstrapping.

Overriding bindings in tests

tsyringe makes it easy to override bindings in tests. Typical patterns:

- Replace a binding for a specific test:

```ts
import { container } from 'tsyringe';

beforeEach(() => {
  container.registerInstance('ProjectRepository', new FakeProjectRepository());
});

afterEach(() => {
  container.clearInstances && (container.clearInstances() as any);
});
```

- Or register a factory for more advanced behavior:

```ts
container.register('ProjectRepository', { useFactory: () => new FakeProjectRepository() });
```

Troubleshooting

- "No provider found for token": ensure `registerServices.ts` is imported before resolving the token or register the binding in your test setup.
- When using decorators with `tsyringe`, make sure `reflect-metadata` is imported at app startup.

Migration notes

- If you want to replace `tsyringe` with a different DI library later (e.g., `awilix`), centralize all registrations in `src/infrastructure/di/registerServices.ts` to minimize effort when swapping implementations.

If you'd like, I can also:
- Add an explicit import of `src/infrastructure/di/registerServices.ts` to the app entry file for clearer startup ordering.
- Replace string tokens with symbol-based tokens for safer type checking.
