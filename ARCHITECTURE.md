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
| Persistence | Drizzle ORM v0.45 over `react-native-sqlite-storage` (SQLite) |
| File Storage | `react-native-fs` (abstracted via `LocalDocumentStorageEngine`) |
| Camera / File Pick | `react-native-image-picker`, `react-native-document-picker` |
| Audio / Voice | `react-native-nitro-sound`, Groq STT + LLM |
| PDF Conversion | `rn-pdf-renderer` |
| ML / OCR | `@react-native-ml-kit/text-recognition` + deterministic normalizer |
| DI Container | Lightweight custom registry (`src/infrastructure/di/container.ts`) + `tsyringe` (decorator pattern) |
| Testing | Jest 29 + React Test Renderer + `@testing-library/react-native` |
| Integration DB | `better-sqlite3` in-memory (test-only, shims native SQLite) |
| Node requirement | ≥ 20 |

---

## Source Code Structure

```
/
├── App.tsx                        # Application entry point, navigation root
├── index.js                       # React Native entry (registers App)
├── android/                       # Android native project
├── ios/                           # iOS native project + CocoaPods
├── assets/                        # Static assets (images, fonts)
├── drizzle/migrations/            # Generated SQL migration files
├── design/                        # Per-issue design docs (planning artefacts)
├── docs/                          # Supplementary documentation
└── src/
    ├── domain/                    # 🔵 Domain Layer — pure business logic
    │   ├── entities/              # Business entities (see list below)
    │   ├── repositories/          # Repository interfaces (contracts only)
    │   └── services/              # Domain services (e.g. ProjectWorkflowService)
    ├── application/               # 🟢 Application Layer — use case orchestration
    │   ├── usecases/              # Grouped by domain (project/, invoice/, quotation/, …)
    │   ├── ai/                    # Normalizer interfaces & implementations (invoice OCR)
    │   ├── receipt/               # Receipt normalizer logic
    │   ├── dtos/                  # Data-transfer objects (e.g. ProjectCardDto)
    │   └── services/              # Application services
    ├── infrastructure/            # 🔴 Infrastructure Layer — I/O implementations
    │   ├── database/              # Drizzle schema, migrations bundle, connection
    │   ├── repositories/          # Drizzle repository implementations
    │   ├── mappers/               # Row → domain entity mappers
    │   ├── camera/                # ICameraAdapter, MobileCameraAdapter, MockCameraAdapter
    │   ├── files/                 # IFilePickerAdapter, IFileSystemAdapter and mobile impls
    │   ├── storage/               # LocalDocumentStorageEngine (react-native-fs wrapper)
    │   ├── ocr/                   # MobileOcrAdapter (ML Kit text recognition)
    │   ├── ai/                    # TfLiteReceiptNormalizer (template, falls back to deterministic)
    │   └── di/                    # DI container (container.ts, registerServices.ts)
    ├── components/                # 🟡 Reusable UI components
    │   ├── inputs/                # DatePickerInput, ContactSelector, TeamSelector
    │   ├── invoices/              # InvoiceForm, InvoiceUploadSection, ExtractionResultsPanel, …
    │   ├── quotations/            # QuotationForm
    │   ├── receipts/              # ReceiptForm
    │   └── tasks/                 # Task-related components
    ├── hooks/                     # React hooks — UI-to-application connectors
    ├── pages/                     # Screen-level components (one folder per feature)
    │   ├── dashboard/             # Dashboard with Quick Actions & financial stats
    │   ├── projects/              # ProjectsPage (list, create, archive)
    │   ├── invoices/              # Invoice list, detail, upload screens
    │   ├── payments/              # Payments screen
    │   ├── quotations/            # QuotationScreen
    │   ├── receipts/              # SnapReceiptScreen
    │   └── tasks/                 # TasksScreen
    ├── shims/                     # Browser/Node shims for Metro bundler compatibility
    ├── types/                     # Shared TypeScript type declarations
    └── utils/                     # Pure utility functions (no side-effects)
```

---

## Architecture Layers

### Dependency Rule

> Inner layers must never import from outer layers.

