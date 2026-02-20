# Design: Voice Translator for Adhoc Task Entry (Issue #94)

**Date**: 2026-02-20  
**Branch**: `issue-94-voice-translator`  
**Status**: AGREED — ready for implementation

---

## 1. User Story

> As a builder, I want to tap a **Voice** button on any task form (create or edit), dictate the task details, and have the form pre-filled for my review — so I can enter tasks hands-free on site.

---

## 2. What Already Exists (post-pull review)

The branch already contains the core application-layer skeleton. **Do not re-create these.**

| File | Status | Notes |
|---|---|---|
| `src/application/services/IAudioRecorder.ts` | ✅ EXISTS | `startRecording() / stopRecording() → AudioRecording` |
| `src/application/services/IVoiceParsingService.ts` | ✅ EXISTS | `parseAudioToTaskDraft(ArrayBuffer) → TaskDraft`; also defines `TaskDraft` |
| `src/application/usecases/task/ParseVoiceTaskUseCase.ts` | ✅ EXISTS | Owns `startRecording` + `stopAndParse` lifecycle |
| `src/hooks/useVoiceTask.ts` | ✅ EXISTS | State machine: `idle → recording → parsing → done/error` |
| `src/infrastructure/voice/MockAudioRecorder.ts` | ✅ EXISTS | Returns empty `ArrayBuffer`, 1 000 ms |
| `src/infrastructure/voice/MockVoiceParsingService.ts` | ✅ EXISTS | Returns deterministic `TaskDraft` preset |

**What is still missing (scope of this PR):**

| File | Status |
|---|---|
| `src/infrastructure/voice/MobileAudioRecorder.ts` | ❌ ADD — concrete recording impl |
| `src/infrastructure/voice/RemoteVoiceParsingService.ts` | ❌ ADD — skeleton (not wired) |
| `useVoiceTask` — timer, max-duration, `cancel` | ❌ MODIFY |
| DI registration (`IAudioRecorder`, `IVoiceParsingService`) | ❌ MODIFY |
| `CreateTaskPage.tsx` — Voice button + overlay + draft wiring | ❌ MODIFY |
| `EditTaskPage.tsx` — Voice button + overlay + draft merge | ❌ MODIFY |
| `__tests__/unit/ParseVoiceTaskUseCase.test.ts` | ❌ ADD |
| `__tests__/integration/TaskPage.voice.integration.test.tsx` | ❌ ADD |

---

## 3. Scope

**In Scope**
- `MobileAudioRecorder` — records audio to cache file, converts to `ArrayBuffer`, deletes temp file
- `RemoteVoiceParsingService` skeleton — HTTP multipart stub (throws `not implemented`)
- Timer + max-duration enforcement + `cancel` added to `useVoiceTask` hook
- DI registration for `IAudioRecorder` / `IVoiceParsingService` (mocks wired for this PR, approved)
- Voice button + `RecordingOverlay` on **both** `CreateTaskPage` and `EditTaskPage` (approved)
- `TaskForm` mapping verification (`TaskDraft` → `Partial<Task>`) — no prop change needed
- Unit test: `ParseVoiceTaskUseCase` with mocks
- Integration test: voice flow with mocks on both pages

**Out of Scope**
- Real STT backend implementation
- Streaming / chunked audio upload
- Consent/telemetry UI (deferred)

---

## 4. Why Voice Belongs on Both Pages

`CreateTaskPage` and `EditTaskPage` both render the same `TaskForm` with the same fields. The voice draft pre-fills exactly those fields (`title`, `notes`, `dueDate`, `priority`, `trade`, `durationEstimate`). The only implementation difference is:

| Page | Voice draft behaviour |
|---|---|
| `CreateTaskPage` | Draft becomes `initialValues` directly |
| `EditTaskPage` | Draft is **merged over** existing task values: `{ ...existingTask, ...draft }` — only non-undefined draft fields override |

---

## 5. Architecture Overview

```
CreateTaskPage / EditTaskPage
  └─ useVoiceTask(recorder, voiceService)      ← EXISTS — being extended
       ├─ timer + maxSeconds + cancel          ← ADD
       └─ ParseVoiceTaskUseCase               ← EXISTS — no change
            ├─ IAudioRecorder                 ← EXISTS (port)
            │    ├─ MockAudioRecorder         ← EXISTS (test + DI for this PR)
            │    └─ MobileAudioRecorder       ← ADD (concrete)
            └─ IVoiceParsingService           ← EXISTS (port)
                 ├─ MockVoiceParsingService   ← EXISTS (test + DI for this PR)
                 └─ RemoteVoiceParsingService ← ADD (skeleton, future)
```

