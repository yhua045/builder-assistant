declare module 'react-native-audio-recorder-player' {
  type Subscription = { remove: () => void };

  export const AudioRecorderPlayer: {
    startRecorder(path?: string): Promise<string>;
    stopRecorder(): Promise<string>;
    addRecordBackListener(listener: (e: any) => void): Subscription;
    removeRecordBackListener(): void;
    startPlayer(path?: string): Promise<string>;
    stopPlayer(): Promise<void>;
    addPlayBackListener(listener: (e: any) => void): Subscription;
    removePlayBackListener(): void;
  };

  export default AudioRecorderPlayer;
}