```
UI (components / pages / hooks)
       ↓ calls
Application (use cases)
       ↓ uses interfaces from
Domain (entities / repository interfaces / services)
       ↑ implemented by
Infrastructure (Drizzle repos, adapters, DI)
```

### 🔵 Domain Layer (`src/domain/`)

Pure TypeScript — no React, no Drizzle, no I/O of any kind.

**Entities** (`src/domain/entities/`) — immutable factory pattern via `.create()`:

| Entity | Enforced Invariants |
|---|---|
| `Project` | Status transitions via `ProjectWorkflowService`, budget ≥ 0 |
| `Invoice` | `total` ≥ 0, line-item sum = total, `dateDue` ≥ `dateIssued` |
| `Payment` | Linked to invoice, amount > 0 |
| `Quotation` | `expiryDate` ≥ `date`, total ≥ 0, line items sum to total |
| `Contact` | Has a `RoleType` (owner, contractor, vendor, …) |
| `Property` | Project site address |
| `Document` | File metadata, OCR text, cloud-sync status |
| `Expense` | Receipt capture, optional AI-validated fields |
| Others | `Milestone`, `Task`, `Inspection`, `ChangeOrder`, `WorkVariation`, `Quote` |

**Repository interfaces** (`src/domain/repositories/`) — declare CRUD and domain-specific query methods; zero implementation code.

**Domain services** (`src/domain/services/`) — stateless business rules that span multiple entities (e.g. `ProjectWorkflowService` enforces the allowed status-transition graph).

### 🟢 Application Layer (`src/application/`)

Thin orchestration — no database access, no UI.

**Use Cases** (`src/application/usecases/<domain>/`) — receive repository interfaces via constructor injection, validate input via entity factories, coordinate persistence:

| Domain | Use Cases |
|---|---|
| project/ | `CreateProjectUseCase`, `ArchiveProjectUseCase`, `UnarchiveProjectUseCase`, `UpdateProjectStatusUseCase`, `GetProjectDetailsUseCase`, `GetProjectAnalysisUseCase`, `BulkUpdateProjectsUseCase`, `MergeProjectsUseCase` |
| invoice/ | `CreateInvoiceUseCase`, `GetInvoiceByIdUseCase`, `ListInvoicesUseCase`, `UpdateInvoiceUseCase`, `DeleteInvoiceUseCase`, `MarkInvoiceAsPaidUseCase`, `CancelInvoiceUseCase`, `ProcessInvoiceUploadUseCase` |
| payment/ | `RecordPaymentUseCase`, `ListPaymentsUseCase` |
| quotation/ | `CreateQuotationUseCase`, `GetQuotationByIdUseCase`, `ListQuotationsUseCase`, `UpdateQuotationUseCase`, `DeleteQuotationUseCase` |
| receipt/ | `SnapReceiptUseCase` |
| task/ | `CreateTaskUseCase`, `CreateTaskFromPhotoUseCase`, `UpdateTaskUseCase`, `DeleteTaskUseCase`, `GetTaskUseCase`, `ListTasksUseCase` |

**Normalizers / AI** (`src/application/receipt/`, `src/application/ai/`) — rules-based field extraction for receipt and invoice OCR; `IReceiptNormalizer` and `IInvoiceNormalizer` are the interfaces; `DeterministicReceiptNormalizer` / `InvoiceNormalizer` are the live implementations.

**DTOs** (`src/application/dtos/`) — UI-only data shapes (e.g. `ProjectCardDto`). Never used in domain or infrastructure.

### 🔴 Infrastructure Layer (`src/infrastructure/`)

All I/O and platform concerns live here. Implements domain interfaces; nothing in domain/ or application/ should import from here.

**Database** (`src/infrastructure/database/`):
- `schema.ts` — Drizzle table definitions (single source of truth for DB shape)
- `migrations.ts` — bundled SQL migration strings, applied automatically on app start
- `connection.ts` — initialises and returns the Drizzle database instance

**Repositories** (`src/infrastructure/repositories/`):
- `DrizzleProjectRepository`, `DrizzleInvoiceRepository`, `DrizzlePaymentRepository`, `DrizzleQuotationRepository`, `DrizzleDocumentRepository`, `DrizzleReceiptRepository`, `DrizzleTaskRepository`
- `InMemoryProjectRepository` — in-process stub used in unit tests (not production)
- Mappers live in `src/infrastructure/mappers/` (e.g. `ProjectMapper` assembles hydrated `ProjectDetails` from JOIN rows)

