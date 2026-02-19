import { ParseVoiceTaskUseCase } from '../../src/application/usecases/task/ParseVoiceTaskUseCase';

describe('ParseVoiceTaskUseCase', () => {
  it('delegates start/stop and parses audio to TaskDraft', async () => {
    const recorder = {
      startRecording: jest.fn(async () => {}),
      stopRecording: jest.fn(async () => ({ data: new ArrayBuffer(4), mimeType: 'audio/wav', durationMs: 1200 })),
    } as any;

    const preset = { title: 'Parsed Title', notes: 'From voice' };
    const voiceService = { parseAudioToTaskDraft: jest.fn(async (_: ArrayBuffer) => preset) } as any;

    const useCase = new ParseVoiceTaskUseCase(recorder, voiceService);

    await useCase.startRecording();
    expect(recorder.startRecording).toHaveBeenCalledTimes(1);

    const draft = await useCase.stopAndParse();
    expect(recorder.stopRecording).toHaveBeenCalledTimes(1);
    expect(voiceService.parseAudioToTaskDraft).toHaveBeenCalledWith(expect.any(ArrayBuffer));
    expect(draft).toEqual(preset);
  });
});
