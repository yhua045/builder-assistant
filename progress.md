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

### Completed
- Design doc at `design/issue-95-task-camera.md`.
- `Document.taskId?: string` field + `DocumentRepository.findByTaskId()` interface and `DrizzleDocumentRepository` implementation.
- DB migration `0009_documents_task_id` (`ALTER TABLE documents ADD COLUMN task_id TEXT` + index).
- `ICameraService` application-layer port; `IFileSystemAdapter.deleteFile()`.
- `CreateTaskFromPhotoUseCase` — copies photo to permanent storage, saves `Document` record linked to task, deletes temp file.
- `useCameraTask` hook wiring `ICameraService` → use case.
- `TaskPhotoPreview` component (Retake / Confirm / Cancel).
- `TaskScreen` rewritten with `choose → preview → form` flow.
- `DocumentRepository`, `FileSystemAdapter`, `CameraService` registered in `registerServices.ts`.
- 14 new tests (8 use-case unit + 6 UI unit); all pass. No regressions introduced.

### Pending / Next Steps
- **Device QA**: Verify `react-native-image-picker` camera permissions and URI handling on iOS and Android.
- **Cascade delete**: Deleting a `Task` should delete its linked `Document` records (and their local files) — not yet implemented.
- **Multi-attachment**: Current flow creates one `Document` per session. Future: allow multiple retakes to accumulate attachments before confirm.

---
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

---

## 6. Issue #103 — Voice Production Wiring (Groq STT + LLM) (2026-02-23)

### Key Decisions
- **Groq chosen for POC**: Groq provides a single free API key that covers both Whisper large-v3 (STT) and Llama 3.3 70B (LLM extraction), avoiding the need for two separate service accounts during development.
- **Internal adapter split**: Introduced two new internal ports — `ISTTAdapter` (audio bytes → raw transcript string) and `ITranscriptParser` (transcript string → `TaskDraft`) — inside `RemoteVoiceParsingService`. The outer `IVoiceParsingService` interface is unchanged, so no hooks or pages were modified.
- **`RemoteVoiceParsingService` as thin orchestrator**: Delegates to the two adapters in sequence rather than containing STT/LLM logic directly. Each adapter is independently swappable without touching the orchestrator.
- **Retry + timeout per adapter**: Both `GroqSTTAdapter` and `GroqTranscriptParser` use `AbortController`-based timeouts and configurable retry counts with exponential backoff to handle transient API errors and 429 rate-limit responses.
- **Graceful parser fallback**: If `GroqTranscriptParser` receives a malformed JSON response from the LLM, it returns the raw transcript in the `notes` field of `TaskDraft` rather than throwing — ensuring the user always gets something useful.
- **Feature flags in DI**: `VOICE_USE_MOCK_PARSER` env flag allows soft-rollout (keep mock parser while using real STT, or vice versa). `__DEV__` still preserves full-mock stubs in local dev. `GROQ_API_KEY` is read from `.env` via `react-native-config`.
- **DI guard for tests**: `registerServices.ts` checks `typeof container.registerSingleton === 'function'` before registering — prevents errors when `tsyringe` is mocked as a plain object in Jest.
- **Stable mocks in integration tests**: `useTasks` mock functions are declared at module level (not recreated per render), so `useEffect` dependency arrays in `EditTaskPage` do not trigger infinite re-render loops during tests.

### Completed
- Design doc at `design/issue-103-voice-production-wiring.md` (provider comparison, adapter pattern, retry strategy, QA checklist, acceptance criteria — APPROVED).
- `src/application/services/ISTTAdapter.ts` — new port: `transcribe(audio: ArrayBuffer, mimeType: string): Promise<string>`.
- `src/application/services/ITranscriptParser.ts` — new port: `parse(transcript: string): Promise<TaskDraft>`.
- `src/infrastructure/voice/GroqSTTAdapter.ts` — Groq Whisper large-v3 adapter with retries, AbortController timeout, multipart form upload.
- `src/infrastructure/voice/GroqTranscriptParser.ts` — Groq Llama 3.3 70B adapter with structured prompt, JSON extraction, `notes` fallback on parse failure.
- `src/infrastructure/voice/RemoteVoiceParsingService.ts` — replaced skeleton with orchestrator composing `ISTTAdapter` + `ITranscriptParser`.
- `src/infrastructure/di/registerServices.ts` — wired `GroqSTTAdapter`, `GroqTranscriptParser`, and `MobileAudioRecorder` behind feature flags; added DI guard for test environments.
- `ios/BuilderAssistantApp/Info.plist` — added `NSMicrophoneUsageDescription`.
- `android/app/src/main/AndroidManifest.xml` — added `RECORD_AUDIO` permission.
- `README.md` — added `cd ios && pod install` note and `GROQ_API_KEY` setup guidance.
- 3 new unit test suites — all passing:
  - `__tests__/unit/GroqSTTAdapter.test.ts`
  - `__tests__/unit/GroqTranscriptParser.test.ts`
  - `__tests__/unit/RemoteVoiceParsingService.test.ts`
- `__tests__/integration/TaskPage.voice.integration.test.tsx` — stabilised mock identity; all 8 tests pass.
- Full Jest suite green (80 passed, 2 skipped); TypeScript strict check clean.

### Pending / Next Steps
- **Expand adapter tests**: Add tests for retry exhaustion, 429 backoff, AbortController timeout, and network failure paths in `GroqSTTAdapter` and `GroqTranscriptParser`.
- **Production token vending**: Replace `.env`-based `GROQ_API_KEY` with a short-lived token endpoint for production to prevent key exposure in the app bundle.
- **On-device QA**: Verify mic recording → Groq STT → LLM extraction → form pre-fill on both iOS and Android physical devices per the checklist in the design doc.
- **Wire `MobileAudioRecorder` in DI**: Confirm mic permissions work on-device then remove `MockAudioRecorder` from the default DI registration.
- **`durationEstimate` / `trade` fields in TaskForm**: `TaskDraft` includes these fields but `TaskForm` does not yet render them. Add inputs if the STT service starts returning them.