---

## 6. Existing Interfaces (reference — do not modify)

### `IAudioRecorder` — `src/application/services/IAudioRecorder.ts`

```ts
export interface AudioRecording {
  data: ArrayBuffer;
  mimeType: string;
  durationMs: number;
}

export interface IAudioRecorder {
  startRecording(): Promise<void>;
  stopRecording(): Promise<AudioRecording>;
}
```

### `IVoiceParsingService` + `TaskDraft` — `src/application/services/IVoiceParsingService.ts`

```ts
export type TaskDraft = {
  title?: string;
  notes?: string;            // → Task.notes
  dueDate?: string;          // ISO → Task.dueDate
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  trade?: string;            // → Task.trade
  durationEstimate?: number; // hours → Task.durationEstimate
};

export interface IVoiceParsingService {
  parseAudioToTaskDraft(audio: ArrayBuffer): Promise<TaskDraft>;
}
```

`TaskDraft` fields map **1:1** onto `Task` entity fields — no adapter needed at the call site.

### `ParseVoiceTaskUseCase` — `src/application/usecases/task/ParseVoiceTaskUseCase.ts`

```ts
export class ParseVoiceTaskUseCase {
  constructor(
    private readonly recorder: IAudioRecorder,
    private readonly voiceService: IVoiceParsingService,
  ) {}

  async startRecording(): Promise<void> {
    await this.recorder.startRecording();
  }

  async stopAndParse(): Promise<TaskDraft> {
    const recording = await this.recorder.stopRecording();
    return this.voiceService.parseAudioToTaskDraft(recording.data);
  }
}
```

---

## 7. Concrete Implementations to Add

### 7a. `MobileAudioRecorder` — `src/infrastructure/voice/MobileAudioRecorder.ts`

**New dependency**: `react-native-audio-recorder-player` (✅ approved). Requires microphone permission in `AndroidManifest.xml` and `Info.plist`.

```ts
import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import RNFS from 'react-native-fs';
import { IAudioRecorder, AudioRecording } from '../../application/services/IAudioRecorder';

export class MobileAudioRecorder implements IAudioRecorder {
  private recorder = new AudioRecorderPlayer();
  private currentPath: string | null = null;

  async startRecording(): Promise<void> {
    this.currentPath = `${RNFS.CachesDirectoryPath}/voice-${Date.now()}.mp4`;
    await this.recorder.startRecorder(this.currentPath);
  }

  async stopRecording(): Promise<AudioRecording> {
    const durationMs = await this.recorder.stopRecorder();
    const path = this.currentPath;
    this.currentPath = null;
    if (!path) throw new Error('No active recording');

    const b64 = await RNFS.readFile(path, 'base64');
    await RNFS.unlink(path); // temp file deleted here, before returning

    const binary = atob(b64);
    const buf = new ArrayBuffer(binary.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);

    return { data: buf, mimeType: 'audio/mp4', durationMs: Number(durationMs) };
  }
}
```

Format: `audio/mp4` (AAC) — default output of the library on iOS and Android, accepted by all major STT services.

### 7b. `RemoteVoiceParsingService` — `src/infrastructure/voice/RemoteVoiceParsingService.ts`

Skeleton only. Calls `POST /api/voice/parse` (multipart), expects `TaskDraft` JSON. Not wired in DI for this PR.

```ts
import { IVoiceParsingService, TaskDraft } from '../../application/services/IVoiceParsingService';

export class RemoteVoiceParsingService implements IVoiceParsingService {
  constructor(private readonly baseUrl: string) {}

  async parseAudioToTaskDraft(audio: ArrayBuffer): Promise<TaskDraft> {
    const form = new FormData();
    form.append('audio', new Blob([audio], { type: 'audio/mp4' }), 'recording.mp4');
    const res = await fetch(`${this.baseUrl}/api/voice/parse`, { method: 'POST', body: form });
    if (!res.ok) throw new Error(`Voice parse failed: ${res.status}`);
    return res.json() as Promise<TaskDraft>;
  }
}
```

---

## 8. Hook Changes: `useVoiceTask`

