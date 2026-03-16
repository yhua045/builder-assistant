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
    │   ├── entities/              # ~17 business entity interfaces + thin factory classes
    │   ├── repositories/          # ~16 repository interfaces (contracts only, no implementation)
    │   └── services/              # Domain services (e.g. ProjectWorkflowService, ProjectValidationService)
    ├── application/               # 🟢 Application Layer — use case orchestration
    │   ├── usecases/              # Grouped by domain (project/, invoice/, task/, payment/, …)
    │   ├── ai/                    # Normalizer interfaces & implementations (invoice OCR)
    │   ├── receipt/               # Receipt normalizer logic
    │   ├── dtos/                  # Data-transfer objects (e.g. ProjectCardDto)
    │   └── services/              # Application-layer port interfaces: IAudioRecorder,
    │                              #   IVoiceParsingService, ICameraService, ISuggestionService, …
    ├── infrastructure/            # 🔴 Infrastructure Layer — I/O implementations
    │   ├── database/              # Drizzle schema.ts (source of truth), migrations.ts (bundled SQL), connection.ts
    │   ├── repositories/          # ~11 DrizzleXxxRepository implementations (raw db.executeSql())
    │   ├── mappers/               # Row → domain entity mappers
    │   ├── camera/                # ICameraAdapter → MobileCameraAdapter / MockCameraAdapter
    │   ├── files/                 # IFilePickerAdapter, IFileSystemAdapter and mobile impls
    │   ├── storage/               # LocalDocumentStorageEngine (react-native-fs wrapper)
    │   ├── ocr/                   # MobileOcrAdapter (ML Kit text recognition)
    │   ├── ai/                    # StubSuggestionService (default) / TfLiteReceiptNormalizer
    │   ├── voice/                 # MobileAudioRecorder, GroqSTTAdapter, GroqTranscriptParser + mocks
    │   ├── location/              # DrizzleStoredLocationRepository, DeviceGpsService
    │   ├── demo/                  # seedDemoData, resetDemoData helpers
    │   └── di/                    # registerServices.ts (tsyringe), container.ts (legacy Map)
    ├── components/                # 🟡 Reusable/presentational UI components
    │   ├── inputs/                # DatePickerInput, ContactSelector, TeamSelector
    │   ├── invoices/              # InvoiceForm, InvoiceUploadSection, ExtractionResultsPanel, …
    │   ├── quotations/            # QuotationForm
    │   ├── receipts/              # ReceiptForm
    │   └── tasks/                 # ~17 task UI components (cards, sections, badges, forms)
    ├── hooks/                     # React hooks — UI-to-application connectors (~17 hooks)
    ├── config/
    │   └── featureFlags.ts        # Compile-time feature toggles (e.g. FEATURE_AI_SUGGESTIONS)
    ├── pages/                     # Screen-level components + navigator wiring
    │   ├── tabs/index.tsx         # Root BottomTabNavigator (Dashboard / Finances / Work / Projects)
    │   ├── dashboard/             # DashboardScreen — Quick Actions & financial stats
    │   ├── projects/              # ProjectsPage (list, create, archive)
    │   ├── invoices/              # Invoice list, detail, upload screens
    │   ├── payments/              # Payments screen
    │   ├── quotations/            # QuotationScreen
    │   ├── receipts/              # SnapReceiptScreen
    │   └── tasks/                 # TasksNavigator (NativeStack) + 5 task screens
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

**Entities** (`src/domain/entities/`) — factory pattern via `.create()`. The factory stamps `id`, `createdAt`, `updatedAt` and sets defaults; domain services (not entities) own complex invariant enforcement:

| Entity | Notes |
|---|---|
| `Project` | Status transitions owned by `ProjectWorkflowService` |
| `Invoice` | Line-item amounts, `dateDue` ≥ `dateIssued` |
| `Payment` | Linked to invoice, amount > 0 |
| `Quotation` | `expiryDate` ≥ `date`, total ≥ 0 |
| `Contact` | Has a `RoleType` (owner, contractor, vendor, …) |
| `Task` / `TaskEntity` | ID generation, timestamp stamping, `status` defaulting to `'pending'` |
| `Document` | File metadata, OCR text, cloud-sync status |
| `Expense` | Receipt capture, optional AI-validated fields |
| Others | `Property`, `Milestone`, `Inspection`, `ChangeOrder`, `WorkVariation`, `Quote` |