**Adapters** — all platform-specific modules are behind interfaces:
- Camera: `ICameraAdapter` → `MobileCameraAdapter` (wraps `react-native-image-picker`); swap with `MockCameraAdapter` in tests
- File Pick: `IFilePickerAdapter` → `MobileFilePickerAdapter`
- File System: `IFileSystemAdapter` → `MobileFileSystemAdapter` (wraps `react-native-fs`)
- OCR: `MobileOcrAdapter` (wraps ML Kit text recognition)
- PDF Conversion: `IPdfConverter` → `MobilePdfConverter` (wraps `rn-pdf-renderer`)
- Voice/Audio: `IAudioRecorder` → `MobileAudioRecorder` (wraps `react-native-nitro-sound`), `IVoiceParsingService` → `RemoteVoiceParsingService` (Groq STT + LLM)

**DI Container** (`src/infrastructure/di/`):
- Lightweight key-based registry (`container.ts`): `registerInstance`, `registerFactory`, `resolve`, `clearContainer`
- `registerServices.ts` wires production bindings on app start
- In tests: call `clearContainer()` in `beforeEach` to reset state

### 🟡 UI Layer (`src/components/`, `src/pages/`, `src/hooks/`)

**Hooks** (`src/hooks/`) — instantiate use cases with Drizzle repositories and expose plain async functions + loading/error state. No business logic here.

| Hook | Responsibility |
|---|---|
| `useProjects` | Project CRUD + list |
| `useInvoices` | Invoice CRUD + lifecycle |
| `usePayments` | Payment recording + list |
| `useQuotations` | Quotation CRUD |
| `useSnapReceipt` | Camera → OCR → ReceiptForm flow |
| `useTasks` | Task CRUD |
| `useCameraTask` | Camera → Task creation flow |
| `useVoiceTask` | Voice recording → STT → Task draft flow |
| `useContacts` / `useTeams` | Selector data (in-memory stubs; Drizzle-backed repos pending) |

**Components** (`src/components/`) — purely presentational; receive data and callbacks via props. All styling via NativeWind Tailwind classes (avoid inline `style` props).

**Pages** (`src/pages/`) — screen-level components composed from hooks and components; handle navigation and modal state.

---

## Data Flow (End to End)

```
Page / Component
     │  user action
     ▼
React Hook (useXxx)
     │  calls useCase.execute(input)
     ▼
Use Case
     │  validates via Entity.create()
     │  calls repo interface method
     ▼
Domain Repository Interface
     │  implemented by
     ▼
DrizzleXxxRepository
     │  SQL via Drizzle ORM
     ▼
SQLite (on-device)
```

---

## Running the Project

### Prerequisites
- **Node.js ≥ 20**
- macOS with Xcode for iOS development
- Android Studio / JDK for Android development

### Install

```bash
npm install

# iOS only — install native pods
cd ios && pod install && cd ..
```

### Start & Run

```bash
npm start            # Start Metro bundler (keep running in one terminal)

npm run ios          # Launch on iOS simulator (separate terminal)
npm run android      # Launch on Android emulator (separate terminal)
```

### Type Check & Lint

```bash
npx tsc --noEmit     # Must pass before every commit
npm run lint         # ESLint — target 0 errors (warnings acceptable)
```

---

## Testing

### Test Layout

```
__tests__/
├── unit/            # Fast, isolated — no I/O
│   ├── *Entity.validation.test.ts    # Domain entity business rules
│   ├── *UseCase.test.ts              # Use cases with jest.fn() repo mocks
│   ├── *.test.tsx                    # React component/hook tests (react-test-renderer)
│   └── ...
└── integration/     # Slower — real Drizzle queries against in-memory SQLite
    ├── Drizzle*.integration.test.ts  # Repository CRUD + constraint tests
    ├── *.integration.test.tsx        # Full screen interaction tests
    └── ...
```

### How Integration Tests Work

