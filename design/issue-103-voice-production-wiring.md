# Design: Complete Voice Task Entry — Production Wiring (Issue #103)

**Date**: 2026-02-23  
**Branch**: `issue-103`  
**Status**: APPROVED — ready for implementation

---

## 1. User Story

> As a builder using a real iOS or Android device, I want the Voice task entry feature to use my device microphone and a real Speech-to-Text backend — so that spoken task details are accurately converted into a pre-filled `TaskForm`, ready for review and save.

---

## 2. Context & What Already Exists

Issue #94 scaffolded and tested the voice feature with mocks. The following are already in place and **must not change**:

| File | Status |
|------|--------|
| `src/application/services/IAudioRecorder.ts` | ✅ EXISTS — port interface |
| `src/application/services/IVoiceParsingService.ts` | ✅ EXISTS — port interface + `TaskDraft` type |
| `src/application/usecases/task/ParseVoiceTaskUseCase.ts` | ✅ EXISTS — unchanged |
| `src/hooks/useVoiceTask.ts` | ✅ EXISTS — timer, cancel, state machine |
| `src/infrastructure/voice/MockAudioRecorder.ts` | ✅ EXISTS — kept for tests |
| `src/infrastructure/voice/MockVoiceParsingService.ts` | ✅ EXISTS — kept for tests |
| `src/infrastructure/voice/MobileAudioRecorder.ts` | ✅ EXISTS — concrete recorder |
| `src/infrastructure/voice/RemoteVoiceParsingService.ts` | ✅ EXISTS — skeleton only (no auth, retries, timeout) |
| `src/infrastructure/di/registerServices.ts` | ✅ EXISTS — still wired to **Mocks** |
| `__tests__/unit/ParseVoiceTaskUseCase.test.ts` | ✅ EXISTS |
| `__tests__/integration/TaskPage.voice.integration.test.tsx` | ✅ EXISTS |
| Voice button + `RecordingOverlay` on both task pages | ✅ EXISTS |

**What is still missing (scope of this PR):**

| Item | Location | Action |
|------|----------|--------|
| `NSMicrophoneUsageDescription` | `ios/BuilderAssistantApp/Info.plist` | ADD |
| `RECORD_AUDIO` permission | `android/app/src/main/AndroidManifest.xml` | ADD |
| CocoaPods linkage | `ios/` — run after clone | DOCUMENT in README/dev notes |
| `ISTTAdapter` port interface | `src/application/services/ISTTAdapter.ts` | ADD — new internal port |
| `ITranscriptParser` port interface | `src/application/services/ITranscriptParser.ts` | ADD — new internal port |
| `GroqSTTAdapter` (Whisper large-v3) | `src/infrastructure/voice/GroqSTTAdapter.ts` | ADD — Groq STT adapter |
| `GroqTranscriptParser` (Llama 3.3 70B) | `src/infrastructure/voice/GroqTranscriptParser.ts` | ADD — Groq LLM parser |
| Production `RemoteVoiceParsingService` implementation | `src/infrastructure/voice/RemoteVoiceParsingService.ts` | MODIFY — add adapter composition, retries, timeout |
| `MobileAudioRecorder` wired in DI (with permission gating) | `src/infrastructure/di/registerServices.ts` | MODIFY |
| Feature flag for prod/mock toggle | `src/infrastructure/di/registerServices.ts` | ADD |
| Unit tests for new adapters | `__tests__/unit/GroqSTTAdapter.test.ts`, `__tests__/unit/GroqTranscriptParser.test.ts`, `__tests__/unit/RemoteVoiceParsingService.test.ts` | ADD |
| On-device QA checklist | This document § 8 | REFERENCE |

---

## 3. Acceptance Criteria

- [ ] iOS and Android device builds prompt for microphone permission; recording succeeds on-device.
- [ ] `MobileAudioRecorder` is registered in the DI container for production builds; `MockAudioRecorder` remains for tests.
- [ ] A feature flag (`VOICE_USE_MOCK_PARSER`) lets the team toggle away from the real STT backend during development/CI.
- [ ] `RemoteVoiceParsingService` orchestrates `ISTTAdapter` (audio → transcript) and `ITranscriptParser` (transcript → `TaskDraft`) with retries and timeout per step.
- [ ] `GroqSTTAdapter` POSTs audio to Groq's Whisper API and returns a transcript string.
- [ ] `GroqTranscriptParser` sends the transcript to Groq's Chat Completions API (Llama 3.3 70B) and returns a structured `TaskDraft`.
- [ ] Temp audio files are never retained on device past the `stopRecording()` call (existing `MobileAudioRecorder` guarantee — verify in QA).
- [ ] New unit tests cover: `GroqSTTAdapter` success/error, `GroqTranscriptParser` success/malformed JSON, `RemoteVoiceParsingService` orchestration with both adapters mocked.
- [ ] QA sign-off on iOS and Android for the flows listed in § 8.

