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

export default GroqTranscriptParser;