Add `elapsedSeconds`, `maxSeconds`, auto-stop timer, and `cancel` to the existing `src/hooks/useVoiceTask.ts`.

```ts
export const MAX_RECORDING_SECONDS = 60;

export function useVoiceTask(
  recorder: IAudioRecorder,
  voiceService: IVoiceParsingService,
  maxSeconds = MAX_RECORDING_SECONDS,
) {
  const [state, setState] = useState<VoiceTaskState>({ phase: 'idle' });
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const useCase = useMemo(() => new ParseVoiceTaskUseCase(recorder, voiceService), [recorder, voiceService]);

  const _clearTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const stopAndParse = useCallback(async () => {
    _clearTimer();
    setState({ phase: 'parsing' });
    try {
      const draft = await useCase.stopAndParse();
      setState({ phase: 'done', draft });
      return draft;
    } catch (e: any) {
      setState({ phase: 'error', message: e?.message ?? 'Voice parsing failed' });
      throw e;
    }
  }, [useCase, _clearTimer]);

  const startRecording = useCallback(async () => {
    setElapsedSeconds(0);
    setState({ phase: 'recording' });
    await useCase.startRecording();
    timerRef.current = setInterval(() => {
      setElapsedSeconds(prev => {
        if (prev + 1 >= maxSeconds) stopAndParse();
        return prev + 1;
      });
    }, 1000);
  }, [useCase, maxSeconds, stopAndParse]);

  const cancel = useCallback(async () => {
    _clearTimer();
    await recorder.stopRecording().catch(() => {}); // discards ArrayBuffer, deletes temp file
    setState({ phase: 'idle' });
    setElapsedSeconds(0);
  }, [recorder, _clearTimer]);

  return { state, elapsedSeconds, maxSeconds, startRecording, stopAndParse, cancel } as const;
}
```

---

## 9. DI Registration

Add to `src/infrastructure/di/registerServices.ts` (✅ approved — mocks wired in app for this PR):

```ts
import { MockAudioRecorder } from '../voice/MockAudioRecorder';
import { MockVoiceParsingService } from '../voice/MockVoiceParsingService';

container.registerSingleton('IAudioRecorder', MockAudioRecorder);
container.registerSingleton('IVoiceParsingService', MockVoiceParsingService);
```

Swap to `MobileAudioRecorder` + `RemoteVoiceParsingService` in a follow-up PR.

---

## 10. UI Integration

Both pages use the same recording overlay. The only difference is how the draft is applied.

### Shared recording overlay flow

```
[Voice 🎤] button pressed
  → startRecording()
  → RecordingOverlay:  "Recording...  00:42 / 01:00"   [Stop]  [Cancel]
                        progress bar (elapsedSeconds / maxSeconds)

[Stop] / auto-stop at 60 s
  → stopAndParse()
  → spinner "Parsing..."
  → on done:  apply draft (see below), hide overlay
  → on error: Alert("Could not parse voice. Try again."), return to idle

[Cancel]
  → cancel()  — stops recorder, deletes temp file, returns to idle
```

### `CreateTaskPage` — draft application

```tsx
// state.phase === 'done'
<TaskForm initialValues={state.draft} onSubmit={handleCreate} onCancel={...} />
```

### `EditTaskPage` — draft merged over existing task

```tsx
// state.phase === 'done'
const merged = {
  ...task,
  ...Object.fromEntries(Object.entries(state.draft).filter(([, v]) => v !== undefined)),
};
<TaskForm initialValues={merged} onSubmit={handleUpdate} onCancel={...} />
```

Only fields voice actually returned override the saved task; the rest remain unchanged.

### `TaskForm` — no change required

`TaskDraft` fields map 1:1 onto `Task`:

| `TaskDraft` field | `Task` field |
|---|---|
| `title` | `title` |
| `notes` | `notes` |
| `dueDate` | `dueDate` |
| `priority` | `priority` |
| `trade` | `trade` |
| `durationEstimate` | `durationEstimate` |

---

## 11. Audio Storage & Format

| Setting | Value | Rationale |
|---|---|---|
| Recording library | `react-native-audio-recorder-player` | Approved; cross-platform, no extra native config |
| Container/codec | AAC / MP4 | Default library output; supported by all STT services |
| Max duration | 60 s (`MAX_RECORDING_SECONDS`) | ~1 MB AAC; keeps latency and upload cost low |
| Storage | In-memory `ArrayBuffer` | Temp file written by recorder, deleted inside `stopRecording()` |
| Cleanup on cancel | `cancel()` → `recorder.stopRecording()` → file deleted | No audio persists on device |