**`CockpitScorer`** (`src/application/usecases/task/CockpitScorer.ts`) — A set of **pure functions** (no DI, no side effects) for task prioritisation: `computePriorityWeight`, `computeDueDateUrgency`, `computeBlockers`, `computeFocus3`. These are the domain-level scoring rules for the task cockpit view, kept separate from the use-case class for independent testability.

**Repository interfaces** (`src/domain/repositories/`) — declare CRUD and domain-specific query methods; zero implementation code. Each interface is the contract between Application and Infrastructure.

**Domain services** (`src/domain/services/`) — stateless business rules spanning multiple entities (e.g. `ProjectWorkflowService` enforces the allowed status-transition graph, `ProjectValidationService` validates project creation inputs).

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
| task/ | `CreateTaskUseCase`, `UpdateTaskUseCase`, `DeleteTaskUseCase` (cascades deps → delay reasons → task), `GetTaskUseCase`, `ListTasksUseCase`, `GetTaskDetailUseCase` (parallel hydration: task + deps + delays + logs), `GetCockpitDataUseCase` (builds in-memory adjacency graph + calls `CockpitScorer`), `GetBlockerBarDataUseCase`, `AddTaskDependencyUseCase`, `RemoveTaskDependencyUseCase`, `AddDelayReasonUseCase` (validates against `DelayReasonTypeRepository`), `RemoveDelayReasonUseCase`, `ResolveDelayReasonUseCase`, `AddProgressLogUseCase`, `UpdateProgressLogUseCase`, `DeleteProgressLogUseCase`, `ParseVoiceTaskUseCase`, `CreateTaskFromPhotoUseCase`, `AcceptQuoteUseCase` (transitions `quoteStatus → accepted`, links invoice), `GetDelayStatisticsUseCase` |

**Application Service Ports** (`src/application/services/`) — interfaces (ports) for platform capabilities consumed by use cases:

| Port Interface | Description |
|---|---|
| `IAudioRecorder` | Start/stop audio recording |
| `IVoiceParsingService` | STT transcription + LLM task-draft extraction |
| `ICameraService` | Capture photo |
| `ISuggestionService` | AI-powered task suggestions |

These are implemented in Infrastructure and injected at runtime via tsyringe.

**Normalizers / AI** (`src/application/receipt/`, `src/application/ai/`) — rules-based field extraction for receipt and invoice OCR; `IReceiptNormalizer` and `IInvoiceNormalizer` are the interfaces; `DeterministicReceiptNormalizer` / `InvoiceNormalizer` are the live implementations.

**DTOs** (`src/application/dtos/`) — UI-only data shapes (e.g. `ProjectCardDto`). Never used in domain or infrastructure.

### 🔴 Infrastructure Layer (`src/infrastructure/`)

All I/O and platform concerns live here. Implements domain interfaces; nothing in domain/ or application/ should import from here.

**Database** (`src/infrastructure/database/`):
- `schema.ts` — Drizzle table definitions (single source of truth for DB shape and migration generation)
- `migrations.ts` — bundled SQL migration strings executed automatically on app start
- `connection.ts` — initialises and returns the SQLite DB instance via a Drizzle sqlite-proxy; exposes `db.executeSql()` used by all repositories

**Repositories** (`src/infrastructure/repositories/`):
- ~11 `DrizzleXxxRepository` classes implement their domain `XxxRepository` interface
- **Important:** Despite the "Drizzle" prefix, runtime queries use **raw SQL via `db.executeSql()`** — not the Drizzle query builder. Drizzle is used only for schema definition and migration file generation.
- `DrizzleTaskRepository` additionally manages `task_dependencies`, `task_delay_reasons`, `task_progress_logs` tables
- `InMemoryProjectRepository` — in-process stub used in unit tests (not production)
- Mappers in `src/infrastructure/mappers/` (e.g. `ProjectMapper`) assemble hydrated objects from JOIN rows

