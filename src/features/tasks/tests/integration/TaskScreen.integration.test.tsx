/** Integration test for TaskScreen voice → form flow */
import React from 'react';
import renderer, { act } from 'react-test-renderer';

jest.mock('nativewind', () => ({ cssInterop: jest.fn(), useColorScheme: () => ({ colorScheme: 'light' }) }));
jest.mock('lucide-react-native', () => ({ X: 'X' }));

// Use real TaskForm; it renders inputs whose values we can inspect

import TaskScreen from '../../screens/TaskScreen';
import MockAudioRecorder from '../../../../infrastructure/voice/MockAudioRecorder';
import MockVoiceParsingService from '../../../../infrastructure/voice/MockVoiceParsingService';

// Mock useTasks to avoid DB access
jest.mock('../../hooks/useTasks', () => ({ useTasks: () => ({ createTask: jest.fn() }) }));

describe.skip('TaskScreen integration', () => {
  it.skip('voice path pre-fills TaskForm with parsed draft', async () => {
    const voiceService = new MockVoiceParsingService({ title: 'Parsed From Voice' });
    const recorder = new MockAudioRecorder();

    const tree = renderer.create(<TaskScreen onClose={() => {}} audioRecorder={recorder} voiceParsingService={voiceService} />);
    const root = tree.root;

    // Start voice by pressing the voice-start Pressable
    const start = root.findByProps({ testID: 'voice-start' });
    await act(async () => {
      start.props.onPress();
    });

    // Now stop button should be present
    const stop = root.findByProps({ testID: 'voice-stop' });
    await act(async () => {
      stop.props.onPress();
    });

    // TaskForm mocked to show title
    const titleNode = root.findByProps({ testID: 'taskform-title' });
    expect(titleNode.props.children).toBe('Parsed From Voice');
  });
});