---

## 12. End-to-End Flow (concrete)

```
User taps [Voice] (CreateTaskPage or EditTaskPage)
  → useVoiceTask.startRecording()
  → MobileAudioRecorder writes RNFS.CachesDirectoryPath/voice-<ts>.mp4

[timer ticks 00:01 ... 01:00, then auto-stops]

User taps [Stop]
  → useVoiceTask.stopAndParse()
  → MobileAudioRecorder.stopRecording()
       reads .mp4 → ArrayBuffer,  RNFS.unlink(path)  ← file gone
  → MockVoiceParsingService.parseAudioToTaskDraft(ArrayBuffer)
       returns deterministic TaskDraft
  [future: RemoteVoiceParsingService → POST /api/voice/parse → TaskDraft]
  → state = { phase: 'done', draft }

CreateTaskPage: TaskForm re-renders with initialValues = draft
EditTaskPage:   TaskForm re-renders with initialValues = { ...task, ...draft }

User reviews pre-filled form → submits → task created / updated
```

---

## 13. File Map

```
src/
  application/
    services/
      IAudioRecorder.ts               ✅ EXISTS — no change
      IVoiceParsingService.ts         ✅ EXISTS — no change
    usecases/
      task/
        ParseVoiceTaskUseCase.ts      ✅ EXISTS — no change
  infrastructure/
    voice/
      MockAudioRecorder.ts            ✅ EXISTS — no change
      MockVoiceParsingService.ts      ✅ EXISTS — no change
      MobileAudioRecorder.ts          ❌ ADD
      RemoteVoiceParsingService.ts    ❌ ADD (skeleton)
    di/
      registerServices.ts             ❌ MODIFY: register IAudioRecorder + IVoiceParsingService
  hooks/
    useVoiceTask.ts                   ❌ MODIFY: timer, elapsedSeconds, cancel
  pages/
    tasks/
      CreateTaskPage.tsx              ❌ MODIFY: Voice button + overlay + initialValues = draft
      EditTaskPage.tsx                ❌ MODIFY: Voice button + overlay + merged draft
  components/
    tasks/
      TaskForm.tsx                    ✅ NO CHANGE

__tests__/
  unit/
    ParseVoiceTaskUseCase.test.ts     ❌ ADD
  integration/
    TaskPage.voice.integration.test.tsx  ❌ ADD (create + edit flows)
```

---

## 14. Acceptance Criteria

- [ ] Tapping **Voice** on `CreateTaskPage` or `EditTaskPage` starts recording; timer and Stop/Cancel appear.
- [ ] Timer counts up to `maxSeconds` (60 s); recording auto-stops and parsing begins at the limit.
- [ ] On success, `CreateTaskPage` pre-fills `TaskForm` from the draft; `EditTaskPage` merges draft over existing task (undefined fields preserved).
- [ ] On parse failure, an `Alert` is shown and the user returns to idle.
- [ ] Temp audio file is deleted inside `MobileAudioRecorder.stopRecording()` before returning.
- [ ] `cancel()` stops the recorder (deletes temp file) and returns to idle without parsing.
- [ ] `MockVoiceParsingService` + `MockAudioRecorder` make the full test suite offline.
- [ ] Unit: `ParseVoiceTaskUseCase.stopAndParse()` returns expected `TaskDraft`.
- [ ] Integration: voice flow on both create and edit renders correctly pre-filled `TaskForm`.

---

## 15. Implementation Order (TDD)

1. Add `MobileAudioRecorder` + unit test skeleton
2. Add `RemoteVoiceParsingService` skeleton
3. Unit test: `ParseVoiceTaskUseCase` with `MockAudioRecorder` + `MockVoiceParsingService`
4. Modify `useVoiceTask` — timer, `elapsedSeconds`, `cancel`
5. Register `IAudioRecorder` / `IVoiceParsingService` in `registerServices.ts`
6. Modify `CreateTaskPage` — Voice button, overlay, `initialValues = draft`
7. Modify `EditTaskPage` — Voice button, overlay, `{ ...task, ...draft }`
8. Integration test: `TaskPage.voice.integration.test.tsx` (create + edit)
