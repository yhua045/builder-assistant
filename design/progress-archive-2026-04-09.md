# Project Progress (archive)

## Full project progress snapshot (copied 2026-04-09)

Below is a verbatim archive of the project's `progress.md` as it existed prior to summarization. This preserves milestone history, implemented features, design decisions, and pending items for reference.

## Current Milestone: Issue #186 — Payments Navigation & Filter Chips
**Status**: Phase 3 — Implementation complete ✅
**Design doc**: design/issue-186-payments-filter-chips.md
**Branch**: fix/payments-navigation-context-186

### Summary
Replaced broken segmented control tabs with filter chips to fix navigation context loss in payments screen. Migrated from `PaymentsSegmentedControl` (React Navigation incompatible) to new `PaymentTypeFilterChips` component with local state management.

### Implementation Details
- **New Component**: `PaymentTypeFilterChips.tsx` — Renders filter chips in horizontal scrollable container with active/inactive states
- **Removed Components**:
	- `PaymentsFilterBar.tsx` (wrapper component)
	- `PaymentsSegmentedControl.tsx` (broken tabs)
- **Integration Points**:
	- `useGlobalPaymentsScreen` hook updated to use local state for payment type filter
	- `PaymentsScreen` integrated with new filter UI
- **Test Updates**: Fixed missing type imports in test files (`DelayReasonType`, `PaymentListResult`)
- **Design**:
	- Uses NativeWind styling (Tailwind) for consistent UI
	- Horizontal scrollable FlatList for responsive layout
	- Active/inactive chip styling with Tailwind classes
- **Validation**: All type checks and linting pass ✅

### Completed
- ✅ Replaced broken segmented control with filter chips
- ✅ Fixed navigation context loss issue
- ✅ Local state management for payment type filtering
- ✅ Updated test imports (TypeScript compilation clean)
- ✅ Static analysis passed (ESLint warnings only, no errors)
- ✅ Committed and pushed to `fix/payments-navigation-context-186`

---

## Previous Milestone: Issue #188 — Payments Screen Tab Redesign
**Status**: Phase 3 — Implementation complete ✅
**Design doc**: design/issue-188-payments-screen.md
**Branch**: feature/issue-188-payments-screen

---

## 1. System Key Technology Stack

- **Architecture**: Clean Architecture (UI → Hooks → Use Cases → Domain → Infrastructure).
- **Core Framework**: React Native (0.76+) with TypeScript 5.x.
- **UI & Styling**: NativeWind (Tailwind CSS) v4, React Native Reanimated.
- **Navigation**: React Navigation (Tabs, Stacks).
- **Persistence**:
	- **Database**: Drizzle ORM over SQLite (`react-native-sqlite-storage`).
	- **Migrations**: Automated schema migrations via Drizzle Kit.
- **File System**: `react-native-fs` (abstracted via `LocalDocumentStorageEngine`).
- **Testing Strategy**:
	- **Unit**: Jest + React Test Renderer (fast, mocked dependencies).
	- **Integration**: React Native Testing Library + In-Memory SQLite Shim.
- **AI & ML Integration**:
	- **OCR**: `react-native-image-picker` with Rules-based normalization (current) → Planned TFLite/ML Kit.
	- **Validation**: Deterministic domain logic with confidence scoring.

## 2. Features Implemented and Key Decisions Made

### Core Domain & Infrastructure
- **Domain Modeling**: Implemented rich domain entities (`Project`, `Invoice`, `Payment`, `Contact`, `Quotation`) with enforced invariants.
- **Repository Pattern**: Strict separation of interface and implementation (e.g., `DrizzleProjectRepository` vs `InMemoryProjectRepository`) allowing fast TDD.
- **Workflow Validation**: Centralized `ProjectWorkflowService` controls status transitions (e.g., Active → Completed).
- **Audit Trails**: Lightweight JSON-based audit logs stored in entity metadata (e.g., Invoice lifecycle events).

### Modules Delivered
- **Dashboard**:
	- Hero section with Quick Actions (Snap Receipt, Add Project, Add Quote).
	- Real-time financial summaries.
- **Projects**:
	- **Management**: Create (validated form with Owner/Address), List (filter/search), Archive, Favorite.
	- **Details**: Hydrated read-models (`ProjectDetails`) combining Owner/Property data.
- **Invoicing & Payments**:
	- **CRUD**: Full lifecycle for Invoices (Draft → Issued → Paid) and Payments.
	- **Logic**: Automatic payment status updates; partial payment support.
	- **Validation**: Rules-based invoice normalizer (Tax, Total, Date validation).
	- **Uploads**: PDF/Image upload section with confidence scoring and inline editing.
- **Receipts (Snap Receipt)**:
	- **Quick Action**: Camera integration → OCR Processing → Expense creation.
	- **Normalization**: Deterministic normalizer with fallback strategy.
- **Quotations**:
	- **Management**: Create/Edit quotations with line items and vendor details.
	- **Integration**: Wired to Dashboard and Project workflows.

### Key Decisions
- **Cache-then-Save Pattern**: PDF metadata cached in memory; zero DB writes until user submits forms (prevents ghost Document records).
- **Immediate File Copy**: Files copied to app private storage immediately after selection.
- **Dependency Injection**: File picker and system adapters injectable via props/context for testability.
- **No-Op Migrations**: Used for non-schema changes to maintain migration alignment across environments.