Integration tests import `better-sqlite3` as an in-memory engine via the `__mocks__/react-native-sqlite-storage.js` Jest manual mock. The Drizzle schema and migration bundle are applied to this in-memory DB, so tests run fast and without a simulator.

### Run Tests

```bash
npm test                      # All suites
npm test -- --watch           # Watch mode
npm test -- --runInBand       # Serial (useful when debugging DB state)
npm test -- path/to/test.ts   # Single file
```

### Gotcha — Manual Mocks

Module mocks live in `__mocks__/` at the project root. Jest resolves them automatically for modules like `react-native-sqlite-storage`, `react-native-fs`, `react-native-image-picker`, and `nativewind`. If you add a new native module, add a corresponding mock here.

---

## Database Migrations

### Workflow

```bash
# 1. Edit the Drizzle schema
vim src/infrastructure/database/schema.ts

# 2. Generate the SQL migration file
npm run db:generate
# → writes drizzle/migrations/<timestamp>_<name>.sql

# 3. Bundle the migration into the app
#    Copy the SQL into migrations.ts and add to the migrations array
vim src/infrastructure/database/migrations.ts

# 4. Restart the app — migrations are applied automatically on startup
npm start
```

> ⚠️ **Gotcha**: `npm run db:generate` only creates the SQL file. You must manually copy the SQL into `migrations.ts`. The app will not pick up a new migration file from `drizzle/migrations/` at runtime — only the bundled strings in `migrations.ts` are executed. See [DRIZZLE_SETUP.md](DRIZZLE_SETUP.md) and [docs/DATABASE_MIGRATIONS.md](docs/DATABASE_MIGRATIONS.md) for the exact bundling steps.

### Development helpers

```bash
npm run db:push     # Directly push schema to a dev DB (skip migration file — dev only)
npm run db:studio   # Open Drizzle Studio (visual DB browser)
npm run db:check    # Validate migration consistency
```

---

## Adding a New Feature (Where Things Go)

| What you're adding | Where it lives |
|---|---|
| New business rule | `src/domain/entities/<Entity>.ts` |
| New status transition rule | `src/domain/services/ProjectWorkflowService.ts` (or new domain service) |
| New data access contract | `src/domain/repositories/<Entity>Repository.ts` |
| New DB table / column | `src/infrastructure/database/schema.ts` → generate migration → bundle |
| New repository impl | `src/infrastructure/repositories/Drizzle<Entity>Repository.ts` |
| New use case | `src/application/usecases/<domain>/<Name>UseCase.ts` |
| New UI form / component | `src/components/<domain>/` |
| New screen | `src/pages/<domain>/` + wire into navigator in `src/pages/tabs/` |
| New hook | `src/hooks/use<Feature>.ts` |
| New native adapter | Interface in `src/infrastructure/<concern>/I<Name>Adapter.ts`, mobile impl alongside, mock impl for tests |

---

## Key Gotchas & Conventions

- **No raw SQL in application or domain code.** Use Drizzle ORM in `src/infrastructure/` only. For ad-hoc queries, add a helper to `src/infrastructure/database/`.
- **No business logic in hooks or components.** Hooks call use cases; use cases call domain entities. If a rule is spreading across multiple files outside domain/, move it back.
- **Entity factories throw on invalid input.** Wrap `Entity.create()` calls in try/catch at the use case boundary; don't swallow errors silently.
- **`clearContainer()` in tests.** Always call `clearContainer()` in `beforeEach` when your test registers DI bindings, otherwise state leaks between test files.
- **NativeWind class names only.** Avoid inline `style={{}}` props in components — ESLint rule `react-native/no-inline-styles` will flag them.
- **Migrations are additive.** Never edit an already-committed SQL migration. Add a new migration for corrections.
- **`externalId` / `externalReference` on Invoice** — nullable, treated as a composite unique key only when *both* are non-null. This is normalised at the repository layer, not in the entity.
- **`project_id` on payments is nullable** — a payment may exist without a linked project (e.g. direct expenses captured via Snap Receipt).
- **TfLiteReceiptNormalizer is a placeholder** — it falls back to `DeterministicReceiptNormalizer` until a trained `.tflite` model is wired in.

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