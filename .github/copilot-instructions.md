# Copilot Instructions — React Native (TypeScript) Coding Conventions

Purpose
- Provide a concise, opinionated guide for scaffolding and authoring TypeScript code in this React Native project.
- Align with the project's clean architecture: domain → application → data/platform → presentation.

General rules
- Language: TypeScript (strict). Prefer `unknown` for external inputs and validate before narrowing.
- Runtime: Target React Native latest stable. Keep domain code free of RN/platform APIs.
- Files: Use .ts for logic, .tsx for React components.
- Line length: 100 chars. Use Prettier to enforce formatting.
- Linting: ESLint + TypeScript plugin. Fix lint errors before merge.

Repository layout (required)
- src/
  - domain/          ← Pure logic: entities, value-objects, use-cases, interfaces
  - application/     ← Orchestration, services, DTOs, DI container
  - data/            ← Repository implementations, datasources, network models
  - presentation/    ← screens, components, navigation, hooks, styles
  - platform/        ← OS-specific adapters/native modules (ios/, android/)
  - shared/          ← utils, constants, validators
  - assets/
  - tests/           ← unit and integration tests organized by layer

Naming conventions
- Files: kebab-case (e.g. auth-service.ts, login-screen.tsx).
- Types/Classes/Interfaces: PascalCase (UserEntity, IUserRepository).
- Interfaces: prefix with `I` only for repository/port interfaces (IUserRepository). Prefer type aliases for DTOs where appropriate.
- Hooks: `useXxx` (useAuth, useFetchUser).
- Components: PascalCase and single export default for screen components.

Domain layer rules
- No imports from React, React Native, or platform modules.
- Expose pure classes/functions and repository interfaces only.
- Use explicit return types on public functions and use-cases.

Application layer rules
- Orchestrates use-cases and selects repository implementations via DI.
- Contains a thin facade for presentation layer consumption.
- Keep side effects outside domain — services in application layer handle them.

Presentation layer rules
- Small, focused components. Keep business logic out — call application facades/hooks.
- Prefer functional components + React.memo where appropriate.
- Styles: use StyleSheet.create and colocate styles with component file.

Platform/data rules
- Implement repository interfaces from domain.
- Wrap native modules and 3rd-party SDKs inside platform adapters.
- Keep platform-specific code inside src/platform/* and android/ios native folders.

Typing & safety
- Enable "strict": true in tsconfig.
- Avoid `any`. If unavoidable, add a FIXME with rationale and link to issue.
- Return Result/Either types for operations that can fail (prefer explicit error models).

Testing
- Unit tests: Jest + ts-jest. Test domain and application logic thoroughly.
- Presentation tests: React Native Testing Library for components.
- Organize tests mirroring src/ structure under tests/.

Tooling & config (must exist)
- tsconfig.json: strict mode, baseUrl = "src", paths configured for layers.
- .eslintrc.js + plugins: @typescript-eslint, react, react-native.
- .prettierrc: project formatting rules.
- Husky pre-commit: run lint and tests for changed files.
- Commit messages: Conventional Commits.

Example snippets
- Export barrels: each layer should have an index.ts that re-exports public API.
- DI container (application/di/container.ts) should provide a single place to swap/test implementations.

PR requirements
- Link issue(s), describe architectural impact.
- Add/modify tests for new logic.
- Ensure lint and type checks pass.

Maintenance
- Keep architecture README updated when making layer changes.
- For breaking changes in domain interfaces, create migration guide in docs/.