# Project Progress


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


Last Updated: 2026-02-17
Current Milestone: Invoice Module Phase 2 - File Upload & OCR (Issue #70)
---

## Latest Session Summary

**Date**: 2026-02-17  
**Branch**: issue-70  
**Scope**: Invoice Module Phase 2 - File Upload & OCR (Issue #70)

**Key Decisions**:
- Adapted existing Receipt OCR patterns for Invoice domain (IInvoiceNormalizer interface)
- Rules-based normalization approach (vendor cleanup, date selection, amount validation, currency detection)
- Confidence scoring with color-coded indicators (green/yellow/red) for user review
- Inline editing support for extracted fields before acceptance
- Minimum confidence threshold (30%) for Accept action

**Completed This Session** (Following TDD workflow):
- ✅ Created `IInvoiceNormalizer` interface and `InvoiceNormalizer` implementation
  - Vendor name cleanup (removes legal suffixes)
  - Smart date selection (prefers recent dates within valid range)
  - Total validation against line items
  - Tax validation (< total, < 30%)
  - Currency detection (USD, EUR, GBP, JPY, etc.)
  - Due date validation (must be >= invoice date)
- ✅ `InvoiceUploadSection` component (file picker, preview, upload progress)
  - PDF and image support (.pdf, .jpg, .png)
  - File size formatting
  - Error handling
- ✅ `ExtractionResultsPanel` component
  - Confidence indicators with color coding
  - Editable fields (vendor, invoice number, total)
  - Display fields (dates, subtotal, tax, currency)
  - Line items display
  - Suggested corrections panel
  - Accept & Save / Retry actions
- ✅ Unit tests: 37 tests passing (3 suites: InvoiceNormalizer, InvoiceUploadSection, ExtractionResultsPanel)
- ✅ All components follow Clean Architecture and existing patterns from CLAUDE.md

**Files Added**:
- `src/application/ai/IInvoiceNormalizer.ts` (interface)
- `src/application/ai/InvoiceNormalizer.ts` (implementation)
- `src/components/invoices/InvoiceUploadSection.tsx`
- `src/components/invoices/ExtractionResultsPanel.tsx`
- `__tests__/unit/InvoiceNormalizer.test.ts` (10 tests)
- `__tests__/unit/InvoiceUploadSection.test.tsx` (11 tests)
- `__tests__/unit/ExtractionResultsPanel.test.tsx` (16 tests)

**Pending** (Issue #70 remaining tasks):
- Integration tests for end-to-end upload → OCR → extract → save flow
- Document storage integration (link uploaded files to Document entity)
- OCR text extraction and metadata storage in Document.metadata
- Async extraction status tracking and retry mechanism
- Wire components into InvoiceForm (Phase 1 from Issue #67)

**Next Steps**:
- Create integration test for full upload workflow
- Implement Document storage adapter integration
- Wire upload/extraction flow into existing InvoiceForm
- Test complete flow: Upload → OCR → Extract → Review → Save

---

**Date**: 2026-02-17  
**Branch**: issue-65 (COMPLETED)  
**Scope**: Quotation Form UI & Dashboard Integration (Issue #65)

**Completed This Session**:
- ✅ Created design document ([design/issue-65-quotation-form-ui.md](design/issue-65-quotation-form-ui.md))
- ✅ Implemented `QuotationForm` component with full CRUD fields
  - Reference, vendor info, dates, line items, financials, status, notes
  - Validation using QuotationEntity business rules
  - Dynamic line items with auto-calculation
  - NativeWind styling matching ReceiptForm patterns
- ✅ Implemented `useQuotations` hook
  - Connects to all CRUD use cases
  - Loading/error state management
  - DrizzleQuotationRepository integration
- ✅ Created `QuotationScreen` modal wrapper
- ✅ Wired Dashboard "Add Quote" quick action to open QuotationForm
- ✅ Unit tests (8/8 passing): [__tests__/unit/QuotationForm.test.tsx](__tests__/unit/QuotationForm.test.tsx)
- ✅ Integration tests (2/2 passing): [__tests__/integration/QuotationScreen.integration.test.tsx](__tests__/integration/QuotationScreen.integration.test.tsx)

**Files Added/Modified**:
- `src/components/quotations/QuotationForm.tsx` (new)
- `src/hooks/useQuotations.ts` (new)
- `src/pages/quotations/QuotationScreen.tsx` (new)
- `src/pages/dashboard/index.tsx` (modified - added quotation modal)
- `__tests__/unit/QuotationForm.test.tsx` (new)
- `__tests__/unit/useQuotations.test.tsx` (new)
- `__tests__/integration/QuotationScreen.integration.test.tsx` (new)
- `design/issue-65-quotation-form-ui.md` (new)

**Deferred Items**:
- Voice input support - requires new dependency (`@react-native-voice/voice`) and platform permissions
  - Recommend creating follow-up ticket for voice enhancement
  - Core functionality (form, validation, dashboard integration) is complete

**Next Steps**:
- Test manual workflow: Dashboard → Add Quote → Fill form → Save
- Consider adding QuotationList component to display created quotations
- Add voice input in future iteration

---

**Date**: 2026-02-17  
**Branch**: issue-71  
**Scope**: Invoice Module Phase 3 — Lifecycle Operations (Issue #71)

**Key Decisions**:
- Use `Invoice.metadata.statusHistory` array for audit trail (lightweight, no separate table for MVP)
- Lifecycle transitions: only `issued`/`overdue` → `paid`; prevent cancelling `paid` invoices
- Payment integration: auto-update `paymentStatus` on payment records; transition to `paid` only for `issued`/`overdue` invoices (not `draft`)

**Completed This Session**:
- ✅ Implemented `MarkInvoiceAsPaidUseCase` with validation and audit trail
  - Validates allowed transitions (`issued`/`overdue` → `paid`)
  - Records timestamp, optional actor, and reason in `metadata.statusHistory`
  - Unit tests (10/10 passing)
- ✅ Implemented `CancelInvoiceUseCase` with cancellation rules
  - Prevents cancelling `paid` invoices (MVP business rule)
  - Stores cancellation reason and audit trail
  - Unit tests (12/12 passing)
- ✅ Implemented `InvoiceLifecycleActions` UI component
  - Context-aware buttons based on invoice status
  - Confirmation dialogs for destructive actions
  - Loading states with disabled buttons
  - Unit tests (12/12 passing)
- ✅ Enhanced payment integration
  - Updated `RecordPaymentUseCase` to only transition `issued`/`overdue` invoices to `paid` status
  - Auto-calculation of `paymentStatus` (`unpaid`/`partial`/`paid`)
  - Integration tests (10/10 passing)
- ✅ Audit trail implementation
  - Status change history with `{ from, to, timestamp, actor, reason }`
  - Preserves existing metadata, appends to history array
  - Fully tested in use case tests

**Files Added**:
- `src/application/usecases/invoice/MarkInvoiceAsPaidUseCase.ts`
- `src/application/usecases/invoice/CancelInvoiceUseCase.ts`
- `src/components/invoices/InvoiceLifecycleActions.tsx`
- `__tests__/unit/MarkInvoiceAsPaidUseCase.test.ts`
- `__tests__/unit/CancelInvoiceUseCase.test.ts`
- `__tests__/unit/InvoiceLifecycleActions.test.tsx`
- `__tests__/integration/InvoicePayment.integration.test.tsx`

**Files Modified**:
- `src/application/usecases/payment/RecordPaymentUseCase.ts` (enhanced payment status logic)
- `__tests__/integration/Payment.integration.test.ts` (updated test fixture)

**Test Status**:
- All tests passing: 44 tests (4 test suites)
- TypeScript check: ✅ passes (`npx tsc --noEmit`)
- TDD workflow followed: tests written before implementation for all features

**Pending Tasks**: None (all Phase 3 acceptance criteria met)

**Next Steps**:
- Open PR from `issue-71` → `master` with reference to design doc ([design/issue-67-invoice-module.md](design/issue-67-invoice-module.md) Phase 3)
- Consider adding `InvoiceDetailPage` to display audit trail timeline
- Wire lifecycle actions into invoice list/detail views when UI is implemented

---

**Date**: 2026-02-18  
**Branch**: issue-78  
**Scope**: InvoiceScreen Popup - Upload PDF or Manual Entry (Issue #78)

**Key Decisions**:
- **Cache-then-Save Pattern**: PDF metadata cached in memory; zero DB writes until user submits InvoiceForm (prevents ghost Document records)
- **Immediate File Copy**: Files copied to app private storage immediately after selection (survives original file deletion)
- **Dependency Injection**: File picker and file system adapters injectable via props for testability
- **Interface-Based Design**: Created abstractions (IFilePickerAdapter, IFileSystemAdapter) for platform independence
- **PDF Validation**: Type checking (application/pdf) and size limit (20MB) enforced at selection time
- **testID-Based Testing**: Used testID props for reliable test targeting (avoids NativeWind className issues)

**Completed This Session** (Following TDD workflow):
- ✅ Created abstraction layer interfaces:
  - `IFilePickerAdapter.ts` - Document picker interface
  - `IFileSystemAdapter.ts` - File system operations interface
  - `PdfFileMetadata.ts` - PDF metadata type definition
  - `fileValidation.ts` - PDF validation utility (type & size < 20MB)

- ✅ Implemented platform-specific adapters:
  - `MobileFilePickerAdapter.ts` - React Native document picker (uses `react-native-document-picker`)
  - `MobileFileSystemAdapter.ts` - File operations (uses `react-native-fs`)

- ✅ Built UI components:
  - `InvoiceScreen.tsx` - Main modal with two flows:
    1. Upload PDF → validate → copy to app storage → cache metadata → navigate to InvoiceForm
    2. Manual Entry → navigate to InvoiceForm without pdfFile
  - Updated `InvoiceForm.tsx` - Added `pdfFile?: PdfFileMetadata` prop with visual PDF indicator

**Test Status**:
- All tests passing: **11 tests** (9 unit + 2 integration)
- TypeScript check: ✅ passes (`npx tsc --noEmit`)
- Test suites: 2 passed

**Pending Tasks** (Issue #78 remaining work):
1. **Implement atomic Document+Invoice save flow**:
   - Wire up `CreateInvoiceUseCase` to handle Document creation
   - Implement atomic transaction: Create Document → Create Invoice with documentId
   - Uncomment and verify 4 deferred integration tests

2. **Navigation wiring**:
   - Add InvoiceScreen modal trigger to Dashboard (AFB "Add Invoice" button)
   - Wire InvoiceListPage to open InvoiceScreen

3. **Future enhancements** (optional):
   - Background cleanup job for orphaned PDF files (files in app storage not linked to Documents)
   - PDF preview/viewer within the app
   - Multi-file upload support

**Next Steps**:
- Review design doc ([design/issue-78-invoice-screen-plan.md](design/issue-78-invoice-screen-plan.md))
- Implement CreateInvoiceUseCase integration for atomic saves
- Wire InvoiceScreen into Dashboard navigation
- Open PR from `issue-78` → `master` with this progress summary

**References**:
- Design doc: `design/issue-78-invoice-screen-plan.md`
- Related: Issue #67 (Invoice Module Phase 1), Issue #70 (Invoice OCR)

---

Date: 2026-02-18
**Date**: 2026-02-18  
**Branch**: issue-81  
**Scope**: Consolidate Tasks list UI (Issue #81)

**Key Decisions**:
- Consolidate task list into a single authoritative screen: `src/pages/tasks/index.tsx`.
- Keep `useTasks()` hook as the canonical data source; wire filters, refresh and navigation there.
- Remove duplicate `TasksListPage.tsx` and update `TasksNavigator.tsx` to point at the consolidated screen.
- Follow TDD-first workflow: write tests first, implement minimal changes, refactor.

**Completed This Session**:
- ✅ Created design doc: `design/issue-81-tasks-consolidation.md` (approach & acceptance criteria).
- ✅ Added unit tests (TDD) for the consolidated Tasks screen (`__tests__/unit/TasksScreen.test.tsx`).
- ✅ Implemented consolidated screen: `src/pages/tasks/index.tsx` (filters, summary counts, pull-to-refresh, navigation handlers).
- ✅ Updated `src/pages/tasks/TasksNavigator.tsx` and deleted `src/pages/tasks/TasksListPage.tsx`.
- ✅ All tests pass locally and `npx tsc --noEmit` reports no type errors.

**Pending / Next Steps**:
- Open a PR from `issue-81` → `master` for code review.
- Manual smoke test on device/emulator to validate runtime navigation and pull-to-refresh UX.
- Optional: small UX polish (filter pill styles, accessibility attributes) before final review.

---
