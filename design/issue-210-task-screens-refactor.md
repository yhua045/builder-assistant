# Design: Issue #210 — Task Screens Architecture Refactor (Phase 4)

**Date:** 2026-04-22
**Branch:** `issue-210-refactor-observability`
**Author:** Architect agent
**Reviewed by:** mobile-ui agent (UI layout preserved — see §7)
**Phase:** 4 of 4 in the UI Architecture Audit (see `issue-210-ui-architecture-audit.md`)

---

## 1. Summary

`src/pages/tasks/TaskScreen.tsx` and `src/pages/tasks/TaskDetailsPage.tsx` violate Clean
Architecture by resolving DI containers, instantiating infrastructure adapters, and wiring
application-layer use cases directly inside React components.

We will apply the **View-Model Facade pattern** (already established for `DashboardScreen`,
`PaymentDetails`, and the upload screens) to extract all data-fetching, service wiring, and
action-orchestration into two dedicated hooks:

- `src/hooks/useTaskScreen.ts` — facade for `TaskScreen.tsx`
- `src/hooks/useTaskDetails.ts` — facade for `TaskDetailsPage.tsx`

**No visual changes are planned.** All layout, styling, modal UX, and Tailwind tokens are
preserved exactly as-is.

---

## 2. Problem Statement

### 2.1 Violations in `src/pages/tasks/TaskScreen.tsx`

| Line(s) | Violation | Category |
|---------|-----------|----------|
| `import MockVoiceParsingService from '../../infrastructure/voice/MockVoiceParsingService'` | Infrastructure adapter imported directly in UI | ❌ Layer breach |
| `import MockAudioRecorder from '../../infrastructure/voice/MockAudioRecorder'` | Infrastructure adapter imported directly in UI | ❌ Layer breach |
| `container.resolve<IAudioRecorder>('IAudioRecorder')` inside `useMemo` | DI container resolution inside the React component | ❌ Layer breach |
| `container.resolve<IVoiceParsingService>('IVoiceParsingService')` inside `useMemo` | DI container resolution inside the React component | ❌ Layer breach |
| `new MockAudioRecorder()` / `new MockVoiceParsingService()` fallback logic | Infrastructure instantiation with fallback in UI | ❌ Layer breach |
| `audioRecorder?: any` / `voiceParsingService?: any` in Props | Untyped infrastructure dependencies leaked to component props | ⚠️ API smell |
| View-mode state (`view`, `initialDraft`, `capturedUri`, `isCapturing`, `isCreatingTask`, `createdTask`) managed alongside service wiring | Mixed concerns — infrastructure wiring & UI flow state in same component | ⚠️ Poor cohesion |

### 2.2 What is acceptable in `TaskScreen.tsx` after refactor

| Logic | Verdict |
|-------|---------|
| Modal, animated slide rendering | ✅ Pure presentation |
| Conditional `view === 'choose' / 'preview' / 'form'` rendering | ✅ Presentation branching |
| Passing `vm.xxx` props to `TaskForm`, `TaskPhotoPreview` | ✅ Presentation binding |
| `onClose` callback binding | ✅ Presentation binding |

---

### 2.3 Violations in `src/pages/tasks/TaskDetailsPage.tsx`

| Line(s) | Violation | Category |
|---------|-----------|----------|
| `container.resolve<DocumentRepository>('DocumentRepository')` in `useMemo` | DI container resolution inside UI | ❌ Layer breach |
| `container.resolve<TaskRepository>('TaskRepository')` in `useMemo` | DI container resolution inside UI | ❌ Layer breach |
| `container.resolve<IFilePickerAdapter>('IFilePickerAdapter')` in `useMemo` | DI container resolution inside UI | ❌ Layer breach |
| `container.resolve<IFileSystemAdapter>('IFileSystemAdapter')` in `useMemo` | DI container resolution inside UI | ❌ Layer breach |
| `container.resolve<InvoiceRepository>('InvoiceRepository')` in `useMemo` | DI container resolution inside UI | ❌ Layer breach |
| `new AddTaskDocumentUseCase(documentRepository, fileSystemAdapter)` inside `handleAddDocument` | Use case instantiation inside a UI event handler | ❌ Layer breach |
| `loadData` callback orchestrating 5 repositories | Complex data-orchestration / async loading logic in the component body | ❌ Layer breach |
| `subcontractorInfo` derived value mapped from `Contact` → `SubcontractorInfo` shape | Data-shape translation in UI | ⚠️ Should be in hook |
| 12 `useState` calls + 3 `useCallback` complex handlers | All state + handler complexity lives in the component | ⚠️ Poor cohesion |
| `queryClient.invalidateQueries()` calls scattered across handlers | Cache-invalidation logic mixed into UI handlers | ⚠️ Poor cohesion |

