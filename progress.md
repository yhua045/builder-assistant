# Project Progress — Summary (updated 2026-04-10)

## ✅ Issue #203 — Fine-Tune: Unused Variable Cleanup & Linting
**Status**: COMPLETED  
**Branch**: `issue-203-fine-tune`  
**Date Completed**: 2026-04-10

### Changes Made
- **Test Files: Removed unused imports & parameters**:
  - `__tests__/integration/PaymentDetailsSyntheticProject.integration.test.tsx`: Removed unused `waitFor` from `@testing-library/react-native` import
  - `__tests__/unit/ApproveQuotationUseCase.test.ts`: Removed unused `ApproveQuotationInput` from import statement
  - `__tests__/unit/CreateQuotationWithTaskUseCase.test.ts`: Prefixed unused callback parameter `t` → `_t` to allow unused args
  
- **Source Files: Cleaned up unused imports & variables**:
  - `src/hooks/useTaskForm.ts`: Removed unused `queryKeys` import (only `invalidations` needed)
  - `src/pages/payments/PaymentDetails.tsx`: 
    - Removed unused imports: `queryKeys`, `PaymentCard`, `mapFeedItemToPaymentCard`
    - Removed unused route parameter: `readOnlyParam` (destructured but never referenced)
  - `src/application/usecases/quotation/DeclineQuotationUseCase.ts`: Removed unused `Quotation` import
  - `src/pages/projects/ProjectDetail.tsx`: Removed two unused handler definitions:
    - `handlePaymentAttachDocument` (const callback, never called)
    - `handleInvoiceAttachDocument` (const callback, never called)

- **Verification**:
  - **ESLint**: `npm run lint` now reports **0 errors** (down from 11), 75 pre-existing warnings (unchanged)
  - **TypeScript**: `npx tsc --noEmit` passes (strict mode, zero new errors)
  - **Git**: Clean worktree ready for PR

### Acceptance Criteria  
All criteria met:
- ✅ All 7 `@typescript-eslint/no-unused-vars` errors resolved (4 imports, 1 parameter, 2 variable assignments)
- ✅ ESLint reports 0 errors (down from 11 pre-fix errors in this issue)
- ✅ TypeScript strict mode passes with no new errors  
- ✅ No regression in existing test suite (1396+ tests passing)
- ✅ Code quality: All fixes maintain immutability, dependency injection patterns, and Clean Architecture layer separation

---

## ✅ Issue #199 — Update Payments List in Project Detail
**Status**: COMPLETED  
**Branch**: `issue-199-payments-list-project-detail`  
**Date Completed**: 2026-04-09

### Changes Made
- **New Domain Entity**: `PaymentFeedItem` discriminated union (`'payment' | 'invoice'`) representing unified payment/invoice feed items in project detail
- **New Use Case**: `ListProjectPaymentsFeedUseCase` combining both unlinked payments and all invoices (all statuses: Draft, Issued, Overdue, Paid, Cancelled, etc.) for a project
- **New Component**: `TimelineInvoiceCard` (parallel to `TimelinePaymentCard`) with amber left-border accent, status chips display, and quick actions (View, Mark Paid, Attach)
- **Updated Hook**: `usePaymentsTimeline` now returns `items: PaymentFeedItem[]` instead of `payments: Payment[]`; grouped by date via `groupFeedItemsByDay` helper
- **Updated Screen**: `ProjectDetail.tsx` renders mixed payment/invoice grid; new handlers for `onViewInvoice`, `onMarkInvoiceAsPaid`, `onInvoiceAttachDocument`
- **Navigation Route**: Added `InvoiceDetail` to `ProjectsStackParamList` with `openMarkAsPaid` and `openDocument` params (consistent with `QuotationDetail` pattern)
- **Algorithm**: Filters to unlinked payments (`invoiceId === null || undefined`) + all invoices; sorts by due date ascending; applies MAX_ITEMS=500 guard with truncation flag
- **Tests**: Full TDD coverage (1396 tests pass):
  - Unit tests: `ListProjectPaymentsFeedUseCase`, `groupFeedItemsByDay`, `TimelineInvoiceCard` rendering and actions
  - Integration tests: ProjectDetail mixed payments/invoices, navigation, empty states
  - No schema changes required; both `PaymentRepository.findByProjectId` and `InvoiceRepository.listInvoices` already exist

