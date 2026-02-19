import { IVoiceParsingService, TaskDraft } from '../../application/services/IVoiceParsingService';

export class MockVoiceParsingService implements IVoiceParsingService {
  private preset: TaskDraft;

  constructor(preset?: TaskDraft) {
    this.preset = preset ?? { title: 'Mock Task', notes: 'Captured from voice', priority: 'medium' };
  }

  async parseAudioToTaskDraft(_audio: ArrayBuffer): Promise<TaskDraft> {
    // Return a deterministic preset for tests/dev
    return { ...this.preset };
  }
}

export default MockVoiceParsingService;
