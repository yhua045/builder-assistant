# Design: Issue #93 — Wire "Adhoc Task" Button (Voice + Manual Entry)

**Date**: 2026-02-20  
**Branch**: `issue-93-adhoc-task`  
**Status**: Awaiting approval before implementation

---

## 1. User Story

> As a dashboard user, when I tap the **"Ad Hoc Task"** quick-action button, I want to reach a `TaskScreen` that lets me either dictate the task by voice (which auto-fills the form) or enter it manually — so I can quickly capture tasks without navigating away from the dashboard.

---

## 2. Scope

### Included
- Wire "Ad Hoc Task" (quickAction id `'5'`) in `DashboardScreen` to open a modal `TaskScreen`.
- `TaskScreen` shows **Voice** and **Manual entry** entry-mode choices.
- **Manual** flow: opens `TaskForm` with empty `initialValues`.
- **Voice** flow: starts/stops audio recording → calls `ParseVoiceTaskUseCase` → pre-fills `TaskForm` with returned `TaskDraft`.
- `IVoiceParsingService` application-level port (interface).
- `ParseVoiceTaskUseCase` use case.
- `MockVoiceParsingService` stub (dev + tests).
- `IAudioRecorder` port + `MockAudioRecorder` stub — thin abstraction over native recording so UI tests are hermetic.
- Unit tests for `ParseVoiceTaskUseCase`.
- Integration tests for `TaskScreen` (entry-mode selection, manual open, voice pre-fill).
- Update `TaskForm` to accept `TaskDraft` as `initialValues` (via type union — see §5).

### Excluded
- Real voice/NLP backend implementation.
- Real native audio recording module integration (that can follow in a later ticket using the `IAudioRecorder` port).
- New navigation routes (we use the existing modal pattern, consistent with `InvoiceScreen`/`SnapReceiptScreen`).

---

## 3. Architecture Overview

Following the Clean Architecture dependency rule (UI → Hooks → Use Cases → Domain):

```
DashboardScreen
  └─ Modal → TaskScreen (new)
               ├─ [Manual] → TaskForm (existing, unchanged Props)
               └─ [Voice]  → useVoiceTask hook (new)
                               └─ ParseVoiceTaskUseCase (new)
                                    └─ IVoiceParsingService (port, new)
                                         └─ MockVoiceParsingService (stub, new)
                                              (prod: RealVoiceParsingService — future)
                   IAudioRecorder (port, new)
                    └─ MockAudioRecorder (stub)
                         (prod: NativeAudioRecorder — future)
```

---

## 4. New File Inventory

| Path | Type | Description |
|---|---|---|
| `src/application/services/IVoiceParsingService.ts` | Interface | Port: audio → TaskDraft |
| `src/application/services/IAudioRecorder.ts` | Interface | Port: start/stop recording → audio bytes |
| `src/application/usecases/task/ParseVoiceTaskUseCase.ts` | Use Case | Orchestrates recording result → TaskDraft |
| `src/infrastructure/voice/MockVoiceParsingService.ts` | Stub | Returns deterministic TaskDraft for tests/dev |
| `src/infrastructure/voice/MockAudioRecorder.ts` | Stub | Returns deterministic audio buffer for tests/dev |
| `src/pages/tasks/TaskScreen.tsx` | Screen | Modal screen with Voice/Manual choice + orchestration |
| `src/hooks/useVoiceTask.ts` | Hook | Manages recording state + calls ParseVoiceTaskUseCase |

---

## 5. Contracts / Interfaces

### 5a. `TaskDraft`
Defined alongside `IVoiceParsingService`. Mapped fields correspond directly to writable fields on the existing `Task` domain entity:

```ts
// src/application/services/IVoiceParsingService.ts

export type TaskDraft = {
  title?: string;
  notes?: string;          // maps to Task.notes
  dueDate?: string;        // ISO 8601
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  trade?: string;
  durationEstimate?: number; // hours
};

export interface IVoiceParsingService {
  /** Parse raw audio bytes into structured task fields. */
  parseAudioToTaskDraft(audio: ArrayBuffer): Promise<TaskDraft>;
}
```

