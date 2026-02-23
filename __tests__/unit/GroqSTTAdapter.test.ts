import GroqSTTAdapter from '../../src/infrastructure/voice/GroqSTTAdapter';

describe('GroqSTTAdapter', () => {
  const API_KEY = 'test-key';
  const adapter = new GroqSTTAdapter(API_KEY, 1000, 3);

  beforeEach(() => {
    (globalThis as any).fetch = jest.fn();
  });

  it('resolves transcript on 200', async () => {
    (globalThis as any).fetch.mockResolvedValue({ ok: true, text: async () => 'hello world' });
    const res = await adapter.transcribe(new ArrayBuffer(1), 'audio/mp4');
    expect(res).toBe('hello world');
  });

  it('throws on non-retryable 401', async () => {
    (globalThis as any).fetch.mockResolvedValue({ ok: false, status: 401 });
    await expect(adapter.transcribe(new ArrayBuffer(1), 'audio/mp4')).rejects.toThrow();
  });
});
