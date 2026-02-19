import { useCallback, useMemo, useState } from 'react';
import { IAudioRecorder } from '../application/services/IAudioRecorder';
import { IVoiceParsingService, TaskDraft } from '../application/services/IVoiceParsingService';
import { ParseVoiceTaskUseCase } from '../application/usecases/task/ParseVoiceTaskUseCase';

export type VoiceTaskState =
  | { phase: 'idle' }
  | { phase: 'recording' }
  | { phase: 'parsing' }
  | { phase: 'done'; draft: TaskDraft }
  | { phase: 'error'; message: string };

export function useVoiceTask(recorder: IAudioRecorder, voiceService: IVoiceParsingService) {
  const [state, setState] = useState<VoiceTaskState>({ phase: 'idle' });

  const useCase = useMemo(() => new ParseVoiceTaskUseCase(recorder, voiceService), [recorder, voiceService]);

  const startRecording = useCallback(async () => {
    setState({ phase: 'recording' });
    await useCase.startRecording();
  }, [useCase]);

  const stopAndParse = useCallback(async () => {
    setState({ phase: 'parsing' });
    try {
      const draft = await useCase.stopAndParse();
      setState({ phase: 'done', draft });
      return draft;
    } catch (e: any) {
      setState({ phase: 'error', message: e?.message ?? 'Voice parsing failed' });
      throw e;
    }
  }, [useCase]);

  return { state, startRecording, stopAndParse } as const;
}

export default useVoiceTask;