> **Note**: `description` from the issue proposal is omitted — the `Task` entity uses `notes` for free-text; we align with the existing entity to avoid drift.

### 5b. `IAudioRecorder`

```ts
// src/application/services/IAudioRecorder.ts

export interface AudioRecording {
  /** Raw PCM / encoded audio bytes ready for upload. */
  data: ArrayBuffer;
  /** MIME type, e.g. "audio/m4a" or "audio/wav". */
  mimeType: string;
  durationMs: number;
}

export interface IAudioRecorder {
  /** Begin microphone capture. Resolves when recording has started. */
  startRecording(): Promise<void>;
  /** Stop microphone capture and return the recorded audio. */
  stopRecording(): Promise<AudioRecording>;
}
```

### 5c. `ParseVoiceTaskUseCase`

```ts
// src/application/usecases/task/ParseVoiceTaskUseCase.ts

export class ParseVoiceTaskUseCase {
  constructor(
    private readonly recorder: IAudioRecorder,
    private readonly voiceService: IVoiceParsingService
  ) {}

  /** Record audio then parse it; returns TaskDraft. */
  async execute(): Promise<TaskDraft> {
    await this.recorder.startRecording();
    // UI calls stopAndParse() separately after user taps "Stop"
    throw new Error('Use startRecording() / stopAndParse() separately');
  }

  async startRecording(): Promise<void> {
    await this.recorder.startRecording();
  }

  async stopAndParse(): Promise<TaskDraft> {
    const recording = await this.recorder.stopRecording();
    return this.voiceService.parseAudioToTaskDraft(recording.data);
  }
}
```

> The use case exposes `startRecording()` and `stopAndParse()` as two separate steps matching the two-tap UI flow (tap to start → tap to stop).

### 5d. `TaskForm` — `initialValues` type change
`TaskForm` currently accepts `initialValues?: Partial<Task>`. `TaskDraft` fields are a subset of `Task`, so we simply **widen** the prop type:

```ts
// BEFORE
initialValues?: Partial<Task>

// AFTER — src/components/tasks/TaskForm.tsx
import { TaskDraft } from '../../application/services/IVoiceParsingService';
initialValues?: Partial<Task> | TaskDraft
```

Internally the component already reads individual fields via optional chaining (`initialValues?.title || ''`), so the change is backward-compatible and requires no internal logic change. A small type-cast helper maps `TaskDraft → Partial<Task>` for cleanliness:

```ts
function taskDraftToPartialTask(draft: TaskDraft): Partial<Task> {
  return {
    title: draft.title,
    notes: draft.notes,
    dueDate: draft.dueDate,
    priority: draft.priority,
    trade: draft.trade,
    durationEstimate: draft.durationEstimate,
  };
}
```

### 5e. `TaskScreen` props

```ts
interface TaskScreenProps {
  onClose: () => void;
  /** DI — defaults to MockAudioRecorder in dev, NativeAudioRecorder in prod */
  audioRecorder?: IAudioRecorder;
  /** DI — defaults to MockVoiceParsingService in dev */
  voiceParsingService?: IVoiceParsingService;
}
```

### 5f. Stubs

```ts
// src/infrastructure/voice/MockVoiceParsingService.ts
export class MockVoiceParsingService implements IVoiceParsingService {
  constructor(private readonly preset: TaskDraft = { title: 'Mock Task', priority: 'medium' }) {}
  async parseAudioToTaskDraft(_audio: ArrayBuffer): Promise<TaskDraft> {
    return { ...this.preset };
  }
}

// src/infrastructure/voice/MockAudioRecorder.ts
export class MockAudioRecorder implements IAudioRecorder {
  async startRecording(): Promise<void> { /* no-op */ }
  async stopRecording(): Promise<AudioRecording> {
    return { data: new ArrayBuffer(0), mimeType: 'audio/wav', durationMs: 1000 };
  }
}
```