---

## 4. Scope

**In Scope**
- iOS `Info.plist` — add `NSMicrophoneUsageDescription`
- Android `AndroidManifest.xml` — add `RECORD_AUDIO` permission
- `ISTTAdapter` + `ITranscriptParser` — two new internal port interfaces
- `GroqSTTAdapter` — calls Groq Whisper API (`POST /openai/v1/audio/transcriptions`)
- `GroqTranscriptParser` — calls Groq Chat Completions API (Llama 3.3 70B) for `TaskDraft` extraction
- `RemoteVoiceParsingService` — updated to compose the two adapters with per-step retries and timeout
- `registerServices.ts` — swap `MockAudioRecorder` → `MobileAudioRecorder` behind a feature flag; wire Groq adapters
- Unit tests for all three new/updated classes
- Developer documentation update for `pod install` step and `.env` setup

**Out of Scope**
- Streaming / chunked audio upload
- Consent/telemetry UI
- Backend/server implementation of `POST /api/voice/parse`
- CI integration tests that hit a real STT endpoint

---

## 5. Architecture

The outer two-port architecture from #94 is **unchanged**. The new adapter pattern is introduced *inside* `RemoteVoiceParsingService`, adding two new internal ports so each AI step can be swapped independently:

```
CreateTaskPage / EditTaskPage
  └─ useVoiceTask(recorder, voiceService)        ← unchanged
       └─ ParseVoiceTaskUseCase                 ← unchanged
            ├─ IAudioRecorder                   ← port (unchanged)
            │    ├─ MobileAudioRecorder         ← WIRED (prod)
            │    └─ MockAudioRecorder           ← test only
            └─ IVoiceParsingService             ← port (unchanged)
                 ├─ RemoteVoiceParsingService   ← UPDATED: composes two adapters
                 │    ├─ ISTTAdapter            ← NEW internal port
                 │    │    └─ GroqSTTAdapter    ← Whisper large-v3 (free)
                 │    └─ ITranscriptParser      ← NEW internal port
                 │         └─ GroqTranscriptParser ← Llama 3.3 70B (free)
                 └─ MockVoiceParsingService     ← test only / feature flag
```

**Why two separate ports?** STT (audio → text) and LLM extraction (text → `TaskDraft`) are independent concerns. You can later swap to AssemblyAI for STT while keeping Groq for extraction, or vice versa, without touching any other layer.

### 5.1 Dependency Injection Strategy

```
__DEV__ = false  AND  VOICE_USE_MOCK_PARSER = false  →  MobileAudioRecorder + RemoteVoiceParsingService
__DEV__ = false  AND  VOICE_USE_MOCK_PARSER = true   →  MobileAudioRecorder + MockVoiceParsingService (soft rollout)
__DEV__ = true   (any)                               →  MockAudioRecorder   + MockVoiceParsingService  (CI/Metro)
```

The flag `VOICE_USE_MOCK_PARSER` is read from a central `FeatureFlags` module (or `process.env.VOICE_USE_MOCK_PARSER`) so it can be toggled at build time.

---

## 6. Detailed Implementation Plan

### 6.1 iOS Microphone Permission — `Info.plist`

Add immediately before the closing `</dict>` tag (after the existing `NSPhotoLibraryUsageDescription` entry):

```xml
<key>NSMicrophoneUsageDescription</key>
<string>Builder Assistant needs microphone access to record voice task notes</string>
```

**File**: [ios/BuilderAssistantApp/Info.plist](ios/BuilderAssistantApp/Info.plist)

---

### 6.2 Android Microphone Permission — `AndroidManifest.xml`

Add before the `<application>` element:

```xml
<uses-permission android:name="android.permission.RECORD_AUDIO" />
```

**File**: [android/app/src/main/AndroidManifest.xml](android/app/src/main/AndroidManifest.xml)

---

### 6.3 CocoaPods Linking

`react-native-audio-recorder-player` requires native iOS linking. After a fresh clone (or after adding the dependency), the developer must run:

```bash
cd ios && pod install && cd ..
```

**Action**: Add this step to:
- The "Getting Started" section in `README.md`
- A note in `DRIZZLE_SETUP.md` or the new ios setup section

This is a one-time manual step; no code change required.

---

### 6.4 STT Service Selection: Groq (Recommended for POC)

#### Why Groq?

| Criterion | Groq | AssemblyAI | OpenAI Whisper |
|-----------|------|------------|----------------|
| **Free tier** | ✅ Unlimited (rate-limited) — no credit card | ✅ 100 hrs/month (sign-up) | ❌ $0.006/min after credits |
| **STT model** | Whisper large-v3 | Best-in-class Nova-2 | Whisper |
| **Speed** | ⚡ Sub-second (LPU inference) | ~2–5 s async | ~2–4 s |
| **LLM for draft extraction** | ✅ Llama 3.3 70B — same key | ❌ Separate LLM needed | ❌ Separate LLM needed |
| **REST API** | OpenAI-compatible | Proprietary | OpenAI-compatible |
| **Single API key for full flow** | ✅ Yes | ❌ No | ❌ No |

**Decision**: Groq — one free API key, one consistent interface (OpenAI-compatible), covers both STT and LLM extraction.

- STT endpoint: `POST https://api.groq.com/openai/v1/audio/transcriptions` (Whisper large-v3)
- LLM endpoint: `POST https://api.groq.com/openai/v1/chat/completions` (Llama 3.3 70B)
- Free at: https://console.groq.com

---

### 6.5 New Internal Port Interfaces

#### `ISTTAdapter` — `src/application/services/ISTTAdapter.ts`

```ts
/** Converts raw audio bytes to a plain transcript string. */
export interface ISTTAdapter {
  transcribe(audio: ArrayBuffer, mimeType: string): Promise<string>;
}
```

#### `ITranscriptParser` — `src/application/services/ITranscriptParser.ts`

```ts
import { TaskDraft } from './IVoiceParsingService';

/** Extracts a structured TaskDraft from a plain-text transcript. */
export interface ITranscriptParser {
  parse(transcript: string): Promise<TaskDraft>;
}
```

---

### 6.6 `GroqSTTAdapter` — `src/infrastructure/voice/GroqSTTAdapter.ts`

```ts
import { ISTTAdapter } from '../../application/services/ISTTAdapter';

const GROQ_STT_URL = 'https://api.groq.com/openai/v1/audio/transcriptions';
const RETRYABLE = new Set([429, 503, 504]);

export class GroqSTTAdapter implements ISTTAdapter {
  constructor(
    private readonly apiKey: string,
    private readonly timeoutMs = 30_000,
    private readonly maxRetries = 3,
  ) {}

  async transcribe(audio: ArrayBuffer, mimeType: string): Promise<string> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const form = new (FormData as any)();
        (form as any).append(
          'file',
          new (Blob as any)([audio], { type: mimeType }),
          'recording.mp4',
        );
        (form as any).append('model', 'whisper-large-v3');
        (form as any).append('response_format', 'text');

        const res = await fetch(GROQ_STT_URL, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.apiKey}` },
          body: form,
          signal: controller.signal,
        });

        if (res.ok) return res.text();

        if (!RETRYABLE.has(res.status)) {
          throw new Error(`Groq STT failed: HTTP ${res.status}`);
        }
        lastError = new Error(`Groq STT failed (retryable): HTTP ${res.status}`);
      } catch (err: unknown) {
        const isAbort = err instanceof Error && err.name === 'AbortError';
        lastError = isAbort
          ? new Error(`Groq STT timed out after ${this.timeoutMs}ms`)
          : (err as Error);
        if (!isAbort) throw lastError;
      } finally {
        clearTimeout(timer);
      }

      if (attempt < this.maxRetries - 1) {
        await new Promise(r => setTimeout(r, 1000 * 2 ** attempt));
      }
    }

    throw lastError ?? new Error('Groq STT: max retries exceeded');
  }
}
```

---

### 6.7 `GroqTranscriptParser` — `src/infrastructure/voice/GroqTranscriptParser.ts`

```ts
import { ITranscriptParser } from '../../application/services/ITranscriptParser';
import { TaskDraft } from '../../application/services/IVoiceParsingService';

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';

