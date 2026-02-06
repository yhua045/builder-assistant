# CLAUDE.md

Guidance for working with this React Native construction project management app built with Clean Architecture.

## Quick Commands

```bash
npm start              # Start Metro bundler
npm run ios/android    # Run on simulator/emulator
npm test               # Run tests
npx tsc --noEmit       # Type check (always run before commits)

# Database migrations (Drizzle ORM)
npm run db:generate    # Generate migration from schema changes
npm run db:push        # Push schema directly (dev only)
npm run db:studio      # Visual database editor
```

## Architecture Overview

**Clean Architecture** with strict layer separation:

```
/src
├── /domain              # Entities (Project, Material) & repository interfaces
├── /application         # Use cases (CreateProject, GetProjectAnalysis)
├── /infrastructure      # Database (Drizzle ORM), repositories
├── /components          # React Native UI
├── /hooks               # UI-to-application connectors
└── /utils               # Pure functions
```

**Dependency Flow**: UI → Hooks → Use Cases → Domain (inward only)

## Database (Drizzle ORM)

**Default implementation**: DrizzleProjectRepository with automatic migrations

- **Schema**: TypeScript definitions in `src/infrastructure/database/schema.ts`
- **Migrations**: Auto-generated in `drizzle/migrations/`, applied on app start
- **Connection**: Managed by `src/infrastructure/database/connection.ts`

### Migration Workflow
1. Edit TypeScript schema in `schema.ts`
2. Run `npm run db:generate` to create SQL migration
3. Restart app to auto-apply migrations

See [DRIZZLE_SETUP.md](DRIZZLE_SETUP.md) and [docs/DATABASE_MIGRATIONS.md](docs/DATABASE_MIGRATIONS.md) for details.

## Development Guidelines

### Adding Features
1. Define entities/interfaces in `/domain`
2. Create use cases in `/application`
3. Implement repositories in `/infrastructure`
4. Build UI in `/components`
5. Connect with hooks in `/hooks`

### Code Conventions
- TypeScript strict mode, immutable domain entities
- Dependency injection in use cases
- Repository pattern for data access
- `useMemo`/`useCallback` in hooks
- Explicit StyleSheet types

### Test-Driven Development (TDD) Workflow for Implementations

When implementing features (not during planning), follow a strict TDD flow to ensure correctness and maintainability:

1. Design the abstraction (interface/port) first
	- Define repository/use-case interfaces in `src/domain/repositories` or `src/application` as appropriate.
	- Keep the interface minimal and focused on the behaviour required by the use cases.

2. Write failing tests against the abstraction
	- Add unit tests in `__tests__/unit/` that assert required behaviour using mocked adapters.
	- Add integration tests in `__tests__/integration/` when checking interactions with real adapters (e.g., Drizzle/SQLite).
	- Tests should be written to fail initially (red) — this verifies the test coverage and spec.

3. Implement the smallest change to make tests pass
	- Implement a concrete adapter or use-case implementation in `src/infrastructure` or `src/application`.
	- Prefer simple, well-scoped commits that make a single test pass.

4. Refactor with confidence
	- Once tests are green, refactor code to improve clarity or remove duplication while keeping tests passing.
	- Update or add tests if behaviours change.

5. PR and review
	- Push the branch and open a PR. The PR description should reference failing test(s) and the implemented change.
	- Request at least one reviewer; wait for approval before merging.

6. Merge and iterate
	- After merge, create follow-up tasks for remaining work (UI, docs, migrations).

Notes
- Keep tests fast and deterministic. Use in-memory DBs or mocks for unit tests.
- Integration tests that touch SQLite/Drizzle should be isolated and given explicit timeouts.
- For schema changes, write migration tests to verify data preservation where applicable.


### Key Patterns
- **Repository**: Interface in domain, Drizzle implementation in infrastructure
- **Use Cases**: Handle business logic and validation
- **Hooks**: Manage React state, delegate to use cases
- **Entities**: Business rules in domain layer (e.g., `getTotalMaterialCost()`)

## Tech Stack
- React Native 0.81.1 + React 19.1.0
- TypeScript 5.8+ (strict)
- Drizzle ORM + SQLite (react-native-sqlite-storage)
- Jest for testing