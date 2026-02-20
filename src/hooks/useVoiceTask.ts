import { useCallback, useMemo, useRef, useState } from 'react';
import { IAudioRecorder } from '../application/services/IAudioRecorder';
import { IVoiceParsingService, TaskDraft } from '../application/services/IVoiceParsingService';
import { ParseVoiceTaskUseCase } from '../application/usecases/task/ParseVoiceTaskUseCase';

export const MAX_RECORDING_SECONDS = 60;

export type VoiceTaskState =
  | { phase: 'idle' }
  | { phase: 'recording' }
  | { phase: 'parsing' }
  | { phase: 'done'; draft: TaskDraft }
  | { phase: 'error'; message: string };

export function useVoiceTask(
  recorder: IAudioRecorder,
  voiceService: IVoiceParsingService,
  maxSeconds: number = MAX_RECORDING_SECONDS,
) {
  const [state, setState] = useState<VoiceTaskState>({ phase: 'idle' });
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Keep a fresh ref to stopAndParse to avoid stale closures inside the interval
  const stopAndParseRef = useRef<() => Promise<TaskDraft | undefined>>(async () => undefined);

  const useCase = useMemo(
    () => new ParseVoiceTaskUseCase(recorder, voiceService),
    [recorder, voiceService],
  );

  const _clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const stopAndParse = useCallback(async () => {
    _clearTimer();
    setState({ phase: 'parsing' });
    try {
      const draft = await useCase.stopAndParse();
      setState({ phase: 'done', draft });
      return draft;
    } catch (e: any) {
      setState({ phase: 'error', message: e?.message ?? 'Voice parsing failed' });
      throw e;
    }
  }, [useCase, _clearTimer]);

  // Keep ref current so the interval callback always holds the latest version
  stopAndParseRef.current = stopAndParse;

  const startRecording = useCallback(async () => {
    setElapsedSeconds(0);
    setState({ phase: 'recording' });
    await useCase.startRecording();

    timerRef.current = setInterval(() => {
      setElapsedSeconds(prev => {
        const next = prev + 1;
        if (next >= maxSeconds) {
          // Auto-stop via ref to avoid stale closure
          stopAndParseRef.current().catch(() => {});
        }
        return next;
      });
    }, 1000);
  }, [useCase, maxSeconds]);

  const cancel = useCallback(async () => {
    _clearTimer();
    // Stop the recorder so MobileAudioRecorder deletes the temp file.
    // Discard the result — we are not parsing.
    await recorder.stopRecording().catch(() => {});
    setState({ phase: 'idle' });
    setElapsedSeconds(0);
  }, [recorder, _clearTimer]);

  return { state, elapsedSeconds, maxSeconds, startRecording, stopAndParse, cancel } as const;
}

export default useVoiceTask;