### 2.4 What is acceptable in `TaskDetailsPage.tsx` after refactor

| Logic | Verdict |
|-------|---------|
| `SafeAreaView` / `ScrollView` structure | ✅ Pure layout |
| Conditional section rendering (`isCompleted`, `nextInLine.length > 0`) | ✅ Presentation logic |
| Binding `vm.task.title`, `vm.subcontractorInfo`, etc. to JSX | ✅ Presentation binding |
| Passing `vm.handleXxx` as callbacks to section components | ✅ Presentation delegation |

---

## 3. Target Architecture

### 3.1 `TaskScreen` MVVM flow

```
TaskScreen (UI — dumb presentation)
  └── useTaskScreen (View-Model Facade)
        ├── useVoiceTask(recorder, voiceService)  [already exists]
        ├── useCameraTask(cameraAdapter)           [already exists]
        └── [Adapters resolved here — hidden from UI]:
              container.resolve IAudioRecorder → fallback MockAudioRecorder
              container.resolve IVoiceParsingService → fallback MockVoiceParsingService
```

### 3.2 `TaskDetailsPage` MVVM flow

```
TaskDetailsPage (UI — dumb presentation)
  └── useTaskDetails(taskId) (View-Model Facade)
        ├── useTasks()                       [already exists]
        ├── useDelayReasonTypes()             [already exists]
        ├── useContacts()                     [already exists]
        ├── useConfirm()                      [already exists]
        ├── useQuotations()                   [already exists]
        └── [Repositories & Use Case resolved here — hidden from UI]:
              container.resolve DocumentRepository
              container.resolve TaskRepository
              container.resolve IFilePickerAdapter
              container.resolve IFileSystemAdapter
              container.resolve InvoiceRepository
              new AddTaskDocumentUseCase(documentRepository, fileSystemAdapter)
```

### 3.3 Dependency flow (Clean Architecture)

```
UI Layer  (TaskScreen / TaskDetailsPage)
  ↓  consumes only View-Model data & action callbacks
Hook Layer  (useTaskScreen / useTaskDetails)
  ↓  calls existing data hooks; resolves DI adapters; invokes use cases
Application Layer  (AddTaskDocumentUseCase, ParseVoiceTaskUseCase, …)
  ↓  delegates to
Infrastructure Layer  (MockAudioRecorder, MobileAudioRecorder, GroqSTTAdapter, …)
```

---

## 4. New Abstraction: `useTaskScreen`

### 4.1 File location

`src/hooks/useTaskScreen.ts`

### 4.2 Responsibility

Acts as the single View-Model facade for `TaskScreen`.

1. **Service wiring:** Resolves `IAudioRecorder` and `IVoiceParsingService` from the DI container
   (or falls back to mock implementations) — this logic is **moved out of the UI**.
2. **Hook composition:** Calls `useVoiceTask` and `useCameraTask` internally with the resolved
   services.
3. **View-mode state:** Owns `view`, `initialDraft`, `capturedUri`, `isCapturing`,
   `isCreatingTask`, and `createdTask`.
4. **Action handlers:** Exposes typed `handleStartVoice`, `handleStopVoice`, `handleManual`,
   `handleUseCamera`, `handleRetake`, `handleConfirm`, `handleCancelPreview`.

### 4.3 Interface (TypeScript)

