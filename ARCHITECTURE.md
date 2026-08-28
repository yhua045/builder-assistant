# Builder Assistant — Architecture Guide

## Overview

Builder Assistant is a React Native construction project management app for owner-builders. It follows **Clean Architecture** with strict layer separation and a **Test-Driven Development (TDD)** approach. All production code lives in TypeScript; the test suite runs entirely on-device or in-process with no server required.

### Technology Stack

| Concern | Technology |
|---|---|
| Framework | React Native 0.81.1 + React 19.1.0 |
| Language | TypeScript 5.8+ (strict mode) |
| Styling | NativeWind v4 (Tailwind CSS) + `lucide-react-native` icons |
| Navigation | React Navigation v7 (Bottom Tabs + Native Stack) |
| Persistence | Drizzle ORM v0.45 schema/migrations over `react-native-sqlite-storage` (SQLite); runtime queries use raw `db.executeSql()` via the SQLite proxy |
| File Storage | `react-native-fs` (abstracted via `LocalDocumentStorageEngine`) |
| Camera / File Pick | `react-native-image-picker`, `react-native-document-picker` |
| Audio / Voice | `react-native-nitro-sound`, Groq STT + LLM transcript parsing |
| PDF Conversion | `rn-pdf-renderer` |
| ML / OCR | `@react-native-ml-kit/text-recognition` + deterministic normalizer |
| DI Container | **tsyringe** (primary — singleton registration in `registerServices.ts`) + legacy hand-rolled Map registry (`container.ts`, vestigial) |
| Testing | Jest 29 + React Test Renderer + `@testing-library/react-native` |
| Integration DB | `better-sqlite3` in-memory (test-only, shims native SQLite) |
| Node requirement | ≥ 20 |

---

## Source Code Structure

The project now follows a vertical-slice organization: each feature owns its domain, application, infrastructure, and UI concerns together, while shared utilities and cross-cutting infrastructure remain in `src/shared` and `src/app`.

```
/
├── App.tsx                        # App shell, root providers, navigation bootstrap
├── index.js                       # React Native bootstrap entry
├── android/                       # Android native project
├── ios/                           # iOS native project + CocoaPods
├── assets/                        # Static assets and demo media
├── drizzle/migrations/            # Generated Drizzle SQL migrations
├── design/                        # Planning/design docs per issue / feature
├── docs/                          # Product and architecture documentation
├── src/
│   ├── app/                       # Application shell and app-level composition
│   │   ├── bootstrap/             # startup wiring, initialization, env config
│   │   ├── navigation/            # tab/stack navigation composition
│   │   ├── providers/             # app-wide providers (theme, analytics, auth, app state)
│   │   ├── screens/               # app-level screens / route entry points
│   │   ├── index.ts               # app exports / public barrel
│   │   └── ...
│   ├── features/                  # Vertical-slice feature folders
│   │   ├── auth/                  # auth domain + app logic + screens + infra
│   │   │   ├── application/
│   │   │   ├── domain/
│   │   │   ├── infrastructure/
│   │   │   ├── screens/
│   │   │   ├── tests/
│   │   │   └── index.ts
│   │   ├── projects/
│   │   ├── tasks/
│   │   ├── invoices/
│   │   ├── payments/
│   │   ├── quotations/
│   │   ├── receipts/
│   │   ├── knowledge-embedding/
│   │   └── ...
│   ├── shared/                    # Cross-cutting, shared primitives
│   │   ├── application/           # shared use cases / ports / orchestration logic
│   │   ├── config/                # feature flags, environment config, app settings
│   │   ├── data/                  # shared data access primitives / repository helpers
│   │   ├── domain/                # shared entities, value objects, core interfaces
│   │   ├── infrastructure/        # common adapters, DI, storage, analytics, DB wiring
│   │   ├── ui/                    # shared UI primitives and design-system building blocks
│   │   └── index.ts
│   ├── hooks/                     # app-level hooks retained for compatibility and cross-feature composition
│   ├── pages/                     # legacy/feature page entry points still present in some areas
│   ├── shims/                     # Metro / RN compatibility shims
│   ├── types/                     # TypeScript global declarations and shared type contracts
│   ├── utils/                     # pure utility functions and helpers
│   └── ...
└── ...
```

### Feature layout convention

Each feature is organized as its own slice rather than by technical layer. A representative feature folder usually includes:

- `domain/` — entities, value objects, repository contracts, domain services
- `application/` — use cases, commands, queries, mappers, ports, orchestration
- `infrastructure/` — data access implementations, API adapters, persistence, DI wiring
- `screens/` or `ui/` — feature-specific screens, components, forms, and view logic
- `tests/` — unit/integration coverage for that feature

This keeps code close to the business capability it implements, reduces import coupling across layers, and makes feature onboarding easier.

### Shared layer responsibilities

- `src/app/` owns bootstrap, navigation, providers, and app-level composition
- `src/shared/` holds reusable cross-cutting concerns: analytics, configuration, storage, DI, and generic UI primitives
- `src/features/*` owns feature-specific implementation details and is the primary unit of change in the codebase


---

## Architecture Layers

The codebase is organized around feature slices, not pure technical layers. Each feature owns its domain logic, application use cases, infrastructure adapters, and screen code together; the shared app shell and cross-cutting infrastructure live in `src/app` and `src/shared`.

### Dependency direction

```
UI / screens / hooks
      ↓
feature application logic
      ↓
feature domain contracts + rules
      ↑
feature + shared infrastructure implementations
```

### Feature slice structure

A feature folder usually contains:

- `domain/` — entities, value objects, repository contracts, domain services
- `application/` — use cases, commands, queries, orchestration, ports
- `infrastructure/` — repositories, persistence adapters, API clients, native bridge code
- `screens/` or `ui/` — feature screens, forms, and widgets
- `tests/` — feature-level unit/integration checks

### Shared infrastructure

- `src/app/` — application bootstrap, providers, navigation, app-wide composition
- `src/shared/` — cross-cutting utilities, analytics, config, storage, DI, and reusable UI
- `src/features/*` — business capability implementations; each feature is the primary unit of change

### Practical rule

Use DI to resolve repository and adapter implementations from the shared container, and keep feature code focused on the capability it owns. Avoid importing infrastructure code directly into screens or unrelated features.

---

## Database Overview

The app uses a single SQLite database managed by Drizzle. Most data is project-scoped and linked through soft foreign keys such as `project_id`, `task_id`, `document_id`, and `quote_id`; a smaller set of lookup and operational tables supports workflow state, audit trails, and document-chunking pipelines.

### Feature-domain tables

- `projects` + `project_phases` + `milestones` + `inspections` + `change_orders` + `work_variations` + `materials` + `properties`: project planning, lifecycle, site, and construction tracking.
- `tasks` + `task_dependencies` + `delay_reason_types` + `task_delay_reasons` + `task_progress_logs`: work execution, dependency ordering, delays, and progress history.
- `documents` + `expenses` + `invoices` + `payments` + `quotations` + `contacts`: financial records, attachments, quotations, suppliers, and contacts.
- `audit_logs` + `last_known_locations`: operational traceability and location history.
- `extracted_document_text` + `knowledge_chunks` + `knowledge_embeddings` + `document_chunking_workflows` + `project_facts`: knowledge extraction, chunking, embedding, and project fact persistence for AI-assisted analysis.

### Shared / system core

- `src/shared/infrastructure/database/schema.ts` is the single source of truth for the persisted schema and migration generation.
- Timestamps are stored as Unix milliseconds; repository code converts them at the app boundary when needed.
- `chunk_document_progress` tracks resumable document-chunking checkpoints and retry state.
- `project_facts` and `knowledge_*` tables are the persisted substrate for RAG-style retrieval and downstream analysis.

---

## Key Gotchas & Conventions

- **Raw SQL is confined to repository implementations.** `DrizzleXxxRepository` classes in `src/infrastructure/repositories/` use `db.executeSql()` at runtime — the Drizzle ORM query builder is **not** used for queries. Drizzle is used for schema definition (`schema.ts`) and migration file generation only. Never write raw SQL in `application/` or `domain/` code.
- **No business logic in hooks or components — with one documented exception.** `useTaskForm.computeQuoteStatus()` auto-derives `quoteStatus` from `taskType` + `quoteAmount` as a UI-side convenience before calling the use case. This is acceptable for simple UI-driven derivation. All persistence rules and state-transition logic must live in use cases or domain services.
- **Use tsyringe for all new DI registrations.** Add singleton registrations in `src/infrastructure/di/registerServices.ts`. Do not add new registrations to the legacy `container.ts`.
- **Use cases are not registered in the DI container.** Hooks instantiate use cases directly via `new XxxUseCase(repo)`. Use cases are stateless so this is safe and keeps instantiation explicit.
- **Do not resolve repositories directly in screens.** Screens should call hook functions, which delegate to use cases. `TaskDetailsPage` currently resolves `DocumentRepository` directly (a known inconsistency) — do not replicate this pattern.
- **Entity factories throw on invalid input.** Wrap `Entity.create()` calls in try/catch at the use case boundary; don't swallow errors silently.
- **`clearContainer()` in tests.** Always call `clearContainer()` in `beforeEach` when your test registers DI bindings, otherwise state leaks between test files.
- **NativeWind class names only.** Avoid inline `style={{}}` props in components — ESLint rule `react-native/no-inline-styles` will flag them.
- **Migrations are additive.** Never edit an already-committed SQL migration. Add a new migration for corrections.
- **Timestamps are stored as Unix milliseconds (INTEGER) in SQLite.** The repository layer converts to/from ISO strings at the boundary. Do not store ISO strings directly — the schema expects integers.
- **`FEATURE_AI_SUGGESTIONS` feature flag** (`src/config/featureFlags.ts`) guards AI suggestion fetching in `useTaskDetail`. `StubSuggestionService` is the registered default; the flag prevents any real LLM calls until a production adapter is wired.
- **`TfLiteReceiptNormalizer` is a placeholder** — it falls back to `DeterministicReceiptNormalizer` until a trained `.tflite` model is wired in.
- **`externalId` / `externalReference` on Invoice** — nullable, treated as a composite unique key only when *both* are non-null. Normalised at the repository layer.
- **`project_id` on payments is nullable** — a payment may exist without a linked project (e.g. direct expenses captured via Snap Receipt).

---

## Essential Reading Order

1. [CLAUDE.md](CLAUDE.md) — Development workflow, TDD steps, quick commands
2. [ARCHITECTURE.md](ARCHITECTURE.md) — This file
3. [progress.md](progress.md) — Current milestone and pending tasks
4. [DRIZZLE_SETUP.md](DRIZZLE_SETUP.md) — Database setup details
5. [docs/DATABASE_MIGRATIONS.md](docs/DATABASE_MIGRATIONS.md) — Migration bundling guide
6. [docs/WORKFLOWS.md](docs/WORKFLOWS.md) — Project status transition rules
7. [docs/DI-container.md](docs/DI-container.md) — DI container usage

Design documents for each feature live in `design/issue-<N>-<name>.md`.