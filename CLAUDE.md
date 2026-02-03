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