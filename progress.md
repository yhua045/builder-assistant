# Project Progress

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