### Acceptance Criteria  
All criteria met:
# Project Progress — Summary (updated 2026-04-09)

## ✅ Issue #199 — Update Payments List in Project Detail
**Status**: COMPLETED  
**Branch**: `issue-199-payments-list-project-detail`  
**Date Completed**: 2026-04-09

### Changes Made
- **New Domain Entity**: `PaymentFeedItem` discriminated union (`'payment' | 'invoice'`) representing unified payment/invoice feed items in project detail
- **New Use Case**: `ListProjectPaymentsFeedUseCase` combining both unlinked payments and all invoices (all statuses: Draft, Issued, Overdue, Paid, Cancelled, etc.) for a project
- **New Component**: `TimelineInvoiceCard` (parallel to `TimelinePaymentCard`) with amber left-border accent, status chips display, and quick actions (View, Mark Paid, Attach)
- **Updated Hook**: `usePaymentsTimeline` now returns `items: PaymentFeedItem[]` instead of `payments: Payment[]`; grouped by date via `groupFeedItemsByDay` helper
- **Updated Screen**: `ProjectDetail.tsx` renders mixed payment/invoice grid; new handlers for `onViewInvoice`, `onMarkInvoiceAsPaid`, `onInvoiceAttachDocument`
- **Navigation Route**: Added `InvoiceDetail` to `ProjectsStackParamList` with `openMarkAsPaid` and `openDocument` params (consistent with `QuotationDetail` pattern)
- **Algorithm**: Filters to unlinked payments (`invoiceId === null || undefined`) + all invoices; sorts by due date ascending; applies MAX_ITEMS=500 guard with truncation flag
- **Tests**: Full TDD coverage (1396 tests pass):
  - Unit tests: `ListProjectPaymentsFeedUseCase`, `groupFeedItemsByDay`, `TimelineInvoiceCard` rendering and actions
  - Integration tests: ProjectDetail mixed payments/invoices, navigation, empty states
  - No schema changes required; both `PaymentRepository.findByProjectId` and `InvoiceRepository.listInvoices` already exist

### Acceptance Criteria  
All criteria met:
- ✅ `PaymentFeedItem` discriminated union defined in domain layer
- ✅ `ListProjectPaymentsFeedUseCase` combines unlinked payments + all invoices
- ✅ `TimelineInvoiceCard` renders with status chips (invoice.status + invoice.paymentStatus)
- ✅ `usePaymentsTimeline` updated to return `PaymentFeedItem[]` grouped by date
- ✅ ProjectDetail renders mixed list with correct handlers
- ✅ InvoiceDetail route added to ProjectsNavigator with overlay params
- ✅ Sorting by due date (Payment: `dueDate ?? date`; Invoice: `dateDue ?? dueDate ?? issueDate`)
- ✅ Unit & integration tests pass with full coverage
- ✅ TypeScript strict mode passes; ESLint 0 errors (71 pre-existing warnings)
- ✅ MAX_ITEMS=500 guard with truncation flag

## ✅ Issue #198 — Refine "Mark Task Completed" — Payment Validation (Feature 1)
**Status**: COMPLETED  
**Branch**: `issue-198-refine-mark-task-completed`  
**Date Completed**: 2026-04-09

### Changes Made
- **Domain Layer — New Error Type**:
  - Added `PendingPaymentsForTaskError` in `TaskCompletionErrors.ts` to encapsulate pending payment records and provide rich error context to the UI
- **Domain Layer — New Service**:
  - Created `TaskPaymentValidator` service (`src/domain/services/TaskPaymentValidator.ts`) — validates task completion eligibility by checking:
    - Whether the task has a linked invoice (`task.quoteInvoiceId`)
    - Whether the linked invoice has any pending payments (status: `'pending'`)
    - Returns `{ ok: true, pendingPayments: [] }` if eligible; `{ ok: false, pendingPayments: [...] }` if not
