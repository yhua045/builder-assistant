/**
 * Unit tests for MobileAudioRecorder (singleton-player pattern)
 *
 * react-native-nitro-sound exports a singleton instance, not a class.
 * Tests spy on that singleton via the Jest manual mock in
 * __mocks__/react-native-nitro-sound.js.
 *
 * Run: npx jest __tests__/unit/MobileAudioRecorder.test.ts
 */

// Mock native modules before importing the class under test
jest.mock('react-native-nitro-sound');
jest.mock('react-native-fs', () => ({
  CachesDirectoryPath: '/mock/caches',
  readFile: jest.fn(),
  unlink: jest.fn().mockResolvedValue(undefined),
}));

import RNFS from 'react-native-fs';
import AudioRecorderPlayer from 'react-native-nitro-sound';
import { MobileAudioRecorder } from '../../src/infrastructure/voice/MobileAudioRecorder';

// "hello" encoded as base64
const HELLO_B64 = 'aGVsbG8=';
// expected bytes for "hello"
const HELLO_BYTES = [104, 101, 108, 108, 111];

describe('MobileAudioRecorder', () => {
  let recorder: MobileAudioRecorder;
  // AudioRecorderPlayer is the singleton mock exposed by the __mocks__ file
  const player = AudioRecorderPlayer as jest.Mocked<typeof AudioRecorderPlayer>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Configure default mock behaviour on the singleton
    (player.startRecorder as jest.Mock).mockResolvedValue('/mock/caches/voice-123.mp4');
    (player.stopRecorder as jest.Mock).mockResolvedValue('3500');
    (RNFS.readFile as jest.Mock).mockResolvedValue(HELLO_B64);
    (RNFS.unlink as jest.Mock).mockResolvedValue(undefined);

    recorder = new MobileAudioRecorder();
  });

  describe('startRecording()', () => {
    it('starts the native recorder with a cache-directory path', async () => {
      await recorder.startRecording();

      expect(player.startRecorder).toHaveBeenCalledTimes(1);
      const [calledPath] = (player.startRecorder as jest.Mock).mock.calls[0];
      expect(calledPath).toContain('/mock/caches/');
      expect(calledPath).toMatch(/voice-\d+\.mp4$/);
    });

    it('generates a unique path on each recording call', async () => {
      await recorder.startRecording();
      await recorder.stopRecording();
      await recorder.startRecording();
      await recorder.stopRecording();

      const path1 = (player.startRecorder as jest.Mock).mock.calls[0][0];
      const path2 = (player.startRecorder as jest.Mock).mock.calls[1][0];
      // Both should be in caches and follow the naming pattern
      expect(path1).toMatch(/voice-\d+\.mp4$/);
      expect(path2).toMatch(/voice-\d+\.mp4$/);
    });
  });

  describe('stopRecording()', () => {
    it('returns AudioRecording with correct mimeType', async () => {
      await recorder.startRecording();
      const result = await recorder.stopRecording();

      expect(result.mimeType).toBe('audio/mp4');
    });

    it('returns durationMs from the recorder as a number', async () => {
      await recorder.startRecording();
      const result = await recorder.stopRecording();

      expect(result.durationMs).toBe(3500);
    });

    it('reads the recorded file and decodes it to ArrayBuffer', async () => {
      await recorder.startRecording();
      const result = await recorder.stopRecording();

      expect(RNFS.readFile).toHaveBeenCalledWith(
        expect.stringContaining('/mock/caches/'),
        'base64',
      );
      expect(result.data).toBeInstanceOf(ArrayBuffer);
      const view = new Uint8Array(result.data);
      expect(Array.from(view)).toEqual(HELLO_BYTES);
    });

    it('deletes the temp file after reading', async () => {
      await recorder.startRecording();
      await recorder.stopRecording();

      expect(RNFS.unlink).toHaveBeenCalledTimes(1);
      expect(RNFS.unlink).toHaveBeenCalledWith(expect.stringContaining('/mock/caches/'));
    });

    it('deletes the file even if read fails', async () => {
      (RNFS.readFile as jest.Mock).mockRejectedValue(new Error('read failed'));
      await recorder.startRecording();

      await expect(recorder.stopRecording()).rejects.toThrow('read failed');
      // unlink should still have been attempted
      expect(RNFS.unlink).toHaveBeenCalled();
    });

    it('throws if stopRecording is called without startRecording', async () => {
      await expect(recorder.stopRecording()).rejects.toThrow('No active recording');
    });
  });
});