```typescript
// src/hooks/useTaskScreen.ts

import { TaskDraft } from '../application/services/IVoiceParsingService';
import { ICameraService } from '../application/services/ICameraService';
import { UseCameraTaskReturn } from './useCameraTask';
import type { Task } from '../domain/entities/Task';

export type TaskScreenViewMode = 'choose' | 'preview' | 'form';

export interface TaskScreenViewModel {
  // View state
  view: TaskScreenViewMode;
  initialDraft: TaskDraft | undefined;
  capturedUri: string | null;
  isCapturing: boolean;
  isCreatingTask: boolean;
  createdTask: Task | null;

  // Voice recording state (proxied from useVoiceTask)
  voicePhase: 'idle' | 'recording' | 'parsing' | 'done' | 'error';

  // Actions
  handleStartVoice: () => Promise<void>;
  handleStopVoice: () => Promise<void>;
  handleManual: () => void;
  handleUseCamera: () => Promise<void>;
  handleRetake: () => Promise<void>;
  handleConfirm: () => Promise<void>;
  handleCancelPreview: () => void;
}

export interface UseTaskScreenOptions {
  /** Override audio recorder for tests */
  audioRecorder?: IAudioRecorder;
  /** Override voice parsing service for tests */
  voiceParsingService?: IVoiceParsingService;
  /** Override camera adapter for tests */
  cameraAdapter?: ICameraService;
  /** Override full camera hook for tests */
  cameraHook?: UseCameraTaskReturn;
}

export function useTaskScreen(options?: UseTaskScreenOptions): TaskScreenViewModel;
```

### 4.4 Simplification to `TaskScreen.tsx`

**Before** (~50 lines of wiring + state):
```typescript
import MockVoiceParsingService from '../../infrastructure/voice/MockVoiceParsingService';
import MockAudioRecorder from '../../infrastructure/voice/MockAudioRecorder';
import { container } from 'tsyringe';
// ... 5 useMemo() + useState() blocks + handlers
```

**After** (single call):
```typescript
const vm = useTaskScreen({ audioRecorder, voiceParsingService, cameraAdapter, cameraHook: cameraHookProp });
```

Props interface becomes fully typed:
```typescript
interface Props {
  onClose: () => void;
  audioRecorder?: IAudioRecorder;        // was `any`
  voiceParsingService?: IVoiceParsingService; // was `any`
  cameraAdapter?: ICameraService;
  cameraHook?: UseCameraTaskReturn;
}
```

All JSX bindings migrate to the `vm.` prefix:
- `state.phase === 'recording'` → `vm.voicePhase === 'recording'`
- `view === 'choose'` → `vm.view === 'choose'`
- `capturedUri` → `vm.capturedUri`
- `handleStartVoice()` → `vm.handleStartVoice()`
- etc.

---

## 5. New Abstraction: `useTaskDetails`

### 5.1 File location

`src/hooks/useTaskDetails.ts`

### 5.2 Responsibility

Acts as the single View-Model facade for `TaskDetailsPage`.

1. **DI resolution:** Resolves `DocumentRepository`, `TaskRepository`, `IFilePickerAdapter`,
   `IFileSystemAdapter`, `InvoiceRepository` via `container.resolve()` — **hidden from UI**.
2. **Use case orchestration:** Instantiates and executes `AddTaskDocumentUseCase` inside
   `handleAddDocument` — the UI never `new`s a use case.
3. **Data loading:** Owns the `loadData` async orchestration across repositories.
4. **Derived data:** Produces `subcontractorInfo` (the `Contact → SubcontractorInfo` mapping).
5. **State:** Owns all 12 `useState` variables (`task`, `taskDetail`, `documents`,
   `subcontractor`, `linkedInvoice`, `hasQuotationRecord`, `loading`, `completing`,
   `showDelayModal`, `showTaskPicker`, `showSubcontractorPicker`, `uploadingDocument`,
   `showAddLogModal`, `editingLog`, `nextInLine`).
6. **Cache invalidation:** Consolidates all `queryClient.invalidateQueries()` calls.

### 5.3 Interface (TypeScript)