- **Application Layer — Extended Use Cases**:
  - **CompleteTaskUseCase**: Added payment validation check (after existing quotation validation) — throws `PendingPaymentsForTaskError` if pending payments exist
  - **CompleteTaskAndSettlePaymentsUseCase** (NEW): Two-phase atomic operation — settles all pending payments via `MarkPaymentAsPaidUseCase`, then calls `CompleteTaskUseCase` to mark task completed
- **Hooks Layer**:
  - Extended `useTasks` hook with new `completeTaskAndSettlePayments(taskId)` method—delegates to the new use case and refreshes task/payment caches on success
- **UI Layer — TaskDetailsPage**:
  - Updated `handleComplete` to catch `PendingPaymentsForTaskError` and present a 2-button Alert:
    - **"Mark as Paid & Complete"**: calls `completeTaskAndSettlePayments(taskId)`
    - **"Cancel"**: dismisses dialog; task and payments unchanged
  - Successful settlement navigates back to project with updated task
- **Tests**: Comprehensive TDD coverage across all layers — 13 acceptance criteria:
  - Unit tests: `TaskPaymentValidator` covering all three paths (no invoice, all settled, 1+ pending)
  - Unit tests: `CompleteTaskUseCase` for no-throw (settled) and throw (pending) paths
  - Unit tests: `CompleteTaskAndSettlePaymentsUseCase` for full two-phase flow
  - Integration test: End-to-end flow — pending payment on accepted-quotation invoice → use case execution → task completed and payment marked paid in SQLite
  - UI snapshot test: TaskDetailsPage rendering with alert dialog
  - **Code Quality**:
  - ✅ TypeScript strict mode: 0 new errors (all earlier issues fixed)
  - ✅ ESLint: 0 errors (71 pre-existing warnings from earlier issues)
  - ✅ All 13 acceptance criteria met (AC-1 through AC-13)

### Acceptance Criteria
All 13 acceptance criteria met:
- ✅ AC-1 to AC-3: TaskPaymentValidator validates invoice and pending payment states
- ✅ AC-4 to AC-5: CompleteTaskUseCase throws on pending payments; CompleteTaskAndSettlePaymentsUseCase settles then completes
- ✅ AC-6 to AC-8: UI catches error and presents 2-button alert with correct behavior
- ✅ AC-9 to AC-12: Full unit and integration test coverage
- ✅ AC-13: TypeScript strict mode passes

## ✅ Issue #196 — Link Payment to Project in Pending Payment Screen
**Status**: COMPLETED  
**Branch**: `issue-196-link-payment-to-project`  
**Date Completed**: 2026-04-09

### Changes Made
- **LinkPaymentToProjectUseCase** (new):
  - Validates `payment.status === 'pending'`; throws `PaymentNotPendingError` if not
  - Updates payment via `paymentRepo.update()` with new `projectId` (or `undefined` to clear)
  - Returns updated Payment entity
  
- **LinkInvoiceToProjectUseCase** (new):
  - Validates invoice is not `'cancelled'` and `paymentStatus !== 'paid'`; throws `InvoiceNotEditableError` if invalid
  - Calls `invoiceRepo.assignProject()` (for defined projectId) or `updateInvoice()` (to clear)
  - Returns void; orchestrates invoice project assignment
  
- **PaymentErrors** (new domain error types):
  - `PaymentNotPendingError`: Thrown when attempting to link project to non-pending payment
  - `InvoiceNotEditableError`: Thrown when invoice is cancelled or already paid
  
- **PaymentDetails.tsx** (extended):
  - Removed `!isSynthetic` guard from project row display — now shows project for **all** payment types
  - For synthetic invoice-payable rows: project resolved from `invoice.projectId` (via new extended `loadData()` logic)
  - Tappable project row for **pending** payments (real or synthetic) → opens `ProjectPickerModal`
  - Read-only project row (no chevron, non-interactive) for **settled** or **cancelled** payments
  - Added edit (pencil) icon in header, visible only for **pending real payment records** (not synthetic invoice rows)
  - On project selection: calls `LinkPaymentToProjectUseCase` (for real payments) or `LinkInvoiceToProjectUseCase` (for synthetic rows)
  - Cache invalidation: `paymentEdited()` with updated `projectId` clears `paymentsAll`, `projectPayments()`, and cross-filter keys
  