**Adapters** — all platform-specific modules are behind interfaces:
- Camera: `ICameraAdapter` → `MobileCameraAdapter` (wraps `react-native-image-picker`); swap with `MockCameraAdapter` in tests
- File Pick: `IFilePickerAdapter` → `MobileFilePickerAdapter`
- File System: `IFileSystemAdapter` → `MobileFileSystemAdapter` (wraps `react-native-fs`)
- OCR: `MobileOcrAdapter` (wraps ML Kit text recognition)
- PDF: `IPdfConverter` → `MobilePdfConverter` (wraps `rn-pdf-renderer`)
- Audio: `IAudioRecorder` → `MobileAudioRecorder` (wraps `react-native-nitro-sound`)
- Voice parsing: `IVoiceParsingService` → `RemoteVoiceParsingService` (Groq STT → `GroqTranscriptParser` LLM)
- AI suggestions: `ISuggestionService` → `StubSuggestionService` (default no-op until real LLM adapter is wired)
- Location: `DeviceGpsService`, `DrizzleStoredLocationRepository`

**DI Container** (`src/infrastructure/di/`):

There are **two DI systems**; only tsyringe is active for new code:

| System | File | Role |
|---|---|---|
| **tsyringe** (primary) | `registerServices.ts` | Registers all ~9 repositories + adapters as singletons on module import. Every hook file imports this as a side-effect. |
| Legacy Map registry | `container.ts` | Hand-rolled `Map`-based `registerInstance` / `registerFactory` / `resolve`. Vestigial — used for a `ProjectRepository` fallback only. Do not add new registrations here. |

Hook wiring pattern (tsyringe):
```ts
// Side-effect import triggers singleton registration
import '../infrastructure/di/registerServices';

// Resolve repository singleton from container
const repo = useMemo(() => container.resolve<TaskRepository>('TaskRepository'), []);

// Instantiate use case with injected repo (use cases are NOT registered in the container)
const createTask = useMemo(() => new CreateTaskUseCase(repo), [repo]);
```

### 🟡 UI Layer (`src/components/`, `src/pages/`, `src/hooks/`)

**Navigation** (`src/pages/tabs/`, `src/pages/tasks/`):

```
App.tsx → NavigationContainer
└── BottomTabNavigator (tabs/index.tsx)
    ├── "Dashboard"  → DashboardScreen
    ├── "Finances"   → PaymentsNavigator (NativeStack)
    ├── "Work"       → TasksNavigator (NativeStack)
    │     ├── TasksList    → TasksScreen      — list + cockpit view
    │     ├── TaskDetails  → TaskDetailsPage  — full detail (card presentation)
    │     ├── CreateTask   → CreateTaskPage   — new task + voice entry (modal)
    │     └── EditTask     → EditTaskPage     — edit existing task (modal)
    └── "Projects"   → ProjectsPage
```

All navigators use `headerShown: false`; headers are custom-built inside each screen.

**Hooks** (`src/hooks/`) — instantiate use cases with repository singletons from the DI container; expose plain async functions + `loading`/`error` state. Light UI-coordination logic is acceptable (e.g. deriving a field value before calling a use case), but no persistence or business rules.

| Hook | Responsibility |
|---|---|
| `useTasks(projectId?)` | Primary task hook — instantiates all 14 task use cases, exposes CRUD + dependency + delay reason + progress log mutations; calls `loadTasks()` after every mutation to re-sync local state |
| `useTaskForm` | Manages all task form field state; calls `CreateTaskUseCase` or `UpdateTaskUseCase` on submit; contains `computeQuoteStatus()` — auto-derives `quoteStatus` from `taskType` + `quoteAmount` before persisting |
| `useTaskDetail(task, project)` | Resolves `SuggestionService` from DI; fetches AI suggestions once per task ID (guarded by `FEATURE_AI_SUGGESTIONS`) |
| `useCockpitData(projectId)` | Calls `GetCockpitDataUseCase`; exposes `{ blockers, focus3 }` |
| `useBlockerBar(projects)` | Calls `GetBlockerBarDataUseCase` across all projects |
| `useProjects` | Project CRUD + list |
| `useInvoices` | Invoice CRUD + lifecycle |
| `usePayments` | Payment recording + list |
| `useQuotations` | Quotation CRUD |
| `useSnapReceipt` | Camera → OCR → ReceiptForm flow |
| `useContacts` / `useTeams` | Selector data |

**Components** (`src/components/`) — purely presentational; receive data and callbacks via props. All styling via NativeWind Tailwind classes (avoid inline `style` props).

**Pages** (`src/pages/`) — screen-level components composed from hooks and components; handle navigation and modal state.