## 3. Pending Tasks

### Invoice Module (Phase 2 & 3 Completion)
- **Integration Tests**: End-to-end flow for Invoice Upload → OCR → Extraction → Save.
- **Document Storage**: Finalize linking uploaded files to `Document` entity and persisting extracted metadata.
- **Extraction**: Wire up async extraction status tracking and retry mechanisms.
- **Form Integration**: Fully wire `InvoiceUploadSection` into `InvoiceForm`.

### General Backlog
- **Voice Input**: Add `@react-native-voice/voice` for creating notes/quotes (Deferred).
- **OCR Upgrade**: Transition from Rules-based to TFLite/ML Kit models when dataset is ready.
- **Performance**: Review `DrizzleInvoiceRepository` SQL query performance.
- **UI Polish**: Address remaining ESLint inline-style warnings in UI components.
- **Accessibility**: Add ARIA attributes and keyboard navigation to custom selectors.

## 4. Issue #87 — PDF → Image Conversion Adapter (2026-02-19)

### Key Decisions
- **Platform-adapter pattern**: `IPdfConverter` interface in `src/infrastructure/files/` keeps use cases implementation-agnostic. Production uses `MobilePdfConverter`; tests use `MockPdfConverter`.
- **Dependency via rn-pdf-renderer**: Wraps iOS PDFKit / Android PdfRenderer. Dynamically required so the app degrades gracefully if the native module is not yet linked.
- **Optional constructor argument**: `ProcessInvoiceUploadUseCase` accepts `pdfConverter?: IPdfConverter` — callers without it retain the previous empty-result behaviour (backward compatible, no breaking change).
- **Multi-page merge strategy**: Each page is OCR'd in sequence; full texts are concatenated with `--- Page N ---` separators before normalization.
- **Temp file location**: Rendered JPEGs written to `RNFS.CachesDirectoryPath/pdf_render/` and named with a UUID per upload cycle.
- **Error taxonomy**: `PdfConversionError` (extends `Error`) carries a typed `code` (`FILE_NOT_FOUND | INVALID_PDF | PAGE_RENDER_FAILED | UNKNOWN`) for programmatic handling.

### Completed
- Design doc at `design/issue-87-pdf-converter.md` (user story, API contracts, acceptance criteria, open questions).
- `IPdfConverter` interface + `PdfConversionError` in `src/infrastructure/files/IPdfConverter.ts`.
- `MobilePdfConverter` production implementation in `src/infrastructure/files/MobilePdfConverter.ts`.
- `MockPdfConverter` configurable stub in `__mocks__/MockPdfConverter.ts`.
- `ProcessInvoiceUploadUseCase` updated to handle PDF path via converter.
- `InvoiceScreen` updated with `pdfConverter?: IPdfConverter` prop forwarded to the use case.
- 16 new unit tests (`PdfConverter.test.ts`), 9 new tests added to `ProcessInvoiceUploadUseCase.test.ts`, 8 new integration tests (`ProcessInvoiceUpload.integration.test.ts`).
- All 71 test suites pass (446 tests); TypeScript strict check clean.

### Pending / Next Steps
- **Install native module**: `npm install rn-pdf-renderer && cd ios && pod install` then rebuild — required before PDFs are converted on-device.
- **Wire in production**: Pass `new MobilePdfConverter()` as `pdfConverter` prop where `InvoiceScreen` is composed in the app shell.
- **Temp file cleanup**: Implement post-upload cleanup of `pdf_render/` cache directory.
- **Manual QA**: Test with real single-page, multi-page, and landscape PDFs on iOS and Android devices.
- **Max-pages UX**: Decide whether to surface a warning when a PDF exceeds the 10-page default cap.

---

## 5. Issue #95 — "Use Camera" on TaskScreen (2026-02-20)

### Key Decisions
- **Reuse `Document` entity**: Added optional `taskId?` field to `Document` rather than creating a new `TaskAttachment` entity — keeps the schema lean and reuses existing upload/storage infrastructure.
- **Auto-create on Confirm**: Task is created immediately when the user taps Confirm on the photo preview (default title `Task – DD Mon YYYY`, `dueDate` = T+3 days). The user is then dropped into `TaskForm` in edit mode to refine details. This prevents orphaned in-progress tasks.
- **Hook injection for testability**: `TaskScreen` accepts an optional `cameraHook?: UseCameraTaskReturn` prop so tests can inject a plain mock object directly — avoids `jest.mock` hoisting / TDZ issues that arise when mocking hooks that call `container.resolve()`.
- **Null-safe DI in `useCameraTask`**: All `container.resolve()` calls are wrapped in try/catch returning `null` when tokens are unregistered (e.g. in unit tests). The hook throws a clear error at call-time if dependencies are missing, not at mount-time.

### ⚠️ Gotcha
`renderer.create(<ComponentWithModal />)` triggers internal state updates that must be wrapped in `act()` — i.e., use `await act(async () => { tree = renderer.create(...); })`. Omitting this causes "Can't access .root on unmounted test renderer" on all subsequent assertions.
