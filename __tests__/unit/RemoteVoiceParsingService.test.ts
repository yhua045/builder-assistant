import { RemoteVoiceParsingService } from '../../src/infrastructure/voice/RemoteVoiceParsingService';

describe('RemoteVoiceParsingService', () => {
  it('delegates to stt then parser', async () => {
    const stt = { transcribe: jest.fn().mockResolvedValue('hello world') } as any;
    const parser = { parse: jest.fn().mockResolvedValue({ title: 'Test' }) } as any;

    const svc = new RemoteVoiceParsingService(stt, parser);
    const res = await svc.parseAudioToTaskDraft(new ArrayBuffer(1));

    expect(stt.transcribe).toHaveBeenCalledTimes(1);
    expect(parser.parse).toHaveBeenCalledWith('hello world');
    expect(res.title).toBe('Test');
  });
});