> ⚠️ **Known inconsistency**: `TaskDetailsPage` resolves `DocumentRepository` and `InvoiceRepository` directly from the tsyringe container rather than through use cases (via `container.resolve<DocumentRepository>('DocumentRepository')` in `useMemo`). This bypasses the intended use-case layer boundary. New screens should not follow this pattern.

---

## Business Logic Distribution

| Layer | What lives here |
|---|---|
| **Domain entities** | ID generation, timestamp stamping, `status` defaulting for `TaskEntity`; `PREDEFINED_WORK_TYPES` list |
| **Domain scoring (`CockpitScorer`)** | `computePriorityWeight`, `computeDueDateUrgency` (0–100 score + label), `computeBlockers` (red/yellow/null severity), `computeFocus3` heuristic ranking |
| **Domain services** | Project status-transition graph (`ProjectWorkflowService`); project creation validation (`ProjectValidationService`) |
| **Use cases** | Delete cascade ordering (`DeleteTaskUseCase`); parallel detail hydration (`GetTaskDetailUseCase`); in-memory dependency graph construction + scorer invocation (`GetCockpitDataUseCase`); delay reason type validation (`AddDelayReasonUseCase`); quote state transition (`AcceptQuoteUseCase`) |
| **Hooks** | `computeQuoteStatus()` in `useTaskForm` — auto-derives `quoteStatus` from `taskType` + `quoteAmount` before persisting; fetch coordination and re-loading after mutations |
| **Repositories** | SQL query strategy, row↔entity mapping, Unix-ms ↔ ISO-string timestamp conversion, `INSERT OR IGNORE` for idempotent dependency edges |
| **UI components** | Presentation only — data and callbacks via props |

---

## Data Flow — Task Module (End to End)

### Create Task

```
CreateTaskPage.tsx
  └─ useTaskForm.submit()
       ├─ computeQuoteStatus()          ← derives quoteStatus from taskType + quoteAmount (hook layer)
       └─ CreateTaskUseCase.execute(data)
            ├─ TaskEntity.create(data)  ← stamps id, createdAt, updatedAt, defaults status='pending'
            └─ taskRepository.save(task)
                 └─ DrizzleTaskRepository.save()
                      ├─ ensureInitialized() → initDatabase() → SQLite.openDatabase() + runMigrations()
                      └─ db.executeSql('INSERT INTO tasks ...', [...params])
  └─ onSuccess() → navigation.goBack()
  └─ useTasks.loadTasks()  ← full re-fetch refreshes list state
```

### Task Detail

```
TaskDetailsPage.tsx  [receives taskId via route.params]
  └─ useTasks().getTaskDetail(taskId)
       └─ GetTaskDetailUseCase.execute(taskId)
            ├─ taskRepository.findById(taskId)
            └─ Promise.all([
                 taskRepository.findDependencies(taskId),   // JOIN task_dependencies
                 taskRepository.findDelayReasons(taskId),   // SELECT task_delay_reasons
                 taskRepository.findProgressLogs(taskId)    // SELECT task_progress_logs
               ])
            └─ returns TaskDetail = Task + { dependencyTasks, delayReasons, progressLogs }
  └─ Renders sub-components:
       TaskStatusBadge, StatusPriorityRow, TaskDocumentSection,
       TaskDependencySection, TaskSubcontractorSection,
       TaskDelaySection, TaskProgressSection, TaskQuotationSection
```

### Voice Task Entry

```
CreateTaskPage.tsx  [voice mode]
  └─ MobileAudioRecorder.start/stop()  ← IAudioRecorder (tsyringe)
  └─ ParseVoiceTaskUseCase.execute(audioUri)
       └─ IVoiceParsingService.parse(audioUri)
            ├─ GroqSTTAdapter  → audio → transcript text
            └─ GroqTranscriptParser → transcript → TaskDraft (pre-filled fields)
  └─ TaskDraft pre-fills TaskForm fields
  └─ User confirms → CreateTaskUseCase.execute(data)  [same path as above]
```

### Cockpit Scoring