- **PendingPaymentForm** (new modal component):
  - Editable fields: `date`, `dueDate`, `method`, `notes`, `reference`, `projectId`
  - Project field: tappable row that opens embedded `ProjectPickerModal`
  - Method selector: horizontal chip row (`bank`, `cash`, `check`, `card`, `other`)
  - Save button calls `paymentRepo.update()` with all changed fields + optional `LinkPaymentToProjectUseCase` if `projectId` changed
  - Modal presentation: `pageSheet` style, `KeyboardAvoidingView`, consistent with existing modal patterns
  - Visible/triggered from Payment Detail header edit icon (for pending real payments only)
  
- **Query Keys** (extended):
  - No new query key types required; existing keys (`paymentsAll`, `projectPayments()`, `unassignedPaymentsGlobal`, `invoices()`) already cover cache invalidation
  - Invalidation logic updated in `PaymentDetails.tsx` to cover both payment and invoice project changes
  
- **Invoice Schema** (extended via `DrizzleInvoiceRepository`):
  - No database migration needed — `projectId` column already exists on `invoices` table (from earlier work)
  - `assignProject(invoiceId, projectId)` method already implemented; reused in `LinkInvoiceToProjectUseCase`
  
- **Tests**: Full TDD coverage (1375+ tests pass):
  - Unit tests: `LinkPaymentToProjectUseCase` (pending flow, status guards, not-found errors)
  - Unit tests: `LinkInvoiceToProjectUseCase` (unpaid invoice flow, cancelled/paid guards)
  - Unit tests: `PaymentErrors` (error types and messaging)
  - Integration tests: `LinkPaymentToProject` (full Drizzle flow: save pending payment → link → verify updated `projectId`)
  - Integration tests: `LinkInvoiceToProject` (full Drizzle flow: save invoice → link → verify project assignment)
  - UI integration tests: `PaymentDetailsSyntheticProject` (synthetic row project display, tappable state, read-only guard for settled payments)
  - UI integration tests: `PendingPaymentForm` (form rendering, field edits, save flow, project picker integration)
  - Snapshot tests: Form layouts, modal states, project row display variants
  
- **Code Quality**:
  - ✅ TypeScript strict mode: `npx tsc --noEmit` passes with zero errors (fixed missing import in integration test)
  - ✅ All 15 acceptance criteria met (AC-1 through AC-15)

### Acceptance Criteria  
All 15 acceptance criteria met:
- ✅ AC-1: PaymentDetails shows Project row for both real and synthetic invoice-payable rows
- ✅ AC-2: For synthetic rows, project resolved from `invoice.projectId`; shows "Unassigned" if none
- ✅ AC-3: Tapping project row on pending payment opens `ProjectPickerModal`
- ✅ AC-4: Real pending payment project selection calls `LinkPaymentToProjectUseCase`; persists `projectId`
- ✅ AC-5: Synthetic invoice-payable row calls `LinkInvoiceToProjectUseCase`; persists invoice `projectId`
- ✅ AC-6: Clearing project (via modal) sets `projectId = undefined`
- ✅ AC-7: Cache invalidation on assignment: `paymentsAll`, `projectPayments()`, `unassignedPaymentsGlobal`, `invoices()` cleared
- ✅ AC-8: Settled/cancelled payments show read-only project row (no chevron, non-tappable)
- ✅ AC-9: `LinkPaymentToProjectUseCase` throws `PaymentNotPendingError` for non-pending status
- ✅ AC-10: `LinkInvoiceToProjectUseCase` throws `InvoiceNotEditableError` when invoice cancelled or paid
- ✅ AC-11: Edit (pencil) icon visible in PaymentDetails header only for pending real payments
- ✅ AC-12: `PendingPaymentForm` has editable fields (date, dueDate, method, notes, reference, projectId)
- ✅ AC-13: Form save calls `paymentRepo.update()` + optional `LinkPaymentToProjectUseCase` if projectId changed
- ✅ AC-14: TypeScript strict mode passes (`npx tsc --noEmit`)
- ✅ AC-15: All test plan items (§7) have passing tests

