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

### Test-Driven Development (TDD) Workflow for Implementations

Follow this TDD flow to ensure correctness, traceability, and easy handover.

0. Planning session — capture design and acceptance criteria
	- Before writing tests, hold a short planning session to agree the scope and acceptance criteria.
	- Record the proposed implementation details and design in `design/[ticket-reference-and-description]` (for example, [design/#32-create-project-page.md](design/#32-create-project-page.md)).
	- Include: user story, UI mockups or component sketches, API/contracts, migration notes, and explicit test acceptance criteria.

1. Design the abstraction (interface/port) first
	- Define repository/use-case interfaces in `src/domain/repositories` or `src/application` as appropriate.
	- Keep the interface minimal and focused on the behaviour required by the use cases.

2. Write failing tests against the abstraction
	- Add unit tests in `__tests__/unit/` that assert required behaviour using mocked adapters.
	- Add integration tests in `__tests__/integration/` when checking interactions with real adapters (e.g., Drizzle/SQLite).
	- Tests should be written to fail initially (red) — this verifies the test coverage and spec.

3. Implement the smallest change to make tests pass
	- Implement a concrete adapter or use-case implementation in `src/infrastructure` or `src/application`.
	- Prefer small, well-scoped commits that make a single test pass.

4. Refactor with confidence
	- Once tests are green, refactor code to improve clarity or remove duplication while keeping tests passing.
	- Update or add tests if behaviours change.

5. PR and review
	- Push the branch and open a PR. The PR description should reference failing test(s) and the implemented change and link the design doc.
	- Request at least one reviewer; wait for approval before merging.

6. Merge and end-of-cycle summary
	- After merge, summarise the key changes, decisions, and trade-offs made during the task in `progress.md` (see [progress.md](progress.md)).
	- The summary should refer to ## Progress.md template section (in this document).

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
- State Management:
- Local Storage:



## Progress.md file template
# Project Progress
Last Updated: YYYY-MM-DD
Current Milestone: <Short, single-line goal>
---


---
## 2. Confirmed Architectural Decisions (Non-Negotiable)

- Use <architecture pattern> (e.g., MVVM / Clean Architecture / Feature-based)
- Navigation handled via <library>
- State is managed only via <pattern>
- API layer must go through <network abstraction>
- No business logic inside UI layer
- All async operations handled via <approach>
- Error handling follows unified pattern

(Only add decisions that affect implementation direction.)
---

## 3. Core Domain Model Snapshot (Source of Truth)

### User
- id:
- email:
- role:
- createdAt:

### <Other Core Entity>
- field:
- field:

(Keep concise. No explanation text.)

---

## 5. App Structure Overview (Current)

Feature Modules:
- Auth
- Home
- Profile
- <etc>

Shared Modules:
- Networking
- Storage
- Theme
- Components
- Utils

Folder Convention:
<Brief description of structure style>

---

## 6. Current Milestone Breakdown

Goal:
<Clear statement of what is being built>

Scope:
- Included:
- Not Included:

Success Criteria:
- [ ] Condition 1
- [ ] Condition 2
- [ ] Condition 3

---

## 7. Task Ledger

### Completed
- 
- 

### In Progress
- 

### Next
- 

---

## 8. Critical Invariants (Must Never Break)

- A logged-out user cannot access protected routes.
- Tokens must be stored securely.
- API calls must be cancellable.
- All screens must handle loading and error states.
- Offline-safe operations must queue properly.

(Add invariants as system matures.)

---

## 9. Known Constraints

Performance:
- 

Security:
- 

Platform Limitations:
- 

Business Constraints:
- 

---

## 10. Open Questions (Do Not Guess)

- 
- 
- 