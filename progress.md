# Project Progress
Last Updated: 2026-02-16
Current Milestone: Implement Quotation module CRUD (domain, repository, use cases)
---


## 2. Confirmed Architectural Decisions (Non-Negotiable)

- Use Clean Architecture (UI → Hooks → Use Cases → Domain → Infrastructure)
- Persistence via Drizzle ORM over SQLite (react-native-sqlite-storage)
- Repositories: domain interfaces in `src/domain/repositories`, Drizzle implementations in `src/infrastructure/repositories`
- Business logic and invariants live in domain entities/use-cases; no business logic in UI
- Tests: fast unit tests with mocks; integration tests use an in-memory SQLite shim

---

## 3. Core Domain Model Snapshot (Source of Truth)

### Invoice
- id: string
- projectId?: string
- externalId?: string | null
- externalReference?: string | null
- total: number
- subtotal?: number

Date: 2026-02-06

Summary (concise)
- Architecture: On-device ML Kit OCR + TensorFlow Lite validation for receipt → draft expense flow (#9).
- Domain model: normalized `contacts` (with `RoleType`), `properties`, `projects`, and `work_variations` added.
- Database: See [DATABASE_MIGRATIONS.md](docs/DATABASE_MIGRATIONS.md) for migration details.
- **NEW:** Centralized workflow validator for project status transitions (#26) - implemented with TDD approach.

Completed
- Created `design/#9-Plan.md` and updated it to reflect ML Kit + TF Lite decisions.
- Opened and updated GitHub issue #10 (domain model: `projects`, `properties`, `contacts`, `work_variations`).
- Implemented TypeScript domain entities and repository interfaces under `src/domain/{entities,repositories}` for core models.
- UI: refactored dashboard and pages to use NativeWind/Tailwind; extracted reusable components for `QuickStats`, `ProjectsList`, `TasksList`, `TotalExpenseCard`, and `NextPaymentAlert`.
- **NEW (#26):** Implemented `ProjectWorkflowService` with centralized status transition validation
  - Created interface and implementation with explicit transition map
  - Integrated into `ProjectValidationService` for domain-level validation
  - Implemented `UpdateProjectStatusUseCase` demonstrating workflow validation in use cases
  - Added comprehensive test coverage (53 tests) following TDD approach
  - Documented workflow rules in `docs/WORKFLOWS.md`

## Native dependency notes

- The SQLite implementation uses a native module (`react-native-sqlite-storage`): after adding/updating native deps run:

```bash
cd ios && pod install && cd ..
npx react-native run-ios
# or for Android
npx react-native run-android
```


Branch: issue-27-drizzle-document-repo

Recent changes in this branch:
- Implemented `LocalDocumentStorageEngine` to store files on-device using `react-native-fs` when available, with a Node `fs` wrapper fallback and an injectable `FSLike` interface to allow unit testing and mocking.
- Made `LocalDocumentStorageEngine` handle binary and string inputs, return file `path` and `size`, and avoid bundler/runtime issues by using safe runtime checks and `buffer` where needed.
- Refactored code to avoid hard Node-only references (use `globalThis` and `buffer` import) so TypeScript checks pass without forcing Node runtime types into the RN bundles.
- Fixed TypeScript and linting issues across the codebase: corrected relative imports for use-cases, updated `useProjects` to call `list()` (returns `{ items, meta }`) instead of a removed `findAll()` helper, and adjusted `CreateProjectUseCase` accordingly.
- Updated `DrizzleProjectRepository` to conform to the `ProjectRepository` interface (return `meta` from `list`, adjusted `withTransaction` signature and transactional behavior, guarded undefined dates), and fixed several related compile errors.
- Ran lint and `npx tsc --noEmit`; resolved compiler errors so the branch type-checks cleanly.


Date: 2026-02-11

Branch: issue-31-invoice-repository

Critical changes (concise):

Date: 2026-02-11 (additional)

Updates:
- Implemented conditional uniqueness for invoices: `externalId` and `externalReference` are nullable and treated as a composite unique key only when both are present.
- Made `externalId`/`externalReference` optional in the `Invoice` entity and normalized empty/blank values to `NULL` at persistence layer.
- Added TDD coverage: integration tests verifying missing/empty external keys do not trigger uniqueness, while full keys still do.
- Added migration `drizzle/migrations/0003_optional_invoice_external_keys.sql` and aligned bundled migrations so tests run reliably.
- Adjusted `DrizzleInvoiceRepository` to normalize external keys and serialize/parse JSON fields explicitly.
- Ran full test suite: all unit + integration tests pass locally (13 suites, 80 tests).

Date: 2026-02-11

Branch: issue-32-projects-page-wt

Summary (concise)
- Implemented Projects page (`src/pages/projects/ProjectsPage.tsx`) and updated `ProjectCard` to expose archive/unarchive/favorite/status actions.
- Added unit and integration tests for `useProjects` hook and wired the UI to application use-cases (`ArchiveProjectUseCase`, `UnarchiveProjectUseCase`, `UpdateProjectStatusUseCase`).
- Updated `CLAUDE.md` and added `design/#32-create-project-page.md` documenting the design and TDD approach for this ticket.

Completed
- Added `ProjectsPage` and wired it into the tabs navigation (replaced Profile tab with Projects).
- Extended `ProjectCard` with action callbacks and fixed related TypeScript errors.
- Added unit + integration tests for `useProjects` (react-test-renderer harness) and fixed test typings.
- Fixed `DrizzleProjectRepository` transaction typing and other TypeScript issues discovered during tsc/lint runs.
- Ran `npx tsc --noEmit` (passes) and `npm run lint` (26 warnings, 0 errors) locally.
- Ran full test suite: all tests pass (16 suites, 85 tests).

Next
- Resolve remaining ESLint warnings incrementally (mostly inline-style warnings across RN components).
- Add integration tests for archive/unarchive/status flows and implement favorites navigation polish.

PR: https://github.com/yhua045/builder-assistant/pull/36 (branch `issue-32-projects-page-wt`)
 
Date: 2026-02-12

Branch: issue-38

Summary (concise)
- Refactored `ProjectCard` to use a dedicated `ProjectCardDto` for UI-only fields (owner, address, contact, tasks).
- Updated `ProjectsPage` and `ProjectList` to map domain `Project` entities to `ProjectCardDto` for rendering.
- Removed unused imports, helpers and styles from `ProjectCard` and made the component leaner.
- Fixed Jest transform config to include nativewind and related native modules so unit tests run under the RN environment.
- Added a small `ManualProjectEntryButton` component and updated dashboard usage.

Completed
- Implemented `src/application/dtos/ProjectCardDto.ts` and refactored `src/components/ProjectCard.tsx` to use it.
- Updated `src/pages/projects/ProjectsPage.tsx` and `src/components/ProjectList.tsx` to pass DTOs to the card component.
- Fixed type errors, cleaned unused code, and ran the full test suite locally.
- Updated `jest.config.js` to transform nativewind and related native modules so tests parse correctly.

Test status
- All tests pass (17 suites, 87 tests).

---

Date: 2026-02-12

Branch: issue-39

Summary (concise)
- Implemented full Project creation form (`ManualProjectEntryForm`) accessible via `ManualProjectEntry` button following TDD workflow.
- Extended `CreateProjectUseCase` to accept all required fields from issue #39 (address, owner, team, visibility, priority, notes) with comprehensive validation (required fields, date range, owner+address uniqueness).
- Updated domain model to use `Project.propertyId` (address) and `Project.ownerId` (project owner), with additional metadata stored in `Project.meta`.

Design doc: [design/#39-add-project-form.md](design/#39-add-project-form.md)

Completed (following TDD workflow per CLAUDE.md)
3. **Implementation**: 
   - Implemented `src/components/ManualProjectEntryForm.tsx` with all fields (name*, address*, description, owner, team, dates, budget, priority, notes).
   - Added inline validation for required fields (name, address) and date range validation (end date > start date).
   - Created `src/components/ManualProjectEntry.tsx` container to wire button → form → `useProjects().createProject()`.
   - Extended `CreateProjectRequest` interface with new fields (address, projectOwner, team, visibility, priority, notes).
   - Updated `CreateProjectUseCase` to validate and map additional fields to `Project` entity (propertyId, ownerId, meta).
   - Implemented owner+address uniqueness validation (skipped if either is null).

Test status
- All tests pass (20 suites, 96 tests).
- Type check (`npx tsc --noEmit`) passes.

Next
- Wire the form into the app navigation (e.g., from Projects page or dashboard).
- Consider adding date picker components for better UX (currently text input).
- Add user/team selection dropdowns (currently free text).
- Open PR and link to issue #39.



Date: 2026-02-12

Branch: issue-41

Summary (concise)
- Domain refactor: added a read-model `ProjectDetails` (hydrated `owner: Contact` + optional `property: Property`) and split read/write responsibilities across the repository contract.
- Repository contract: added `findDetailsById` and `listDetails` to `src/domain/repositories/ProjectRepository.ts`.
- Infrastructure: added `src/infrastructure/mappers/ProjectMapper.ts`, extended `DrizzleProjectRepository` and `InMemoryProjectRepository` to return hydrated `ProjectDetails`.
- Tests & TDD: added `__tests__/unit/GetProjectDetailsUseCase.test.ts` and integration coverage under `__tests__/integration/DrizzleProjectRepository.integration.test.ts` following TDD; updated component tests to avoid async `act()` warnings.

Completed
- Implemented `ProjectDetails` domain type and use-case `GetProjectDetailsUseCase` (`src/application/usecases/project/GetProjectDetailsUseCase.ts`).
- Updated repository interface to include read/hydrated methods and implemented them in both Drizzle and in-memory adapters.
- Added `ProjectMapper` to map prefixed SQL rows into `Contact` and `Property` domain objects.


Date: 2026-02-12

Branch: issue-43

Summary (concise)
 - Finish Manual Project Entry: wired manual entry into navigation, improved form inputs (date picker stub + contact/team selectors), implemented TDD tests for new inputs and integration wiring.

Current Milestone: Finish Manual Project Entry UX controls and navigation wiring

Completed
 - Created design doc: [design/#43-finish-manual-project-entry.md](design/#43-finish-manual-project-entry.md)
 - Implemented `src/components/inputs/DatePickerInput.tsx` (minimal cross-platform stub)
 - Implemented `src/components/inputs/ContactSelector.tsx` and `src/components/inputs/TeamSelector.tsx` with debounced search UI
 - Added lightweight hooks `src/hooks/useContacts.ts` and `src/hooks/useTeams.ts` (in-memory test stubs)
 - Updated `src/components/ManualProjectEntryForm.tsx` to use the new inputs and date objects
 - Added `src/components/ManualProjectEntry.tsx` container (button + form) and wired it into the Projects page and Dashboard hero (`src/pages/projects/ProjectsPage.tsx`, `src/pages/dashboard/components/HeroSection.tsx`)
 - Added unit tests for new inputs and updated form tests: `__tests__/unit/{DatePickerInput,ContactSelector,TeamSelector,ManualProjectEntryForm}.test.tsx`
 - Ensured full test run passes locally and TypeScript checks succeed

Test status
 - All tests pass locally: 24 suites, 101 tests (unit + integration) — `npx jest --runInBand` and `npx tsc --noEmit` both succeed on this branch.

Files changed (high level)
 - Added: `src/components/inputs/DatePickerInput.tsx`, `src/components/inputs/ContactSelector.tsx`, `src/components/inputs/TeamSelector.tsx`
 - Added: `src/hooks/useContacts.ts`, `src/hooks/useTeams.ts`
 - Added/Updated tests: `__tests__/unit/*` for selectors and date input
 - Modified: `src/components/ManualProjectEntryForm.tsx`, `src/components/ManualProjectEntry.tsx`, `src/pages/projects/ProjectsPage.tsx`, `src/pages/dashboard/components/HeroSection.tsx`

Next
 - Replace `DatePickerInput` stub with native-picker integration (`@react-native-community/datetimepicker`) and add platform-specific behavior
 - Replace in-memory hooks with Drizzle-backed repositories (`DrizzleContactRepository` / `DrizzleTeamRepository`) and add integration tests (requires schema verification/migration)
 - Add accessibility attributes and polish selector UI (ARIA/labels, keyboard navigation)
 - Open PR and request review; link this design doc and acceptance criteria

PR: will open from `issue-43` → `master` with this progress summary and link to the design doc.

````


---

Date: 2026-02-12

Branch: issue-48

Summary of work completed (this session):
- Implemented Snap Receipt quick action: `SnapReceiptUseCase`, `ReceiptForm`, `SnapReceiptScreen`, and `useSnapReceipt` hook.
- Updated `Payment` entity and DB schema to allow `card` method and nullable `project_id` (migration added).
- Fixed multiple test and lint issues: removed conditional hooks, stabilized selector tests, avoided timer leaks in tests, and updated one snapshot.
- Validation: ran `npx tsc --noEmit` (passes), `npm run lint` (0 errors, 32 warnings), and full `npm test` (all tests green).

Files touched (high level):
- `src/application/usecases/receipt/SnapReceiptUseCase.ts`
- `src/components/receipts/ReceiptForm.tsx`, `src/pages/receipts/SnapReceiptScreen.tsx`
- `src/hooks/useSnapReceipt.ts`
- `src/components/inputs/ContactSelector.tsx`, `TeamSelector.tsx`
- `src/components/ManualProjectEntryForm.tsx`
- `drizzle/migrations/0004_motionless_harpoon.sql`
- `progress.md` (this file)

Next steps:
- Open PR from `issue-48` → `master` referencing #48 and this progress summary.
- Address remaining ESLint warnings (inline-style rules) before final review.




## Summary of Changes (Issue #48: Snap Receipt)

- **Feature**: Implemented "Snap Receipt" quick action to capture expenses instantly.
- **Domain**: Updated `Payment` entity to allow `card` method and optional `projectId`.
- **Infrastructure**: Updated `payments` schema/migration to allow nullable `project_id`.
- **Application**: Added `SnapReceiptUseCase` to handle atomic creation of Invoice (paid) and Payment.
- **UI**: 
    - Added `ReceiptForm` component with validation and NativeWind styling.
    - Added `SnapReceiptScreen` (as Modal content).
    - Added "Snap Receipt" entry point in Dashboard (HeroSection and QuickActions).
- **Tests**: Added unit tests for `SnapReceiptUseCase`.
- **Hooks**: Added `useSnapReceipt` hook for integration.


---

Date: 2026-02-12

Branch: issue-48

Summary of work completed (this session):
- Implemented Snap Receipt quick action: `SnapReceiptUseCase`, `ReceiptForm`, `SnapReceiptScreen`, and `useSnapReceipt` hook.
- Updated `Payment` entity and DB schema to allow `card` method and nullable `project_id` (migration added).
- Fixed multiple test and lint issues: removed conditional hooks, stabilized selector tests, avoided timer leaks in tests, and updated one snapshot.
- Validation: ran `npx tsc --noEmit` (passes), `npm run lint` (0 errors, 32 warnings), and full `npm test` (all tests green).

Files touched (high level):
- `src/application/usecases/receipt/SnapReceiptUseCase.ts`
- `src/components/receipts/ReceiptForm.tsx`, `src/pages/receipts/SnapReceiptScreen.tsx`
- `src/hooks/useSnapReceipt.ts`
- `src/components/inputs/ContactSelector.tsx`, `TeamSelector.tsx`
- `src/components/ManualProjectEntryForm.tsx`
- `drizzle/migrations/0004_motionless_harpoon.sql`
- `progress.md` (this file)

Next steps:
- Open PR from `issue-48` → `master` referencing #48 and this progress summary.
- Address remaining ESLint warnings (inline-style rules) before final review.



## Summary of Changes (Issue #48: Snap Receipt)

- **Feature**: Implemented "Snap Receipt" quick action to capture expenses instantly.
- **Domain**: Updated `Payment` entity to allow `card` method and optional `projectId`.
- **Infrastructure**: Updated `payments` schema/migration to allow nullable `project_id`.
- **Application**: Added `SnapReceiptUseCase` to handle atomic creation of Invoice (paid) and Payment.
- **UI**: 
    - Added `ReceiptForm` component with validation and NativeWind styling.
    - Added `SnapReceiptScreen` (as Modal content).
    - Added "Snap Receipt" entry point in Dashboard (HeroSection and QuickActions).
- **Tests**: Added unit tests for `SnapReceiptUseCase`.
- **Hooks**: Added `useSnapReceipt` hook for integration.

`````

---

Date: 2026-02-13

Branch: issue-54

Summary (concise)
- Implemented Snap Receipt OCR pipeline improvements and deterministic normalizer (Issue #54).
- Verified full test suite, TypeScript typecheck, and fixed lint errors.

Completed This Session
- Implemented/updated code:
  - `src/application/receipt/DeterministicReceiptNormalizer.ts` (production rules-based normalizer)
  - `src/infrastructure/ai/TfLiteReceiptNormalizer.ts` (TFLite template + docs)
  - `src/application/receipt/NoOpReceiptNormalizer.ts` (unused param cleanup)
  - `src/pages/receipts/SnapReceiptScreen.tsx` (effect deps and processing flow cleanup)
  - `src/pages/dashboard/components/HeroSection.tsx` (remove unused import)
  - `docs/RECEIPT_NORMALIZERS.md` (new documentation for normalizer selection)

Notes
- The `TfLiteReceiptNormalizer` is a template that falls back to the deterministic normalizer until a trained `.tflite` model and bindings are available.
- Confidence scoring, suggestions, and feature-flag hooks are integrated and covered by unit tests.

Next Steps
- Prepare PR from `issue-54` → `master` with this progress summary and link to `design/#54-snap-receipt-ocr-ai-plan.md`.
- Add camera integration and test fixtures (sample receipt images) for end-to-end integration tests.
- (Optional) Begin TFLite model training and wiring when dataset and mobile bindings are ready.

References
- Design doc: `design/#54-snap-receipt-ocr-ai-plan.md`
- Normalizer docs: `docs/RECEIPT_NORMALIZERS.md`

## Summary of Changes (Issue #44)

- Added domain validation rules to `InvoiceEntity.create`:
  - Non-negative `total`
  - Line-item sum must match `subtotal` or `total` (tolerance applied)
  - `dateDue` must be >= `dateIssued`

- Introduced repository interfaces and implementations:
  - Confirmed `InvoiceRepository` interface at `src/domain/repositories/InvoiceRepository.ts`
  - `DrizzleInvoiceRepository` at `src/infrastructure/repositories/DrizzleInvoiceRepository.ts` (uses `initDatabase()` and `invoices` schema)
  - `DrizzlePaymentRepository` at `src/infrastructure/repositories/DrizzlePaymentRepository.ts`

- Implemented core use cases in `src/application/usecases/invoice/`:
  - `CreateInvoiceUseCase`, `GetInvoiceByIdUseCase`, `ListInvoicesUseCase`, `UpdateInvoiceUseCase`, `DeleteInvoiceUseCase`

- Implemented payment use case:
  - `RecordPaymentUseCase` updates `Payment` and recalculates invoice `paymentStatus` (and marks invoice as `paid` when fully paid)

- Tests added (TDD style):
  - Unit tests for use cases: `__tests__/unit/*` (Create/Get/Update/List Invoice, RecordPayment)
  - Domain validation tests: `__tests__/unit/InvoiceEntity.validation.test.ts`
  - Integration tests for repositories and payment workflows: `__tests__/integration/InvoiceRepository.integration.test.ts`, `__tests__/integration/Payment.integration.test.ts` (use in-memory SQLite shim)

- Migration: added a documented no-op migration `drizzle/migrations/0004_invoice_module_noop.sql` (schema already compatible)

References:
- Design & plan: `design/#44-plan.md`
---

## Next Steps

- Review `DrizzleInvoiceRepository` and `DrizzlePaymentRepository` for performance/SQL tuning
- Add UI screens for Invoice list/detail and payment entry, wiring to use cases via hooks
- Add audit fields and domain events if required by downstream systems
- If desired, replace the no-op migration with explicit schema changes and new migration tests

---

Date: 2026-02-16

Branch: issue-63

**Issue #63 — Snap Receipt Camera Integration**

Key decisions:
- Add an `ICameraAdapter` abstraction and provide `MobileCameraAdapter` (wraps `react-native-image-picker`).
- Use dependency injection so production and test adapters are swappable; provide `MockCameraAdapter` for tests.
- Wire `SnapReceiptScreen` to open camera → pass image URI to `useSnapReceipt.processReceipt(uri)` → show `ReceiptForm`.
- Add iOS permission strings and a Jest manual mock for the native image picker; install picker with `--legacy-peer-deps` when necessary.

Completed:
- Implemented `ICameraAdapter`, `MobileCameraAdapter`, and `MockCameraAdapter`.
- Updated `SnapReceiptScreen` and hooked camera flow into `useSnapReceipt` and `ReceiptForm`.
- Added unit tests and a Jest mock for `react-native-image-picker`; unit tests for camera logic pass locally.
- Committed changes on branch `issue-63` (commit 7688e43).

Pending:
- Stabilize integration tests (adjust timeouts and mocks to match domain interfaces).
- Address remaining ESLint warnings (~29 `react-native/no-inline-styles`) across UI components.