```
TasksScreen  [cockpit tab]
  └─ useCockpitData(projectId)
       └─ GetCockpitDataUseCase.execute(projectId)
            ├─ taskRepository.findByProjectId(projectId)   // all tasks
            ├─ taskRepository.findAllDependencies(projectId) // all edges
            ├─ Builds in-memory adjacency maps (dependents, dependencies)
            └─ CockpitScorer.computeFocus3(tasks, deps)
                 ├─ computePriorityWeight(task)     // priority enum → 0–40 score
                 ├─ computeDueDateUrgency(task)     // days remaining → 0–100 score
                 └─ computeBlockers(tasks, deps)    // severity: 'red' | 'yellow' | null
       └─ returns { blockers: Task[], focus3: Task[] }
```

---



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
| New business rule / invariant | `src/domain/entities/<Entity>.ts` or a new domain service in `src/domain/services/` |
| New status transition rule | `src/domain/services/ProjectWorkflowService.ts` (or a new domain service) |
| New data access contract | `src/domain/repositories/<Entity>Repository.ts` |
| New DB table / column | `src/infrastructure/database/schema.ts` → `npm run db:generate` → bundle SQL into `migrations.ts` |
| New repository impl | `src/infrastructure/repositories/Drizzle<Entity>Repository.ts` — use `db.executeSql()` for queries |
| New platform adapter | Interface (port) in `src/application/services/I<Name>.ts`, mobile impl in `src/infrastructure/<concern>/`, mock impl in `__mocks__/` or `src/infrastructure/<concern>/Mock<Name>.ts` |
| New use case | `src/application/usecases/<domain>/<Name>UseCase.ts` |
| New UI form / component | `src/components/<domain>/` |
| New screen | `src/pages/<domain>/` + wire into navigator |
| New hook | `src/hooks/use<Feature>.ts` — import `registerServices` as side-effect, resolve repo from tsyringe, instantiate use cases in `useMemo` |
| New DI binding | Add singleton registration to `src/infrastructure/di/registerServices.ts` (tsyringe only) |

---

## Task Database Schema

**Table: `tasks`**

| Column | Type | Notes |
|---|---|---|
| `local_id` | INTEGER PK autoincrement | SQLite row ID |
| `id` | TEXT UNIQUE | App-level UUID (`task_<timestamp>_<random>`) |
| `project_id` | TEXT nullable | Soft FK to `projects.id`; NULL = ad-hoc task |
| `phase_id` | TEXT | Soft FK to `project_phases.id` |
| `title` | TEXT NOT NULL | |
| `description`, `notes` | TEXT | |
| `is_scheduled` | INTEGER | Boolean (0/1) |
| `scheduled_at`, `due_date` | INTEGER | Unix milliseconds |
| `subcontractor_id` | TEXT | Soft FK to `contacts.id` |
| `is_critical_path` | INTEGER | Boolean — manual pin for Focus-3 |
| `status` | TEXT | `pending\|in_progress\|completed\|blocked\|cancelled` |
| `priority` | TEXT | `low\|medium\|high\|urgent` |
| `completed_date` | INTEGER | Unix milliseconds |
| `photos` | TEXT | JSON array of URIs |
| `site_constraints` | TEXT | Free-text for AI context |
| `task_type` | TEXT | `standard\|variation\|contract_work` (default `variation`) |
| `work_type` | TEXT | Trade category string |
| `quote_amount` | REAL | AUD |
| `quote_status` | TEXT | `pending\|issued\|accepted\|rejected` |
| `quote_invoice_id` | TEXT | Soft FK to `invoices.id` |
| `created_at`, `updated_at` | INTEGER | Unix milliseconds |

**Indexes:** `idx_tasks_project` (project_id), `idx_tasks_scheduled` (scheduled_at), `idx_tasks_status` (status)

**Related tables:**

| Table | Purpose |
|---|---|
| `task_dependencies` | Join table: `task_id` + `depends_on_task_id` + `created_at`; unique index on the pair; inserted with `INSERT OR IGNORE` |
| `task_delay_reasons` | Per-task delay log: `reason_type_id` (FK to `delay_reason_types`), `delay_duration_days`, `resolved_at`, `mitigation_notes` |
| `delay_reason_types` | Lookup: `id`, `label`, `display_order`, `is_active` |
| `task_progress_logs` | Progress notes: `log_type`, `notes`, `date`, `photos` (JSON), `actor`, `reason_type_id`, `delay_duration_days`, `resolved_at` |
| `documents` | `task_id` soft FK — attached files |
| `invoices` | `task_id` soft FK — variation/contract tasks linked to invoices |

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