```typescript
// src/hooks/useTaskDetails.ts

import { Task } from '../domain/entities/Task';
import { TaskDetail } from './useTasks';
import { Document } from '../domain/entities/Document';
import { Invoice } from '../domain/entities/Invoice';
import { ProgressLog } from '../domain/entities/ProgressLog';
import { AddDelayReasonFormData } from '../components/tasks/AddDelayReasonModal';
import { AddProgressLogFormData } from '../components/tasks/AddProgressLogModal';
import { SubcontractorContact } from '../components/tasks/SubcontractorPickerModal';

export interface SubcontractorInfo {
  id: string;
  name: string;
  trade?: string;
  phone?: string;
  email?: string;
}

export interface TaskDetailsViewModel {
  // Data state
  task: Task | null;
  taskDetail: TaskDetail | null;
  nextInLine: Task[];
  documents: Document[];
  subcontractorInfo: SubcontractorInfo | null;
  linkedInvoice: Invoice | null;
  hasQuotationRecord: boolean;
  loading: boolean;
  completing: boolean;
  uploadingDocument: boolean;

  // Modal state
  showDelayModal: boolean;
  showTaskPicker: boolean;
  showSubcontractorPicker: boolean;
  showAddLogModal: boolean;
  editingLog: ProgressLog | null;

  // Derived helpers
  isCompleted: boolean;
  delayReasonTypes: ReturnType<typeof useDelayReasonTypes>['delayReasonTypes'];

  // Actions
  handleComplete: () => Promise<void>;
  handleDelete: () => Promise<void>;
  handleStatusChange: (status: Task['status']) => Promise<void>;
  handlePriorityChange: (priority: NonNullable<Task['priority']>) => Promise<void>;
  handleAddDelayReason: (data: AddDelayReasonFormData) => Promise<void>;
  handleAddDependency: (selectedTaskId: string) => Promise<void>;
  handleRemoveDependency: (dependsOnTaskId: string) => Promise<void>;
  handleAddProgressLog: (data: AddProgressLogFormData) => Promise<void>;
  handleUpdateProgressLog: (data: AddProgressLogFormData) => Promise<void>;
  handleDeleteProgressLog: (logId: string) => Promise<void>;
  handleAddDocument: () => Promise<void>;
  handleSubcontractorSelect: (contact: SubcontractorContact | undefined) => Promise<void>;

  // Modal toggles
  openDelayModal: () => void;
  closeDelayModal: () => void;
  openTaskPicker: () => void;
  closeTaskPicker: () => void;
  openSubcontractorPicker: () => void;
  closeSubcontractorPicker: () => void;
  openAddLogModal: () => void;
  closeAddLogModal: () => void;
  setEditingLog: (log: ProgressLog | null) => void;
}

export function useTaskDetails(taskId: string): TaskDetailsViewModel;
```

### 5.4 Simplification to `TaskDetailsPage.tsx`

**Before** (~120 lines of wiring + state + handlers):
```typescript
import { container } from 'tsyringe';
import { AddTaskDocumentUseCase } from '../../application/usecases/document/AddTaskDocumentUseCase';
// 5 useMemo container.resolve blocks
// 12 useState declarations
// loadData, handleComplete, handleDelete, handleStatusChange, handlePriorityChange, …
```

**After** (single call):
```typescript
const vm = useTaskDetails(taskId);
```

All JSX bindings migrate to `vm.` prefix:
- `task` → `vm.task`
- `documents` → `vm.documents`
- `loading` → `vm.loading`
- `completing` → `vm.completing`
- `showDelayModal` → `vm.showDelayModal`
- `setShowDelayModal(false)` → `vm.closeDelayModal()`
- `handleComplete()` → `vm.handleComplete()`
- `subcontractorInfo` → `vm.subcontractorInfo`
- `isCompleted` → `vm.isCompleted`
- `delayReasonTypes` → `vm.delayReasonTypes`
- etc.

`import { container }` and `import { AddTaskDocumentUseCase }` are **deleted** from the component file.

---

## 6. File Change Inventory

| File | Change Type | Summary |
|------|-------------|---------|
| `src/hooks/useTaskScreen.ts` | **New file** | Facade encapsulating DI resolution for voice/camera services, view-mode state, and action handlers |
| `src/hooks/useTaskDetails.ts` | **New file** | Facade encapsulating DI resolution for 5 repositories, `AddTaskDocumentUseCase` wiring, `loadData` orchestration, all 15 modal/data state variables, and 12 action handlers |
| `src/pages/tasks/TaskScreen.tsx` | **Refactor** | Replaces ~50 lines of wiring/state with `const vm = useTaskScreen(options)`, removes 2 infrastructure imports and 2 `any`-typed props |
| `src/pages/tasks/TaskDetailsPage.tsx` | **Refactor** | Replaces ~120 lines of wiring/state/handlers with `const vm = useTaskDetails(taskId)`, removes `container` and `AddTaskDocumentUseCase` imports |

---

## 7. UI Design Constraints (mobile-ui agent review)

The following constraints were confirmed from the existing UI design (aligned with the audit
doc `issue-210-ui-architecture-audit.md` and the dashboard design doc):

### 7.1 `TaskScreen.tsx` — preserved exactly

