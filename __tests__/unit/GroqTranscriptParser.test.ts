import GroqTranscriptParser from '../../src/infrastructure/voice/GroqTranscriptParser';

describe('GroqTranscriptParser', () => {
  const API_KEY = 'test';
  const parser = new GroqTranscriptParser(API_KEY, 1000);

  beforeEach(() => {
    (globalThis as any).fetch = jest.fn();
  });

  it('parses valid JSON from LLM', async () => {
    const body = { choices: [{ message: { content: JSON.stringify({ title: 'Fix roof' }) } }] };
    (globalThis as any).fetch.mockResolvedValue({ ok: true, json: async () => body });
    const res = await parser.parse('some transcript');
    expect(res.title).toBe('Fix roof');
  });

  it('falls back to notes on malformed JSON', async () => {
    const body = { choices: [{ message: { content: 'not json' } }] };
    (globalThis as any).fetch.mockResolvedValue({ ok: true, json: async () => body });
    const res = await parser.parse('transcript text');
    expect(res.notes).toBe('transcript text');
  });
});
