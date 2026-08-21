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

Drizzle ORM is the canonical and required persistence layer for this project. Infrastructure code and repository implementations MUST use Drizzle (via `DrizzleProjectRepository` or a Drizzle-backed adapter). Do NOT use raw SQLite provider APIs directly (for example, using `react-native-sqlite-storage` directly from application or domain code) except inside the low-level Drizzle adapter or test shims.

**Default implementation**: `DrizzleProjectRepository` with automatic migrations

- **Schema**: TypeScript definitions in `src/infrastructure/database/schema.ts`
- **Migrations**: Auto-generated in `drizzle/migrations/`, applied on app start
- **Connection**: Managed by `src/infrastructure/database/connection.ts`

Notes:
- Production and development code should use Drizzle ORM and the typed schema. Avoid bypassing Drizzle with custom SQL in application code.
- Small in-memory or mock SQLite adapters are acceptable only for unit tests (see `__tests__/*`), but integration and runtime code must rely on Drizzle.
- If you need low-level access for a migration or special query, add a small, well-documented Drizzle helper in `src/infrastructure/database/` rather than scattering raw SQL across the codebase.

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

