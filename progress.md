# Project Progress — Summary (updated 2026-04-09)

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
  - Fixed test suite errors: corrected Invoice field names (`vendor` vs `vendorName`, `total` vs `totalAmount`), added missing mock method

### Acceptance Criteria
All 13 acceptance criteria met:
- ✅ AC-1 to AC-3: TaskPaymentValidator validates invoice and pending payment states
- ✅ AC-4 to AC-5: CompleteTaskUseCase throws on pending payments; CompleteTaskAndSettlePaymentsUseCase settles then completes
- ✅ AC-6 to AC-8: UI catches error and presents 2-button alert with correct behavior
- ✅ AC-9 to AC-12: Full unit and integration test coverage
- ✅ AC-13: TypeScript strict mode passes

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
