import { IVoiceParsingService, TaskDraft } from '../../application/services/IVoiceParsingService';
import { ISTTAdapter } from '../../application/services/ISTTAdapter';
import { ITranscriptParser } from '../../application/services/ITranscriptParser';

/**
 * RemoteVoiceParsingService — thin orchestrator that composes an STT adapter
 * and a transcript parser. Each adapter handles its own retries/timeouts.
 */
export class RemoteVoiceParsingService implements IVoiceParsingService {
  constructor(
    private readonly stt: ISTTAdapter,
    private readonly parser: ITranscriptParser,
  ) {}

  async parseAudioToTaskDraft(audio: ArrayBuffer): Promise<TaskDraft> {
    const transcript = await this.stt.transcribe(audio, 'audio/mp4');
    if (__DEV__) {
      try {
        console.log('[Voice][Remote] transcript (preview)', transcript.slice(0, 1000));
      } catch (e) {
        console.log('[Voice][Remote] transcript (preview) failed to log', e);
      }
    }

    const draft = await this.parser.parse(transcript);
    if (__DEV__) {
      try {
        console.log('[Voice][Remote] parsed draft', draft);
      } catch (e) {
        console.log('[Voice][Remote] parsed draft failed to log', e);
      }
    }

    return draft;
  }
}

export default RemoteVoiceParsingService;
