import AudioRecorderPlayer from 'react-native-audio-recorder-player';
import RNFS from 'react-native-fs';
import { IAudioRecorder, AudioRecording } from '../../application/services/IAudioRecorder';

/**
 * Concrete IAudioRecorder for iOS and Android using react-native-audio-recorder-player.
 *
 * Lifecycle:
 *  1. startRecording() — writes audio to a timestamped .mp4 file in the app cache directory.
 *  2. stopRecording()  — stops the recorder, reads the file as base64, decodes to ArrayBuffer,
 *                        deletes the temp file, and returns the AudioRecording.
 *
 * The temp file is always deleted inside stopRecording() (success or failure) so no audio
 * persists on device beyond the in-memory ArrayBuffer that is passed to IVoiceParsingService.
 */
export class MobileAudioRecorder implements IAudioRecorder {
  // AudioRecorderPlayer is a singleton instance exported from the library
  private readonly player = AudioRecorderPlayer;
  private currentPath: string | null = null;

  async startRecording(): Promise<void> {
    const path = `${RNFS.CachesDirectoryPath}/voice-${Date.now()}.mp4`;
    this.currentPath = path;
    await this.player.startRecorder(path);
  }

  async stopRecording(): Promise<AudioRecording> {
    const path = this.currentPath;
    if (!path) {
      throw new Error('No active recording');
    }
    this.currentPath = null;

    // Stop the recorder — returns duration string
    const durationStr = await this.player.stopRecorder();
    const durationMs = Number(durationStr);

    // Read file and clean up — always unlink even on read/decode error
    let b64: string;
    try {
      b64 = await RNFS.readFile(path, 'base64');
    } finally {
      await RNFS.unlink(path).catch(() => {
        /* swallow unlink errors — temp cleanup is best-effort */
      });
    }

    const buf = base64ToArrayBuffer(b64);
    return { data: buf, mimeType: 'audio/mp4', durationMs };
  }
}

/**
 * Decode a base64 string to an ArrayBuffer.
 * React Native polyfills `atob` at runtime; we declare it here so tsc
 * does not complain about the missing DOM lib in the React Native tsconfig.
 */
 
declare function atob(s: string): string;

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const buf = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < binary.length; i++) {
    view[i] = binary.charCodeAt(i);
  }
  return buf;
}
