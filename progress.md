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

---

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

## 5. Issue #94 — Voice Task Entry (2026-02-20)

### Key Decisions
- **Two-port architecture**: Split voice responsibility into two clean interfaces — `IAudioRecorder` (captures raw audio as `ArrayBuffer`) and `IVoiceParsingService` (converts `ArrayBuffer` → `TaskDraft`). This allows swapping each adapter independently (e.g. switch STT backend without touching the recorder).
- **ArrayBuffer over file path**: Audio is decoded in-memory immediately after recording and the temp `.mp4` file is always deleted inside `stopRecording()` (try/finally). No audio persists on device beyond the duration of a single parse call.
- **Singleton player**: `react-native-audio-recorder-player` exports a module-level singleton instance rather than a constructable class. `MobileAudioRecorder` holds a reference to that singleton; mocks replace the module via Jest `__mocks__`.
- **Timer inside the hook**: `useVoiceTask` owns the elapsed-seconds counter and the auto-stop timer (`setInterval`). The interval callback holds a `useRef`-stabilised reference to `stopAndParse` to avoid stale closure bugs. The timer is always cleared (cancel / manual stop / auto-stop) before state transitions.
- **Mocks wired into DI for dev**: `MockAudioRecorder` and `MockVoiceParsingService` registered as singletons in `registerServices.ts`. Swap for production adapters (`MobileAudioRecorder`, `RemoteVoiceParsingService`) by changing two lines once the STT backend is ready.
- **TaskForm remount via key**: Both task pages use a React `key` prop on `<TaskForm>` that changes when a voice draft arrives. This forces `TaskForm` to remount and pick up new `initialValues` without modifying the form component itself.
- **Draft merge strategy on Edit**: In `EditTaskPage`, only defined (non-`undefined`) draft fields overwrite the existing task. This ensures partial voice results (e.g. title only) do not blank out fields the user already set.

### Completed
- Design doc at `design/issue-94-voice-task-entry.md` (user story, port contracts, field mapping, open questions answered).
- `react-native-audio-recorder-player` installed; `jest.config.js` `transformIgnorePatterns` updated.
- `__mocks__/react-native-audio-recorder-player.js` — singleton mock (not constructor mock).
- `src/infrastructure/voice/MobileAudioRecorder.ts` — concrete `IAudioRecorder`: writes AAC/MP4 to caches dir, reads as base64, decodes to `ArrayBuffer`, deletes temp file in finally block.
- `src/infrastructure/voice/RemoteVoiceParsingService.ts` — skeleton `IVoiceParsingService` ready for a future `POST /api/voice/parse` STT backend (not wired into DI yet).
- `src/hooks/useVoiceTask.ts` — extended with `elapsedSeconds`, `maxSeconds`, `cancel()`, auto-stop timer, and `MAX_RECORDING_SECONDS = 60` export.
- `src/infrastructure/di/registerServices.ts` — voice mocks registered as singletons.
- `src/components/tasks/VoiceRecordingOverlay.tsx` — new full-screen modal overlay with countdown timer, Done / Cancel buttons, and parsing spinner.
- `src/pages/tasks/CreateTaskPage.tsx` — Voice button in header; overlay wired in; draft applied as `initialValues` on `TaskForm`.
- `src/pages/tasks/EditTaskPage.tsx` — same Voice button + overlay; draft merged over existing task fields before passing to `TaskForm`.
- 38 new tests across 4 suites — all passing; zero TypeScript errors introduced:
  - `__tests__/unit/MobileAudioRecorder.test.ts` (8 tests)
  - `__tests__/unit/ParseVoiceTaskUseCase.test.ts` (8 tests, replaced minimal stub)
  - `__tests__/unit/useVoiceTask.test.tsx` (14 tests, replaced original 1-test file)
  - `__tests__/integration/TaskPage.voice.integration.test.tsx` (8 tests, new)

### Pending / Next Steps
- **Native permissions**: Add `NSMicrophoneUsageDescription` to `ios/BuilderAssistantApp/Info.plist` and `RECORD_AUDIO` permission to `android/app/src/main/AndroidManifest.xml` before submitting to stores.
- **Link native module**: Run `cd ios && pod install` after a fresh clone — `react-native-audio-recorder-player` requires CocoaPods linking on iOS.
- **Wire production STT**: Implement a real `IVoiceParsingService` (e.g. `RemoteVoiceParsingService` pointed at a Whisper/Azure Speech endpoint) and swap the DI registration in `registerServices.ts`.
- **Wire `MobileAudioRecorder` in DI**: Once mic permissions are confirmed working on-device, replace `MockAudioRecorder` with `MobileAudioRecorder` in `registerServices.ts`.
- **On-device QA**: Test recording, auto-stop at 60 s, cancel, and parsed draft pre-fill on both iOS and Android.
- **`durationEstimate` / `trade` fields in TaskForm**: `TaskDraft` includes these fields but `TaskForm` does not yet render them. Add inputs if the STT service starts returning them.
