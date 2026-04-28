import { act, renderHook } from '@testing-library/react-native';
import MockAudioRecorder from '../../src/infrastructure/voice/MockAudioRecorder';
import MockVoiceParsingService from '../../src/infrastructure/voice/MockVoiceParsingService';
import { MAX_RECORDING_SECONDS, useVoiceTask } from '../../src/features/tasks/hooks/useVoiceTask';

function makeHook(maxSeconds?: number) {
  const recorder = new MockAudioRecorder();
  const voice = new MockVoiceParsingService({ title: 'Hook Mock', priority: 'low' });
  const { result } = renderHook(() => useVoiceTask(recorder, voice, maxSeconds));
  return { recorder, voice, result };
}

describe('useVoiceTask hook', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  describe('initial state', () => {
    it('starts in idle phase', () => {
      const { result } = makeHook();
      expect(result.current.state.phase).toBe('idle');
    });

    it('exposes elapsedSeconds = 0 and maxSeconds', () => {
      const { result } = makeHook(30);
      expect(result.current.elapsedSeconds).toBe(0);
      expect(result.current.maxSeconds).toBe(30);
    });

    it('defaults maxSeconds to MAX_RECORDING_SECONDS', () => {
      const { result } = makeHook();
      expect(result.current.maxSeconds).toBe(MAX_RECORDING_SECONDS);
      expect(MAX_RECORDING_SECONDS).toBe(60);
    });
  });

  describe('startRecording()', () => {
    it('transitions to recording phase', async () => {
      const { result } = makeHook();
      await act(async () => {
        await result.current.startRecording();
      });
      expect(result.current.state.phase).toBe('recording');
    });

    it('resets elapsedSeconds to 0 before recording', async () => {
      const { result } = makeHook();
      await act(async () => {
        await result.current.startRecording();
      });
      expect(result.current.elapsedSeconds).toBe(0);
    });

    it('increments elapsedSeconds each second', async () => {
      const { result } = makeHook(60);
      await act(async () => {
        await result.current.startRecording();
      });
      act(() => {
        jest.advanceTimersByTime(3000);
      });
      expect(result.current.elapsedSeconds).toBe(3);
    });
  });

  describe('stopAndParse()', () => {
    it('transitions through parsing → done', async () => {
      const { result } = makeHook();
      await act(async () => {
        await result.current.startRecording();
      });
      await act(async () => {
        await result.current.stopAndParse();
      });
      expect(result.current.state.phase).toBe('done');
    });

    it('done state carries the parsed draft', async () => {
      const { result } = makeHook();
      await act(async () => {
        await result.current.startRecording();
        await result.current.stopAndParse();
      });
      const s = result.current.state;
      expect(s.phase).toBe('done');
      if (s.phase === 'done') {
        expect(s.draft.title).toBe('Hook Mock');
        expect(s.draft.priority).toBe('low');
      }
    });

    it('clears the timer when stopAndParse is called', async () => {
      const { result } = makeHook(60);
      await act(async () => {
        await result.current.startRecording();
      });
      act(() => { jest.advanceTimersByTime(2000); });
      expect(result.current.elapsedSeconds).toBe(2);

      await act(async () => {
        await result.current.stopAndParse();
      });
      // Timer should be cleared — further ticks have no effect
      act(() => { jest.advanceTimersByTime(5000); });
      expect(result.current.elapsedSeconds).toBe(2);
    });

    it('transitions to error phase when parsing fails', async () => {
      const recorder = new MockAudioRecorder();
      const voice = new MockVoiceParsingService({ title: 'x' });
      jest.spyOn(voice, 'parseAudioToTaskDraft').mockRejectedValue(new Error('STT error'));

      const { result } = renderHook(() => useVoiceTask(recorder, voice));
      await act(async () => {
        await result.current.startRecording();
      });
      await act(async () => {
        try { await result.current.stopAndParse(); } catch {}
      });

      expect(result.current.state.phase).toBe('error');
      const s = result.current.state;
      if (s.phase === 'error') {
        expect(s.message).toBe('STT error');
      }
    });
  });

  describe('auto-stop at maxSeconds', () => {
    it('calls stopAndParse automatically when maxSeconds elapses', async () => {
      const { result } = makeHook(3);
      await act(async () => {
        await result.current.startRecording();
      });
      // Advance to exactly maxSeconds — should trigger auto-stop
      await act(async () => {
        jest.advanceTimersByTime(3000);
        // Flush promises so stopAndParse resolves
        await Promise.resolve();
      });
      expect(result.current.state.phase).toBe('done');
    });
  });

  describe('cancel()', () => {
    it('returns to idle phase', async () => {
      const { result } = makeHook();
      await act(async () => {
        await result.current.startRecording();
      });
      await act(async () => {
        await result.current.cancel();
      });
      expect(result.current.state.phase).toBe('idle');
    });

    it('resets elapsedSeconds', async () => {
      const { result } = makeHook(60);
      await act(async () => {
        await result.current.startRecording();
      });
      act(() => { jest.advanceTimersByTime(5000); });
      expect(result.current.elapsedSeconds).toBe(5);

      await act(async () => {
        await result.current.cancel();
      });
      expect(result.current.elapsedSeconds).toBe(0);
    });

    it('clears the timer so elapsed no longer increments', async () => {
      const { result } = makeHook(60);
      await act(async () => {
        await result.current.startRecording();
      });
      await act(async () => {
        await result.current.cancel();
      });
      act(() => { jest.advanceTimersByTime(10000); });
      expect(result.current.elapsedSeconds).toBe(0);
    });
  });
});