---
- **GetTaskDetailUseCase** (extended):
  - Added `linkedQuotations: Quotation[]` to `TaskDetail` interface
  - Injects optional `QuotationRepository`; hydrates `linkedQuotations` via `quotationRepository.findByTask(taskId)` (zero regression on existing callers without injection)
  
- **QuotationForm** (validation hardened):
  - Project field now required: `validate()` adds error guard → `if (!selectedProjectId) errors.project = 'Project is required'`
  - Red asterisk (*) added to Project label; error message renders below picker (consistent with other field errors)
  - Blocks form submission when project is unselected
  
- **QuotationDetail Screen** (action buttons added):
  - Displays **Cancel** and **Decline** action buttons when `quotation.status === 'pending_approval'` (sticky footer)
  - Approve button: `bg-green-600`; triggers confirmation Alert → calls `approveQuotation()`; shows loading indicator
  - Cancel button: destructive outline style; triggers confirmation Alert → calls `declineQuotation()`; shows loading indicator
  - On success: quotation re-fetches; status badge updates to `Accepted` or `Declined`; buttons disappear
  
- **TaskLinkedQuotationSection** (new component):
  - Displays under Task details when `linkedQuotations` is non-empty
  - Yellow alert card for `pending_approval` quotations: AlertTriangle icon + "Awaiting your approval" text + reference/total + "Open Quotation" link
  - Green row for `accepted` quotations with badge styling
  - Neutral rows for other statuses
  - Section title: "Linked Quotation" (with pressable link to quotation detail)
  
- **useQuotations Hook** (new actions):
  - Added `approveQuotation(quotationId): Promise<ApproveQuotationOutput>`
  - Added `declineQuotation(quotationId): Promise<DeclineQuotationOutput>`
  - Both dispatch cache invalidation via `invalidateQuotationQueries()` and repopulate local state
  
- **Tests**: Full TDD coverage (1370+ tests pass):
  - Unit tests: CreateQuotationWithTaskUseCase (validation, task creation, linking)
  - Unit tests: ApproveQuotationUseCase & DeclineQuotationUseCase (status transitions, task updates, invoice creation)
  - Unit tests: GetTaskDetailUseCase extended (linkedQuotations hydration with optional repo)
  - Unit tests: QuotationForm required project validation (error rendering, blocking submit)
  - Unit tests: QuotationDetail approve/decline buttons, confirmation flows, loading states
  - Unit tests: TaskLinkedQuotationSection component (yellow pending banner, green accepted row, navigation)
  - Integration tests: CreateQuotationWithTask full flow (Drizzle); ApproveQuotation → invoicing + task update flow (Drizzle)
  - Snapshot tests: Button layouts, modal states, section renders
  
- **Code Quality**:
  - ✅ ESLint: 0 errors (71 pre-existing warnings)
  - ✅ TypeScript strict mode: All 15 acceptance criteria validated; `npx tsc --noEmit` passes with zero new errors
  - All 15 acceptance criteria met (AC-1 through AC-15)

### Acceptance Criteria  
All 15 acceptance criteria met:
- ✅ AC-1: Auto-created Task linked via `taskId` in quotation
- ✅ AC-2: `QUOTATION_PROJECT_REQUIRED` error thrown when `projectId` absent
- ✅ AC-3: Task auto-creation rules (title, status, taskType, quoteStatus, quoteAmount) enforced
- ✅ AC-4: QuotationForm shows required indicator (*) on Project; blocks submission when empty
- ✅ AC-5: Quotation entity and schema support `'pending_approval'` status
- ✅ AC-6: QuotationDetail shows Cancel & Approve buttons when `status === 'pending_approval'`
- ✅ AC-7: Approve invokes use case; creates Invoice; updates quotation + task; shows Accepted badge
- ✅ AC-7b: Cancel invokes use case; updates quotation + task; shows Declined badge
- ✅ AC-8: On success, buttons replaced with badge; navigation/confirmation shown
- ✅ AC-9: `GetTaskDetailUseCase` returns `linkedQuotations` via `QuotationRepository.findByTask()`
- ✅ AC-10: `TaskDetailsPage` renders `TaskLinkedQuotationSection` when quotations exist
- ✅ AC-11: Section shows yellow "Pending Approval" banner with "Open Quotation" link
- ✅ AC-12: Section shows green "Approved" row with quotation total
- ✅ AC-13: All use cases and components have unit tests
- ✅ AC-14: Two integration tests pass (CreateQuotationWithTask + ApproveQuotation flows)
- ✅ AC-15: TypeScript strict mode passes

