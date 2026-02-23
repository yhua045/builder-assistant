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
        await new Promise<void>(r => setTimeout(() => r(), 1000 * 2 ** attempt));
      }
    }

    throw lastError ?? new Error('Groq STT: max retries exceeded');
  }
}

export default GroqSTTAdapter;