- **Modal presentation:** `animationType="slide"` / `presentationStyle="pageSheet"` — unchanged
- **Three entry-point cards:** Voice, Manual, Camera — layout, spacing, and icons unchanged
- **Voice recording flow:** Stop button appears during `recording` phase, spinner during `parsing` — unchanged
- **Camera preview flow:** `TaskPhotoPreview` component receives same props (`photoUri`, `isLoading`, `onRetake`, `onConfirm`, `onCancel`) — unchanged
- **Form view:** `TaskForm` receives same `initialValues` / `onSuccess` / `onCancel` props — unchanged

### 7.2 `TaskDetailsPage.tsx` — preserved exactly

- **SafeAreaView + ScrollView structure** with `paddingBottom: isCompleted ? 24 : 120` — unchanged
- **Header layout** (back arrow, title, delete/edit icons) — unchanged
- **Section ordering** (Dates → Notes → Quotation → Progress → Subcontractor → Dependencies → Documents → StatusPriority → NextInLine) — unchanged per issue #136
- **Bottom sticky action button** (`Mark as Completed` with `CheckCircle` icon) — unchanged
- **All modal components** (`AddDelayReasonModal`, `AddProgressLogModal`, `TaskPickerModal`, `SubcontractorPickerModal`) — rendered with same props; only state source changes

---

## 8. TDD Acceptance Criteria

### 8.1 `useTaskScreen` unit tests
**File:** `__tests__/unit/hooks/useTaskScreen.test.ts`

- [ ] **Returns correct initial state:** `view === 'choose'`, `isCapturing === false`, `isCreatingTask === false`, `createdTask === null`, `voicePhase === 'idle'`.
- [ ] **DI fallback — `recorder`:** When `container.resolve('IAudioRecorder')` throws, `MockAudioRecorder` is used internally (verified via `startRecording` side-effect on the mock).
- [ ] **DI fallback — `voiceService`:** When `container.resolve('IVoiceParsingService')` throws, `MockVoiceParsingService` is used internally.
- [ ] **Prop override — `audioRecorder`:** When `options.audioRecorder` is provided, it is used instead of DI resolution.
- [ ] **Prop override — `voiceParsingService`:** When `options.voiceParsingService` is provided, it is used instead of DI resolution.
- [ ] **`handleStartVoice`:** Transitions `voicePhase` from `'idle'` to `'recording'`.
- [ ] **`handleStopVoice`:** Calls `stopAndParse()`; sets `initialDraft` from resolved `TaskDraft`; transitions `view` to `'form'`.
- [ ] **`handleStopVoice` error path:** When parsing throws, does NOT change `view`; propagates the error.
- [ ] **`handleManual`:** Sets `view` to `'form'`; sets `initialDraft` to `undefined`; sets `createdTask` to `null`.
- [ ] **`handleUseCamera`:** Sets `isCapturing` to `true` during capture; on successful capture sets `capturedUri` and `view` to `'preview'`; resets `isCapturing` to `false`.
- [ ] **`handleUseCamera` — cancelled capture:** When camera returns `null`, `view` stays `'choose'`.
- [ ] **`handleRetake`:** Replaces `capturedUri` with a new URI after a successful capture.
- [ ] **`handleConfirm`:** Sets `isCreatingTask` to `true` during use case execution; sets `createdTask` from result; transitions `view` to `'form'`.
- [ ] **`handleCancelPreview`:** Sets `capturedUri` to `null`; sets `view` to `'choose'`.
- [ ] **`cameraHook` prop override:** When `options.cameraHook` is provided it is used directly instead of `useCameraTask`.

### 8.2 `useTaskDetails` unit tests
**File:** `__tests__/unit/hooks/useTaskDetails.test.ts`

