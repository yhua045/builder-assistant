// Mock for react-native-nitro-sound
// The real library exports a singleton instance (not a constructor).

const mockAudioRecorderPlayer = {
  startRecorder: jest.fn().mockResolvedValue('/mock/caches/voice-123.mp4'),
  stopRecorder: jest.fn().mockResolvedValue('3500'), // durationMs as string
  startPlayer: jest.fn().mockResolvedValue(undefined),
  stopPlayer: jest.fn().mockResolvedValue(undefined),
  pauseRecorder: jest.fn().mockResolvedValue(undefined),
  resumeRecorder: jest.fn().mockResolvedValue(undefined),
  addRecordBackListener: jest.fn(),
  removeRecordBackListener: jest.fn(),
  addPlayBackListener: jest.fn(),
  removePlayBackListener: jest.fn(),
};

module.exports = mockAudioRecorderPlayer;
module.exports.default = mockAudioRecorderPlayer;
module.exports.__esModule = true;
