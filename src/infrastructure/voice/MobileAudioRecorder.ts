import AudioRecorderPlayer from 'react-native-nitro-sound';
import RNFS from 'react-native-fs';
import { Platform } from 'react-native';
import { check, request, PERMISSIONS, RESULTS } from 'react-native-permissions';
import { IAudioRecorder, AudioRecording } from '../../application/services/IAudioRecorder';

/**
 * Request microphone permission on iOS and Android before recording.
 * Throws if the user denies or if the permission is blocked.
 */
async function requestMicrophonePermission(): Promise<void> {
  const permission = Platform.select({
    ios: PERMISSIONS.IOS.MICROPHONE,
    android: PERMISSIONS.ANDROID.RECORD_AUDIO,
  });
  console.log('[MobileAudioRecorder] permission key selected', { platform: Platform.OS, permission });
  if (!permission) {
    console.log('[MobileAudioRecorder] no permission key resolved for this platform, skipping request');
    return;
  }

  const status = await check(permission);
  console.log('[MobileAudioRecorder] permission check status', { status });
  if (status === RESULTS.GRANTED) {
    console.log('[MobileAudioRecorder] permission already granted');
    return;
  }

  const result = await request(permission);
  console.log('[MobileAudioRecorder] permission request result', { result });
  if (result !== RESULTS.GRANTED) {
    throw new Error(
      `Microphone permission ${result}. Please enable it in Settings > Builder Assistant.`
    );
  }
}

/**
 * Concrete IAudioRecorder for iOS and Android using react-native-nitro-sound.
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
  
  constructor() {
    console.log('[MobileAudioRecorder] constructed', { platform: Platform.OS, playerPresent: !!this.player });
  }

  async startRecording(): Promise<void> {
    console.log('[MobileAudioRecorder] startRecording requested', { platform: Platform.OS });
    try {
      await requestMicrophonePermission();
      console.log('[MobileAudioRecorder] microphone permission flow completed');
      const path = `${RNFS.CachesDirectoryPath}/voice-${Date.now()}.mp4`;
      this.currentPath = path;
      console.log('[MobileAudioRecorder] starting recorder', { path });
      const startResult = await this.player.startRecorder(path);
      console.log('[MobileAudioRecorder] recorder started', { startResult });
    } catch (error) {
      console.log('[MobileAudioRecorder] startRecording failed', { error });
      throw error;
    }
  }

  async stopRecording(): Promise<AudioRecording> {
    const path = this.currentPath;
    if (!path) {
      throw new Error('No active recording');
    }
    this.currentPath = null;
    console.log('[MobileAudioRecorder] stopping recorder', { path });
    // Stop the recorder — returns duration string
    const durationStr = await this.player.stopRecorder();
    console.log('[MobileAudioRecorder] recorder stopped', { durationStr });
    const durationMs = Number(durationStr);

    // Read file and clean up — always unlink even on read/decode error
    let b64: string;
    try {
      b64 = await RNFS.readFile(path, 'base64');
      console.log('[MobileAudioRecorder] read recorded file', { path, base64Length: b64.length, durationMs });
    } finally {
      await RNFS.unlink(path).catch(() => {
        /* swallow unlink errors — temp cleanup is best-effort */
      });
      console.log('[MobileAudioRecorder] temp file cleanup attempted', { path });
    }

    const buf = base64ToArrayBuffer(b64);
    console.log('[MobileAudioRecorder] returning audio buffer', { byteLength: buf.byteLength, mimeType: 'audio/mp4', durationMs });
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
