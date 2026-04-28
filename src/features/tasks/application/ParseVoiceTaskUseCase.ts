import { IAudioRecorder } from '../../../application/services/IAudioRecorder';
import { IVoiceParsingService, TaskDraft } from '../../../application/services/IVoiceParsingService';

export class ParseVoiceTaskUseCase {
  constructor(
    private readonly recorder: IAudioRecorder,
    private readonly voiceService: IVoiceParsingService
  ) {}

  async startRecording(): Promise<void> {
    await this.recorder.startRecording();
  }

  async stopAndParse(): Promise<TaskDraft> {
    const recording = await this.recorder.stopRecording();
    // Forward the raw bytes to the parsing service
    return this.voiceService.parseAudioToTaskDraft(recording.data);
  }
}

export default ParseVoiceTaskUseCase;
