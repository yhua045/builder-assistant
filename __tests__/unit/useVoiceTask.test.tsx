import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text, Pressable } from 'react-native';
import MockAudioRecorder from '../../src/infrastructure/voice/MockAudioRecorder';
import MockVoiceParsingService from '../../src/infrastructure/voice/MockVoiceParsingService';
import { useVoiceTask } from '../../src/hooks/useVoiceTask';

function TestHarness({ recorder, voice }: any) {
  const { state, startRecording, stopAndParse } = useVoiceTask(recorder, voice);

  return (
    <>
      <Text testID="phase">{state.phase}</Text>
      <Pressable testID="start" onPress={() => startRecording()}>
        <Text>start</Text>
      </Pressable>
      <Pressable testID="stop" onPress={() => stopAndParse()}>
        <Text>stop</Text>
      </Pressable>
    </>
  );
}

describe('useVoiceTask hook', () => {
  it('transitions through recording → parsing → done', async () => {
    const recorder = new MockAudioRecorder();
    const voice = new MockVoiceParsingService({ title: 'Hook Mock' });

    let tree: any;
    await act(async () => {
      tree = renderer.create(<TestHarness recorder={recorder} voice={voice} />);
    });

    const root = tree.root;
    const startBtn = root.findByProps({ testID: 'start' });
    const stopBtn = root.findByProps({ testID: 'stop' });

    await act(async () => {
      startBtn.props.onPress();
    });

    // after start, phase should be 'recording'
    expect(root.findByProps({ testID: 'phase' }).props.children).toBe('recording');

    await act(async () => {
      await stopBtn.props.onPress();
    });

    // cleanup
    tree.unmount();

    // after stop+parse the hook transitions; MockVoiceParsingService resolves immediately
    expect(root.findByProps({ testID: 'phase' }).props.children).toBe('done');
  });
});
