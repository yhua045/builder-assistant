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
    return this.parser.parse(transcript);
  }
}

export default RemoteVoiceParsingService;
