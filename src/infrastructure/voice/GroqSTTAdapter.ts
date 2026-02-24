import { ISTTAdapter } from '../../application/services/ISTTAdapter';
import RNFS from 'react-native-fs';

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
      const tempAudioPath = `${RNFS.TemporaryDirectoryPath || RNFS.CachesDirectoryPath}/groq-stt-${Date.now()}-${Math.random().toString(36).slice(2)}.m4a`;

      try {
        await RNFS.writeFile(tempAudioPath, toBase64(audio), 'base64');

        const form = new (FormData as any)();
        (form as any).append(
          'file',
          {
            uri: `file://${tempAudioPath}`,
            type: mimeType,
            name: 'recording.m4a',
          } as any,
        );
        (form as any).append('model', 'whisper-large-v3');
        (form as any).append('response_format', 'text');

        const res = await fetch(GROQ_STT_URL, {
          method: 'POST',
          headers: { Authorization: `Bearer ${this.apiKey}` },
          body: form,
          signal: controller.signal,
        });

        // Read body here so we can log response content in dev without losing it
        const resText = await res.text();
        if (res.ok) {
          if (__DEV__) {
            console.log('[Voice][GroqSTT] transcript received', {
              status: res.status,
              length: resText.length,
              preview: resText.slice(0, 1000),
            });
          }
          return resText;
        }

        if (!RETRYABLE.has(res.status)) {
          if (res.status === 401) {
            console.log('[Voice][GroqSTT] 401 diagnostics', {
              keyLength: this.apiKey.length,
              keyMasked: maskSecret(this.apiKey),
              hasGroqPrefix: this.apiKey.startsWith('gsk_'),
              responsePreview: resText.slice(0, 200),
            });
          }
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
        await RNFS.unlink(tempAudioPath).catch(() => {});
      }

      if (attempt < this.maxRetries - 1) {
        await new Promise<void>(r => setTimeout(() => r(), 1000 * 2 ** attempt));
      }
    }

    throw lastError ?? new Error('Groq STT: max retries exceeded');
  }
}

function toBase64(audio: ArrayBuffer): string {
  const bufferCtor: { from: (data: ArrayBuffer) => { toString: (encoding: string) => string } } | undefined =
    (globalThis as any).Buffer;
  if (bufferCtor?.from) {
    return bufferCtor.from(audio).toString('base64');
  }

  const bytes = new Uint8Array(audio);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }

  const btoaFn: ((input: string) => string) | undefined = (globalThis as any).btoa;
  if (btoaFn) {
    return btoaFn(binary);
  }

  throw new Error('Unable to encode audio payload to base64');
}

function maskSecret(value: string): string {
  if (!value) return '<empty>';
  if (value.length <= 8) return `${value[0]}***${value[value.length - 1]}`;
  return `${value.slice(0, 4)}***${value.slice(-4)}`;
}

export default GroqSTTAdapter;
