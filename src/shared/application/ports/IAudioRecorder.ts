export interface AudioRecording {
  data: ArrayBuffer;
  mimeType: string;
  durationMs: number;
}

export interface IAudioRecorder {
  startRecording(): Promise<void>;
  stopRecording(): Promise<AudioRecording>;
}

export default IAudioRecorder;