---

## 6. UI Flow

```
Dashboard → FAB (+) → Quick Actions sheet
  → tap "Ad Hoc Task"
    → Modal opens TaskScreen
      ┌─────────────────────────────────────────┐
      │         Add Task                    [X] │
      │                                         │
      │  ┌──────────────┐  ┌──────────────┐    │
      │  │  🎤 Voice     │  │  ✏️ Manual   │    │
      │  │  Dictate      │  │  Entry       │    │
      │  └──────────────┘  └──────────────┘    │
      └─────────────────────────────────────────┘

Voice path:
  tap "Voice"
  → button becomes "🔴 Recording... Tap to Stop"
  → tap "Stop"
  → spinner ("Parsing…")
  → TaskForm rendered with pre-filled values
  → user edits → Save → onClose()

Manual path:
  tap "Manual Entry"
  → TaskForm rendered with empty values
  → user fills → Save → onClose()
```

**Entry-mode view states** (local to `TaskScreen`):
```
'choose' → 'recording' → 'parsing' → 'form'
                 or
'choose' → 'form'   (manual path)
```

---

## 7. Dashboard Wiring Change

In `src/pages/dashboard/index.tsx`:

1. Add `showAdHocTask` state (`useState(false)`).
2. In `handleQuickAction`, handle `actionId === '5'` → `setShowAdHocTask(true)`.
3. Add a `<Modal>` (same pattern as "Add Invoice" modal) wrapping `<TaskScreen onClose={() => setShowAdHocTask(false)} />`.
4. In dev/test, pass `MockAudioRecorder` and `MockVoiceParsingService` as props; in production, omit (TaskScreen defaults to stubs for now until real adapters exist).

---

## 8. Hook: `useVoiceTask`

```ts
// src/hooks/useVoiceTask.ts

export type VoiceTaskState =
  | { phase: 'idle' }
  | { phase: 'recording' }
  | { phase: 'parsing' }
  | { phase: 'done'; draft: TaskDraft }
  | { phase: 'error'; message: string };

export function useVoiceTask(recorder: IAudioRecorder, voiceService: IVoiceParsingService) {
  const [state, setState] = useState<VoiceTaskState>({ phase: 'idle' });
  const useCase = useMemo(
    () => new ParseVoiceTaskUseCase(recorder, voiceService),
    [recorder, voiceService]
  );

  const startRecording = useCallback(async () => {
    setState({ phase: 'recording' });
    await useCase.startRecording();
  }, [useCase]);

  const stopAndParse = useCallback(async () => {
    setState({ phase: 'parsing' });
    try {
      const draft = await useCase.stopAndParse();
      setState({ phase: 'done', draft });
    } catch (e: any) {
      setState({ phase: 'error', message: e.message ?? 'Voice parsing failed' });
    }
  }, [useCase]);

  return { state, startRecording, stopAndParse };
}
```

---

## 9. Test Plan

### 9a. Unit tests — `ParseVoiceTaskUseCase`
File: `__tests__/unit/ParseVoiceTaskUseCase.test.ts`

| Test | Assertion |
|---|---|
| `startRecording` delegates to `IAudioRecorder.startRecording` | mock spy called once |
| `stopAndParse` calls `IAudioRecorder.stopRecording` then `IVoiceParsingService.parseAudioToTaskDraft` with the recording data | mock spies called in order; returned draft equals mock preset |
| When `parseAudioToTaskDraft` throws, `stopAndParse` propagates the error | error rethrown |

### 9b. Unit tests — `useVoiceTask` hook
File: `__tests__/unit/useVoiceTask.test.ts`

