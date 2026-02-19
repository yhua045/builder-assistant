import { IAudioRecorder, AudioRecording } from '../../application/services/IAudioRecorder';

export class MockAudioRecorder implements IAudioRecorder {
  async startRecording(): Promise<void> {
    // no-op for mock
    return;
  }

  async stopRecording(): Promise<AudioRecording> {
    // Return empty buffer placeholder
    return {
      data: new ArrayBuffer(0),
      mimeType: 'audio/wav',
      durationMs: 1000,
    };
  }
}

export default MockAudioRecorder;