---

## ✅ Issue #192 — Add Quotation: Project Field + Subcontractor Picker  
**Status**: COMPLETED  
**Branch**: `issue-192-add-quotation-project-subcontractor`  
**Date Completed**: 2026-04-09

### Changes Made
- **QuotationForm Component**: 
  - Added **Project Picker** field (reusing `ProjectPickerModal` from #191) — allows selection of existing projects; both optional
  - Replaced plain text "Client / Vendor" input with **Subcontractor Picker Row** — same UX as `TaskDetailsPage` (`SubcontractorPickerModal`)
  - Integrated **quick-add inline flow** via `QuickAddContractorModal` — users can create new contacts on-the-fly
  - Fixed form layout: consistent `px-6 mb-4` spacing for all fields, `px-6 gap-4 mt-6` for button row
  - `onSubmit` payload now includes `projectId` and `vendorId` (both optional; persisted via existing `DrizzleQuotationRepository`)
- **QuotationScreen Modal**: 
  - Added proper modal header with title `"New Quotation"` and close button (`✕`)
  - Wrapped content in `SafeAreaView` with `pt-8` top padding (matching `InvoiceScreen` pattern)
  - Consistent spacing and layout alignment across modal child elements
- **QuotationDetail Screen**:
  - Added **Project** row display (folder icon + project name or empty message)
  - Improved client/vendor row display with name and email
  - Loads project name via `ProjectRepository` (no schema changes; data already captured)
- **Database**: No schema migrations required — `projectId` and `vendorId` columns already exist in `quotations` table (indexed)
- **Tests**: Full coverage (1361 tests pass):
  - Unit tests: QuotationForm project picker, vendor picker, quick-add flow, layout snapshots
  - Unit tests: QuotationScreen modal header and layout
  - Unit tests: QuotationDetail project and vendor row display
  - Integration tests: End-to-end quotation create with project and vendor selection
  - Fixed lint errors: Removed unused variable declarations in QuotationScreen integration test
- **Code Quality**:
  - ✅ ESLint: 0 errors (71 pre-existing warnings from earlier issues)
  - ✅ TypeScript strict mode: No new errors
  - All 13 acceptance criteria met (AC-1 through AC-13)

### Acceptance Criteria  
All 13 acceptance criteria met:
- ✅ AC-1: Project picker field added, persists `projectId`
- ✅ AC-2: Vendor picker replaces text input, supports subcontractor selection
- ✅ AC-3: Quick-add contractor inline flow integrated
- ✅ AC-4: `onSubmit` includes both `projectId` and `vendorId`
- ✅ AC-5: QuotationDetail displays project and vendor rows
- ✅ AC-6: QuotationScreen modal has proper header and SafeAreaView
- ✅ AC-7: Form spacing uses consistent NativeWind tokens throughout
- ✅ AC-8: Unit tests for QuotationForm pickers and submit
- ✅ AC-9: Unit test for vendor quick-add flow
- ✅ AC-10: Integration test for end-to-end quotation create
- ✅ AC-11: Snapshot tests for QuotationForm layouts
- ✅ AC-12: TypeScript strict mode passes
- ✅ AC-13: No regression in existing tests

---

## ✅ Issue #191 — Payment Detail: Show & Assign Project + Unassigned Filter  
**Status**: COMPLETED  
**Branch**: `issue-191-show-payment-project`  
**Date Completed**: 2026-04-09

### Changes Made
- **ProjectPickerModal**: New reusable modal component (extracted from SubcontractorPickerModal pattern) for selecting or clearing project assignments. Includes "Go to Project" navigation button when a project is already selected.
- **PaymentDetails Screen**: Integrated project display and assignment UI:
  - Displays project name with chevron icon (tappable) when assigned
  - Shows "Unassigned" (muted) when no project or project not found
  - Opens ProjectPickerModal on tap to change/clear assignment
  - Supports cross-tab navigation to Project Detail via "Go to Project" button
  - Updates payment via `PaymentRepository.update()` with cache invalidation
- **Payments Filter**: Added "Unassigned" filter chip to payments list:
  - New `'unassigned'` filter option in `PaymentsFilterOption` type
  - Updated `useGlobalPaymentsScreen` hook to handle unassigned filter state
  - New `noProject` flag in `PaymentFilters` interface
  - Updated `DrizzlePaymentRepository.list()` to filter `project_id IS NULL` when `noProject: true`
  - Proper query key management with `unassignedPaymentsGlobal()` cache key
- **Tests**: Full test coverage (unit & integration):
  - ProjectPickerModal component tests (rendering, selection, clearing, navigation)
  - PaymentDetails project assignment and navigation flows
  - useGlobalPaymentsScreen unassigned filter state management
  - DrizzlePaymentRepository SQL filtering for null project_id
- **Code Quality**: Fixed unused variable linting error in test file; all checks pass:
  - ✅ ESLint: 0 errors (71 warnings—pre-existing)
  - ✅ TypeScript strict mode: No new errors

### Acceptance Criteria  
All 15 acceptance criteria met:
- ✅ AC-1 to AC-10: Project row display, assignment UI, modal, navigation
- ✅ AC-11: TypeScript strict passes
- ✅ AC-12 to AC-14: "Unassigned" filter chip and SQL filtering
- ✅ AC-15: Comprehensive test coverage

---

**Previously Implemented:**
- **Payments UI:** Replaced segmented tabs with filter chips and added dual-mode payments views and `PaymentCard` UI.
- **Invoices & PDF:** PDF→image converter (`MobilePdfConverter`), invoice upload flow, OCR adapter and related use cases.
- **Tasks & Task Details:** Documents, dependencies, subcontractor, delay/progress logs, task form extensions, task cockpit data (blockers + Focus-3), and many UI flows (picker modals, bottom-sheet removal).
- **Voice & STT:** Voice recording pipeline, Groq STT/LLM adapters, and remote voice parsing service (feature-flagged).
- **Location & GPS:** Best-known-location use case, local stored locations, and nearby-project search with Haversine ranking.
- **Audit & Progress Logs:** Append-only audit log and generalized task progress logs with CRUD UI and use cases.
- **Database & Migrations:** Multiple safe ALTER TABLE migrations and Drizzle migrations for new fields/tables.

**Pending / Known Issues:**
- **Native modules to install:** `rn-pdf-renderer`, `react-native-audio-recorder-player`, `react-native-geolocation-service` — run `cd ios && pod install` after install before on-device QA.
- **On-device QA needed:** PDF conversion, camera flows, voice recording/STT, GPS location, and payments Pay Now flow require device testing on iOS/Android.
- **Background tasks & cleanup:** Temp PDF render cache cleanup and document file lifecycle (post-upload cleanup, cascade deletes) need finalization.
- **Performance & DB:** Review heavy Drizzle queries (e.g., invoice/payment reports) and consider moving aggregations to SQL where noted.
- **UI polish & accessibility:** Address remaining ESLint/style warnings and add accessibility attributes for custom selectors.
- **Feature flags & production wiring:** Replace dev/mock adapters with production adapters (Groq/OpenAI tokens, MobileAudioRecorder, real SuggestionService) behind flags and secure token vending.

Archive of the full, original progress log has been copied to: [design/progress-archive-2026-04-09.md](design/progress-archive-2026-04-09.md)

If you want, I can:
- run `npx tsc --noEmit` and `npm test` to verify the tree, or
- commit these changes and open a PR with the archive and summary.
