export type TaskDraft = {
  title?: string;
  notes?: string;
  dueDate?: string; // ISO
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  trade?: string;
  durationEstimate?: number; // hours
};

export interface IVoiceParsingService {
  /** Parse raw audio bytes into a TaskDraft */
  parseAudioToTaskDraft(audio: ArrayBuffer): Promise<TaskDraft>;
}

export default IVoiceParsingService;