- [ ] **Returns correct initial loading state:** `loading === true`, `task === null`, `taskDetail === null`.
- [ ] **Data loaded successfully:** After `loadData` resolves, `task`, `taskDetail`, `documents`, `nextInLine` reflect mocked repository responses.
- [ ] **`subcontractorInfo` mapping:** When `task.subcontractorId` matches a contact, `subcontractorInfo` exposes `{ id, name, trade, phone, email }` in the `SubcontractorInfo` shape.
- [ ] **`isCompleted` derived value:** Returns `true` when `task.status === 'completed'`.
- [ ] **`handleComplete` — success path:** Calls `completeTask(taskId)`; triggers `navigation.goBack()`.
- [ ] **`handleComplete` — `PendingPaymentsForTaskError`:** Does NOT call `navigation.goBack()`; does NOT throw (error is handled internally via Alert).
- [ ] **`handleComplete` — `TaskCompletionValidationError`:** Does NOT call `navigation.goBack()`; does NOT throw.
- [ ] **`handleDelete`:** Calls `deleteTask(taskId)` after `confirm()` returns `true`; calls `navigation.goBack()`.
- [ ] **`handleDelete` — cancelled confirm:** When `confirm()` returns `false`, `deleteTask` is NOT called.
- [ ] **`handleStatusChange`:** Updates local `task.status` optimistically; calls `updateTask()`; calls `queryClient.invalidateQueries`.
- [ ] **`handleStatusChange` — failure:** Reverts `task.status` to original value when `updateTask()` throws.
- [ ] **`handlePriorityChange`:** Updates local `task.priority` optimistically; calls `updateTask()`; reverts on failure.
- [ ] **`handleAddDocument` — success path:** Calls `filePickerAdapter.pickDocument()`; creates `AddTaskDocumentUseCase`; calls `uc.execute()`; calls `loadData()` after upload.
- [ ] **`handleAddDocument` — cancelled pick:** When `result.cancelled === true`, use case is NOT instantiated.
- [ ] **`handleAddDocument` — missing adapters:** When `filePickerAdapter` or `fileSystemAdapter` is null, function returns early without throwing.
- [ ] **`handleAddDelayReason`:** Calls `addDelayReason()`; on success calls `closeDelayModal()`; calls `loadData()`.
- [ ] **`handleAddDependency`:** Calls `addDependency()`; calls `loadData()`.
- [ ] **`handleRemoveDependency`:** Calls `removeDependency()` after `confirm()` returns `true`; calls `loadData()`.
- [ ] **Modal toggles:** `openDelayModal()` / `closeDelayModal()`, `openTaskPicker()` / `closeTaskPicker()`, `openSubcontractorPicker()` / `closeSubcontractorPicker()`, `openAddLogModal()` / `closeAddLogModal()` correctly toggle their respective boolean state.
- [ ] **`setEditingLog`:** Sets `editingLog` to the provided `ProgressLog` instance; setting to `null` clears it.
- [ ] **Auto-trigger `openProgressLog`:** When route param `openProgressLog === true` and `loading` transitions to `false`, `showAddLogModal` is set to `true`.
- [ ] **Auto-trigger fires only once:** The auto-trigger guard (`autoTriggered.current`) prevents re-firing on subsequent re-renders.

### 8.3 `TaskScreen` integration test (layer-purity assertion)
**File:** `__tests__/unit/pages/TaskScreen.test.tsx`

- [ ] **Zero infrastructure imports:** The `TaskScreen` source file does NOT import from `infrastructure/` at any path depth.
- [ ] **Zero `container` import:** The `TaskScreen` source file does NOT import `container` from `tsyringe`.
- [ ] **Renders `choose` view by default:** When `useTaskScreen` mock returns `view === 'choose'`, three entry-point cards are visible.
- [ ] **Renders `preview` view:** When mock returns `view === 'preview'` with a `capturedUri`, `TaskPhotoPreview` is rendered.
- [ ] **Renders `form` view:** When mock returns `view === 'form'`, `TaskForm` is rendered.
- [ ] **Voice recording indicator:** Voice stop button is rendered when `voicePhase === 'recording'`.
- [ ] **Camera capturing spinner:** `ActivityIndicator` is rendered when `isCapturing === true`.

### 8.4 `TaskDetailsPage` integration test (layer-purity assertion)
**File:** `__tests__/unit/pages/TaskDetailsPage.test.tsx`

- [ ] **Zero infrastructure imports:** The `TaskDetailsPage` source file does NOT import from `infrastructure/` at any path depth.
- [ ] **Zero `container` import:** The `TaskDetailsPage` source file does NOT import `container` from `tsyringe`.
- [ ] **Zero use-case imports:** The `TaskDetailsPage` source file does NOT import from `application/usecases/`.
- [ ] **Loading state:** When `vm.loading === true`, an `ActivityIndicator` is rendered.
- [ ] **Not found state:** When `vm.task === null` and `vm.loading === false`, "Task not found" text is rendered.
- [ ] **Completed task — bottom button hidden:** When `vm.isCompleted === true`, the "Mark as Completed" button is NOT rendered.
- [ ] **Delete calls `vm.handleDelete`:** Pressing the delete `Pressable` invokes `vm.handleDelete`.
- [ ] **Complete calls `vm.handleComplete`:** Pressing the "Mark as Completed" button invokes `vm.handleComplete`.
