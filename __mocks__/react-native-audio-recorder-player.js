// Mock for react-native-audio-recorder-player
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

// Expose as default export matching the real library API
module.exports = mockAudioRecorderPlayer;
module.exports.default = mockAudioRecorderPlayer;
module.exports.__esModule = true;