const SYSTEM_PROMPT = `You are a task assistant for a construction site app.
Extract structured task information from a spoken transcript.
Respond ONLY with a valid JSON object matching this TypeScript type:
{
  title?: string;              // Short task name (≤ 80 chars)
  notes?: string;              // Full description / instructions
  dueDate?: string;            // ISO 8601 date (YYYY-MM-DD) if mentioned
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  trade?: string;              // e.g. 'roofing', 'plumbing', 'electrical'
  durationEstimate?: number;   // hours (number)
}
Omit fields that are not mentioned. Do not wrap in markdown or code blocks.`;

export class GroqTranscriptParser implements ITranscriptParser {
  constructor(
    private readonly apiKey: string,
    private readonly timeoutMs = 20_000,
  ) {}

  async parse(transcript: string): Promise<TaskDraft> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch(GROQ_CHAT_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: transcript },
          ],
          temperature: 0,
          max_tokens: 256,
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`Groq LLM failed: HTTP ${res.status}`);
      }

      const body = await res.json();
      const content: string = body.choices?.[0]?.message?.content ?? '{}';

      try {
        return JSON.parse(content) as TaskDraft;
      } catch {
        // Best-effort: put the raw transcript in notes so nothing is lost
        return { notes: transcript };
      }
    } catch (err: unknown) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      throw isAbort
        ? new Error(`Groq LLM timed out after ${this.timeoutMs}ms`)
        : err;
    } finally {
      clearTimeout(timer);
    }
  }
}
```

**Fallback**: if the LLM returns malformed JSON, the raw transcript lands in `notes` — the builder never loses their dictation.

---

### 6.8 Updated `RemoteVoiceParsingService` — `src/infrastructure/voice/RemoteVoiceParsingService.ts`

Now a thin orchestrator over the two adapters:

```ts
import { IVoiceParsingService, TaskDraft } from '../../application/services/IVoiceParsingService';
import { ISTTAdapter } from '../../application/services/ISTTAdapter';
import { ITranscriptParser } from '../../application/services/ITranscriptParser';

export class RemoteVoiceParsingService implements IVoiceParsingService {
  constructor(
    private readonly stt: ISTTAdapter,
    private readonly parser: ITranscriptParser,
  ) {}

  async parseAudioToTaskDraft(audio: ArrayBuffer): Promise<TaskDraft> {
    const transcript = await this.stt.transcribe(audio, 'audio/mp4');
    return this.parser.parse(transcript);
  }
}
```

Retry and timeout logic lives in each adapter — `RemoteVoiceParsingService` stays focused on orchestration only.

---

### 6.9 DI Registration — `registerServices.ts`

**File**: `src/infrastructure/di/registerServices.ts`

```ts
import 'reflect-metadata';
import { container } from 'tsyringe';
import { DrizzleProjectRepository } from '../repositories/DrizzleProjectRepository';
import { DrizzleInvoiceRepository } from '../repositories/DrizzleInvoiceRepository';
import { DrizzlePaymentRepository } from '../repositories/DrizzlePaymentRepository';
import { DrizzleReceiptRepository } from '../repositories/DrizzleReceiptRepository';
import { DrizzleTaskRepository } from '../repositories/DrizzleTaskRepository';
import { DrizzleDocumentRepository } from '../repositories/DrizzleDocumentRepository';
import { MobileFileSystemAdapter } from '../files/MobileFileSystemAdapter';
import { MobileCameraAdapter } from '../camera/MobileCameraAdapter';
import { MockAudioRecorder } from '../voice/MockAudioRecorder';
import { MockVoiceParsingService } from '../voice/MockVoiceParsingService';
import { MobileAudioRecorder } from '../voice/MobileAudioRecorder';
import { RemoteVoiceParsingService } from '../voice/RemoteVoiceParsingService';
import { GroqSTTAdapter } from '../voice/GroqSTTAdapter';
import { GroqTranscriptParser } from '../voice/GroqTranscriptParser';

// Repository registrations
container.registerSingleton('ProjectRepository', DrizzleProjectRepository);
container.registerSingleton('InvoiceRepository', DrizzleInvoiceRepository);
container.registerSingleton('PaymentRepository', DrizzlePaymentRepository);
container.registerSingleton('ReceiptRepository', DrizzleReceiptRepository);
container.registerSingleton('TaskRepository', DrizzleTaskRepository);
container.registerSingleton('DocumentRepository', DrizzleDocumentRepository);
container.registerSingleton('FileSystemAdapter', MobileFileSystemAdapter);
container.registerSingleton('CameraService', MobileCameraAdapter);

