import { TaskDraft } from './IVoiceParsingService';

/** Extracts a structured TaskDraft from a plain-text transcript. */
export interface ITranscriptParser {
  parse(transcript: string): Promise<TaskDraft>;
}

export default ITranscriptParser;