| Test | Assertion |
|---|---|
| Initial state is `{ phase: 'idle' }` | state check |
| After `startRecording()` state transitions to `{ phase: 'recording' }` | state check |
| After `stopAndParse()` state transitions to `{ phase: 'done', draft }` | draft equals mock preset |
| When parsing fails, state transitions to `{ phase: 'error' }` | error message present |

### 9c. Integration tests — `TaskScreen` UI
File: `__tests__/integration/TaskScreen.integration.test.tsx`

| Test | Assertion |
|---|---|
| Renders "Voice" and "Manual Entry" buttons in `choose` phase | both buttons present |
| Tapping "Manual Entry" renders `TaskForm` with empty fields | `TaskForm` rendered; title input is empty |
| Tapping "Voice" shows recording state, then "Stop Recording" button | state transitions visible |
| Tapping "Stop" completes voice flow → `TaskForm` rendered with `MockVoiceParsingService` preset values | title input value equals `'Mock Task'` |
| TaskScreen passes through `onClose` to form's cancel | `onClose` spy called |

### 9d. Integration tests — Dashboard wiring
File: `__tests__/integration/DashboardAdHocTask.integration.test.tsx`

| Test | Assertion |
|---|---|
| Tapping "Ad Hoc Task" quick action opens `TaskScreen` modal | `TaskScreen` in tree |
| Closing `TaskScreen` (onClose) hides the modal | `TaskScreen` removed from tree |

---

## 10. Acceptance Criteria Mapping

| # | Acceptance Criterion | Covered By |
|---|---|---|
| AC1 | `Adhoc Task` button triggers opening of `TaskScreen` | Dashboard integration test §9d |
| AC2 | `TaskScreen` displays `Voice` and `Manual entry` options | TaskScreen unit §9c |
| AC3 | `Manual entry` opens `TaskForm` with empty fields | TaskScreen unit §9c |
| AC4 | `Voice` begins/stops recording and calls voice parsing use case | useVoiceTask unit §9b |
| AC5 | When voice parsing returns `TaskDraft`, `TaskForm` is pre-filled | TaskScreen integration §9c |
| AC6 | A mock `IVoiceParsingService` exists for tests | `MockVoiceParsingService` §5f |

---

## 11. Implementation Steps (in order)

1. **`IVoiceParsingService.ts`** — interface + `TaskDraft` type  
2. **`IAudioRecorder.ts`** — interface + `AudioRecording` type  
3. **`ParseVoiceTaskUseCase.ts`** — use case (start / stopAndParse)  
4. **`MockVoiceParsingService.ts`** + **`MockAudioRecorder.ts`** — stubs  
5. **Unit tests** for use case + hook (§9a, §9b) — write failing tests first  
6. **`useVoiceTask.ts`** hook — make unit tests pass  
7. **`TaskForm.tsx`** — widen `initialValues` type + `taskDraftToPartialTask` helper  
8. **`TaskScreen.tsx`** — new modal screen  
9. **Integration tests** (§9c) — write failing tests first  
10. **Dashboard wiring** — add state, handle action `'5'`, add Modal  
11. **Dashboard integration tests** (§9d)  
12. **Typecheck** `npx tsc --noEmit`  

---

## 12. Open Questions

1. **Audio recording in production**: Should the real `IAudioRecorder` adapter be tracked as a follow-up ticket immediately, or deferred until a voice NLP backend is chosen?  ***A*** deferred.
2. **`TaskScreen` — modal vs navigator route**: The issue allows either. Proposal is `Modal` (consistent with `InvoiceScreen` on Dashboard). Is this acceptable, or should `TaskScreen` also be a route inside `TasksNavigator` for deeper navigation?  ***A*** Modal for now, can refactor to route later if needed.
3. **`TaskDraft` location**: Placed in `src/application/services/IVoiceParsingService.ts` (co-located with the port). Alternatively it could live in `src/domain/` as a value object. Preference?  ***A*** Co-located with the port for now, since it's tightly coupled to the voice parsing service's contract.

---