// ── Voice Services ────────────────────────────────────────────────────────────
//
// Feature flag:
//   __DEV__ = true  (Metro / Jest)        → Mocks (safe, no native modules)
//   __DEV__ = false (production/release)  → Real Groq-backed adapters
//   VOICE_USE_MOCK_PARSER = 'true'        → Keep mock parser (soft rollout)
//
const GROQ_API_KEY = process.env.GROQ_API_KEY ?? '';

const useMockVoice = __DEV__;
const useMockParser = useMockVoice || process.env.VOICE_USE_MOCK_PARSER === 'true';

if (useMockVoice) {
  container.registerSingleton('IAudioRecorder', MockAudioRecorder);
} else {
  container.registerSingleton('IAudioRecorder', MobileAudioRecorder);
}

if (useMockParser) {
  container.registerSingleton('IVoiceParsingService', MockVoiceParsingService);
} else {
  container.register('IVoiceParsingService', {
    useFactory: () =>
      new RemoteVoiceParsingService(
        new GroqSTTAdapter(GROQ_API_KEY),
        new GroqTranscriptParser(GROQ_API_KEY),
      ),
  });
}

export default container;
```

**Environment variables required** (configure in `.env` / CI secrets):

| Variable | Description |
|----------|-------------|
| `GROQ_API_KEY` | Groq API key — get free at https://console.groq.com |
| `VOICE_USE_MOCK_PARSER` | `'true'` to use mock parser in production builds (soft rollout) |

---

### 6.10 New Unit Tests

#### `__tests__/unit/GroqSTTAdapter.test.ts`

| Test | Description |
|------|-------------|
| `success` | `fetch` returns `200` with transcript text → resolves with string |
| `non-retryable (401)` | `fetch` returns `401` → throws immediately, no retry |
| `retryable (503) eventual success` | First two calls `503`, third `200` → resolves |
| `retry exhaustion (503 × 3)` | All three `503` → throws after max retries |
| `timeout` | `fetch` hangs → `AbortController` fires → throws timeout error |
| `network failure` | `fetch` rejects `TypeError` → throws immediately |

#### `__tests__/unit/GroqTranscriptParser.test.ts`

| Test | Description |
|------|-------------|
| `success — all fields` | LLM returns valid JSON → resolves with full `TaskDraft` |
| `success — partial fields` | LLM returns partial JSON → resolves with populated fields only |
| `malformed JSON fallback` | LLM returns non-JSON string → resolves with `{ notes: transcript }` |
| `HTTP error` | `fetch` returns `400` → throws |
| `timeout` | `fetch` hangs → throws timeout error |

#### `__tests__/unit/RemoteVoiceParsingService.test.ts`

| Test | Description |
|------|-------------|
| `delegates to stt then parser` | Verifies call sequence: `stt.transcribe` then `parser.parse` |
| `propagates stt error` | `stt.transcribe` rejects → `parseAudioToTaskDraft` rejects |
| `propagates parser error` | `parser.parse` rejects → `parseAudioToTaskDraft` rejects |

All tests use `jest.spyOn(global, 'fetch')` and `jest.useFakeTimers()` where needed. No native modules invoked.

---

## 7. Files Affected Summary

| File | Change |
|------|--------|
| [ios/BuilderAssistantApp/Info.plist](ios/BuilderAssistantApp/Info.plist) | ADD `NSMicrophoneUsageDescription` |
| [android/app/src/main/AndroidManifest.xml](android/app/src/main/AndroidManifest.xml) | ADD `RECORD_AUDIO` permission |
| `src/application/services/ISTTAdapter.ts` | ADD new internal port |
| `src/application/services/ITranscriptParser.ts` | ADD new internal port |
| `src/infrastructure/voice/GroqSTTAdapter.ts` | ADD Groq Whisper adapter |
| `src/infrastructure/voice/GroqTranscriptParser.ts` | ADD Groq LLM parser adapter |
| [src/infrastructure/voice/RemoteVoiceParsingService.ts](src/infrastructure/voice/RemoteVoiceParsingService.ts) | REPLACE skeleton with thin orchestrator |
| [src/infrastructure/di/registerServices.ts](src/infrastructure/di/registerServices.ts) | SWAP mocks for Groq-backed adapters behind feature flag |
| `__tests__/unit/GroqSTTAdapter.test.ts` | ADD (new file) |
| `__tests__/unit/GroqTranscriptParser.test.ts` | ADD (new file) |
| `__tests__/unit/RemoteVoiceParsingService.test.ts` | ADD (new file) |
| `README.md` | ADD `pod install` step and `GROQ_API_KEY` env setup |

---

## 8. On-Device QA Checklist

To be completed by the developer / QA on both iOS and Android physical devices **before merging**.

### 8.1 Permission Flow
- [ ] First launch after install: microphone permission dialog appears
- [ ] Denying permission: tapping Voice button shows a clear error/toast (not a crash)
- [ ] Granting permission (Settings → re-open): recording works normally

### 8.2 Recording Start/Stop
- [ ] Tap Voice button → recording starts (UI indicator shown)
- [ ] Tap Stop → recording stops, parsing spinner shown
- [ ] After parsing: `TaskForm` fields are pre-filled with draft values

### 8.3 Auto-Stop at 60 s
- [ ] Hold recording for > 60 s → recording auto-stops at 60 s and enters parsing state

### 8.4 Cancel Flow
- [ ] Tap Cancel during recording → returns to idle, draft NOT applied, no temp file left

### 8.5 Temp File Cleanup
- [ ] After a successful parse: no `.mp4` file remains in the device cache directory
- [ ] After cancel: no `.mp4` file remains in the device cache directory

### 8.6 ArrayBuffer Decoding
- [ ] Verify the parsed `TaskDraft` fields are correctly populated (spot check with a known phrase)

### 8.7 Draft Pre-fill in TaskForm
- [ ] `CreateTaskPage`: draft fields populate an empty form
- [ ] `EditTaskPage`: draft fields are merged over existing task values (only non-undefined fields override)

---

## 9. Open Questions

1. **Auth token delivery**: ✅ RESOLVED — `GROQ_API_KEY` supplied via `react-native-config` (`.env` file, not committed). This is standard RN practice; acceptable for a POC app. For production hardening, rotate via a backend token-vending endpoint.

2. **STT backend selection**: ✅ RESOLVED — **Groq** (Whisper large-v3 for STT + Llama 3.3 70B for draft extraction). Free tier, single API key, OpenAI-compatible API.

3. **Microphone permission gating in UI**: Should the Voice button be hidden/disabled before permission is granted, or should it request permission proactively when tapped? The current `MobileAudioRecorder` throws on access — a UI handler for `mic permission denied` errors should be added to `useVoiceTask` or `RecordingOverlay`. This was deferred in #94; **A** it should request permission proactively when tapped, showing a clear error if denied. This is a better UX than hiding the button, which might make the feature seem missing or broken.

4. **`pod install` automation**: Should we add a `postinstall` npm script to run `pod install` automatically? This would improve DX but could break non-iOS environments without the Xcode toolchain. ***A*** Document the manual `pod install` step in the README and setup docs, but avoid automating it to prevent potential CI/build issues for Android or Windows developers.

---

## 10. Test Strategy

| Layer | Test file | Coverage |
|-------|-----------|----------|
| Unit | `__tests__/unit/GroqSTTAdapter.test.ts` (NEW) | STT: success, retries, timeout, network error |
| Unit | `__tests__/unit/GroqTranscriptParser.test.ts` (NEW) | Parse: success, partial, malformed JSON fallback, timeout |
| Unit | `__tests__/unit/RemoteVoiceParsingService.test.ts` (NEW) | Orchestration with mocked adapters |
| Unit | `__tests__/unit/ParseVoiceTaskUseCase.test.ts` (EXISTS) | Use case orchestration — no change needed |
| Unit | `__tests__/unit/useVoiceTask.test.tsx` (EXISTS) | Hook state machine — no change needed |
| Integration | `__tests__/integration/TaskPage.voice.integration.test.tsx` (EXISTS) | Page-level voice flow — no change needed (still mocks `useVoiceTask`) |
| Manual / QA | § 8 checklist | On-device verification |

---

## 11. Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Groq free tier rate-limited under load | Low (POC) | `GroqSTTAdapter` retries on 429; acceptable for POC |
| LLM returns wrong/missing fields | Low–Medium | `GroqTranscriptParser` falls back to `{ notes: transcript }` — builder's dictation is never lost |
| `MobileAudioRecorder` crashes if mic denied (unhandled) | Medium | Add permission-denied error handler in `useVoiceTask` (see Open Question 3) |
| `pod install` step missed after clone | Low | Document in README; add to CI ios build step |
| `GROQ_API_KEY` committed accidentally | Low | Add `.env` to `.gitignore` (already standard in RN projects) |
