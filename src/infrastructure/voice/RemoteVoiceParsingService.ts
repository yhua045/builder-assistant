import { IVoiceParsingService, TaskDraft } from '../../application/services/IVoiceParsingService';

/**
 * RemoteVoiceParsingService — skeleton adapter for a future STT backend.
 *
 * Protocol: POST /api/voice/parse  (multipart/form-data)
 *   Body:    audio  — audio/mp4 file named "recording.mp4"
 *   Response: TaskDraft JSON
 *
 * This adapter is NOT wired in the DI container for this PR.
 * Wire it in registerServices.ts once the backend is ready.
 *
 * @see IVoiceParsingService
 */
export class RemoteVoiceParsingService implements IVoiceParsingService {
  constructor(private readonly baseUrl: string) {}

  async parseAudioToTaskDraft(audio: ArrayBuffer): Promise<TaskDraft> {
    // FormData and Blob are polyfilled by React Native but are not in the
    // @react-native/typescript-config lib, so we cast to any here.
     
    const form = new (FormData as any)();
    (form as any).append(
      'audio',
      new (Blob as any)([audio], { type: 'audio/mp4' }),
      'recording.mp4',
    );

    const res = await fetch(`${this.baseUrl}/api/voice/parse`, {
      method: 'POST',
      body: form,
    });

    if (!res.ok) {
      throw new Error(`Voice parse request failed with status ${res.status}`);
    }

    return res.json() as Promise<TaskDraft>;
  }
}
