/**
 * Unit tests for ParseVoiceTaskUseCase
 *
 * Uses inline test doubles — fully offline, no native modules.
 *
 * Run: npx jest __tests__/unit/ParseVoiceTaskUseCase.test.ts
 */

import { ParseVoiceTaskUseCase } from '../../src/application/usecases/task/ParseVoiceTaskUseCase';
import { IAudioRecorder, AudioRecording } from '../../src/application/services/IAudioRecorder';
import { IVoiceParsingService, TaskDraft } from '../../src/application/services/IVoiceParsingService';

const MOCK_RECORDING: AudioRecording = {
  data: new ArrayBuffer(8),
  mimeType: 'audio/mp4',
  durationMs: 2500,
};

const MOCK_DRAFT: TaskDraft = {
  title: 'Install skylight',
  notes: 'North-facing roof, 1200×1200mm',
  dueDate: '2026-03-15',
  priority: 'high',
  trade: 'roofing',
  durationEstimate: 3,
};

function makeRecorder(overrides?: Partial<IAudioRecorder>): IAudioRecorder {
  return {
    startRecording: jest.fn().mockResolvedValue(undefined),
    stopRecording: jest.fn().mockResolvedValue(MOCK_RECORDING),
    ...overrides,
  };
}

function makeVoiceService(overrides?: Partial<IVoiceParsingService>): IVoiceParsingService {
  return {
    parseAudioToTaskDraft: jest.fn().mockResolvedValue(MOCK_DRAFT),
    ...overrides,
  };
}

describe('ParseVoiceTaskUseCase', () => {
  describe('startRecording()', () => {
    it('delegates to the recorder', async () => {
      const recorder = makeRecorder();
      const uc = new ParseVoiceTaskUseCase(recorder, makeVoiceService());

      await uc.startRecording();

      expect(recorder.startRecording).toHaveBeenCalledTimes(1);
    });

    it('propagates recorder errors', async () => {
      const recorder = makeRecorder({
        startRecording: jest.fn().mockRejectedValue(new Error('mic permission denied')),
      });
      const uc = new ParseVoiceTaskUseCase(recorder, makeVoiceService());

      await expect(uc.startRecording()).rejects.toThrow('mic permission denied');
    });
  });

  describe('stopAndParse()', () => {
    it('stops the recorder and passes audio data to the voice service', async () => {
      const recorder = makeRecorder();
      const service = makeVoiceService();
      const uc = new ParseVoiceTaskUseCase(recorder, service);

      await uc.startRecording();
      await uc.stopAndParse();

      expect(recorder.stopRecording).toHaveBeenCalledTimes(1);
      expect(service.parseAudioToTaskDraft).toHaveBeenCalledWith(MOCK_RECORDING.data);
    });

    it('returns the TaskDraft from the voice service', async () => {
      const uc = new ParseVoiceTaskUseCase(makeRecorder(), makeVoiceService());
      await uc.startRecording();
      const draft = await uc.stopAndParse();

      expect(draft).toEqual(MOCK_DRAFT);
    });

    it('returns a draft with all expected fields', async () => {
      const uc = new ParseVoiceTaskUseCase(makeRecorder(), makeVoiceService());
      await uc.startRecording();
      const draft = await uc.stopAndParse();

      expect(draft.title).toBe('Install skylight');
      expect(draft.notes).toBe('North-facing roof, 1200×1200mm');
      expect(draft.dueDate).toBe('2026-03-15');
      expect(draft.priority).toBe('high');
      expect(draft.trade).toBe('roofing');
      expect(draft.durationEstimate).toBe(3);
    });

    it('propagates recorder stopRecording errors', async () => {
      const recorder = makeRecorder({
        stopRecording: jest.fn().mockRejectedValue(new Error('recorder failure')),
      });
      const uc = new ParseVoiceTaskUseCase(recorder, makeVoiceService());
      await uc.startRecording();

      await expect(uc.stopAndParse()).rejects.toThrow('recorder failure');
    });

    it('propagates voice service parsing errors', async () => {
      const service = makeVoiceService({
        parseAudioToTaskDraft: jest.fn().mockRejectedValue(new Error('parse timeout')),
      });
      const uc = new ParseVoiceTaskUseCase(makeRecorder(), service);
      await uc.startRecording();

      await expect(uc.stopAndParse()).rejects.toThrow('parse timeout');
    });

    it('works with a partial draft (voice service returns only some fields)', async () => {
      const partialDraft: TaskDraft = { title: 'Quick fix' };
      const service = makeVoiceService({
        parseAudioToTaskDraft: jest.fn().mockResolvedValue(partialDraft),
      });
      const uc = new ParseVoiceTaskUseCase(makeRecorder(), service);
      await uc.startRecording();
      const draft = await uc.stopAndParse();

      expect(draft.title).toBe('Quick fix');
      expect(draft.notes).toBeUndefined();
      expect(draft.dueDate).toBeUndefined();
    });
  });
});
