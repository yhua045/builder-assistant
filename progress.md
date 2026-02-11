# Project Progress
Last Updated: 2026-02-12
Current Milestone: Implement Invoice aggregate (repository, use cases, payments)
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
- tax?: number
- currency: string
- status: 'draft' | 'issued' | 'paid' | 'overdue' | 'cancelled'
- paymentStatus: 'unpaid' | 'partial' | 'paid' | 'failed'
- dateIssued?: string
- dateDue?: string
- paymentDate?: string
- lineItems?: InvoiceLineItem[]
- createdAt: string
- updatedAt: string

### Payment
- id: string
- projectId: string
- invoiceId?: string
- amount: number
- currency?: string
- date?: string
- method?: 'bank' | 'cash' | 'check' | 'other'
- reference?: string
- notes?: string
- createdAt?: string
- updatedAt?: string

---

## 5. App Structure Overview (Current)

Feature Modules:
- Projects
- Invoices (new)
- Payments (new)

Shared Modules:
- Infrastructure (Drizzle DB, migrations)
- Domain (entities, repositories)
- Application (use cases)
- Components, Hooks, Utils

---

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
- Tests demonstrate behavior and served as TDD acceptance criteria; see `__tests__/unit` and `__tests__/integration`

---

## Testing

- Run unit tests:
```bash
npx jest __tests__/unit --runInBand
```
- Run integration tests (they use an in-memory SQLite shim):
```bash
npx jest __tests__/integration --runInBand
```

---

## Next Steps

- Review `DrizzleInvoiceRepository` and `DrizzlePaymentRepository` for performance/SQL tuning
- Add UI screens for Invoice list/detail and payment entry, wiring to use cases via hooks
- Add audit fields and domain events if required by downstream systems
- If desired, replace the no-op migration with explicit schema changes and new migration tests
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






