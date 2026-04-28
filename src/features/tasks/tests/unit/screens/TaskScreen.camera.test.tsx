/**
 * Unit tests for TaskScreen — camera capture flow
 * TDD — written before implementation (red → green).
 *
 * Tests cover:
 *  - "Use Camera" button is rendered on the choose view
 *  - Tapping "Use Camera" calls hook.capturePhoto()
 *  - After a successful capture, TaskPhotoPreview is shown
 *  - Tapping "Retake" on the preview calls capturePhoto() again
 *  - Tapping "Confirm" on the preview calls hook.createFromPhoto() and shows TaskForm
 *  - Cancelling from the native camera (returns null) returns to choose view
 */

import React from 'react';
import { act } from 'react-test-renderer';
import renderer from 'react-test-renderer';

jest.mock('nativewind', () => ({
  cssInterop: jest.fn(),
  useColorScheme: () => ({ colorScheme: 'light' }),
}));
jest.mock('lucide-react-native', () => ({ X: 'X' }));

// Mock hooks that touch DB / infra
jest.mock('../../../hooks/useTasks', () => ({
  useTasks: () => ({ createTask: jest.fn(), updateTask: jest.fn() }),
}));
jest.mock('../../../hooks/useCameraTask', () => ({
  useCameraTask: () => ({ capturePhoto: jest.fn(), createFromPhoto: jest.fn() }),
}));
jest.mock('../../../hooks/useVoiceTask', () => ({
  useVoiceTask: () => ({
    state: { phase: 'idle' },
    startRecording: jest.fn(),
    stopAndParse: jest.fn(),
  }),
}));

// Lightweight mock for TaskPhotoPreview
jest.mock('../../../components/TaskPhotoPreview', () => {
  const { View, Text, Pressable } = require('react-native');
  return {
    TaskPhotoPreview: ({ onRetake, onConfirm, onCancel }: {
      photoUri: string;
      onRetake: () => void;
      onConfirm: () => void;
      onCancel: () => void;
    }) => (
      <View testID="photo-preview">
        <Pressable testID="retake-btn" onPress={onRetake}><Text>Retake</Text></Pressable>
        <Pressable testID="confirm-btn" onPress={onConfirm}><Text>Confirm</Text></Pressable>
        <Pressable testID="cancel-preview-btn" onPress={onCancel}><Text>Cancel</Text></Pressable>
      </View>
    ),
  };
});

jest.mock('../../../components/TaskForm', () => {
  const { View } = require('react-native');
  return { TaskForm: () => <View testID="task-form" /> };
});

import TaskScreen from '../../../screens/TaskScreen';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MOCK_URI = 'file:///mock/path/photo.jpg';
const MOCK_TASK = {
  id: 'task_1',
  title: 'Task – 20 Feb 2026',
  status: 'pending' as const,
  dueDate: new Date().toISOString(),
};

async function render(mockCapturePhoto: jest.Mock, mockCreateFromPhoto: jest.Mock) {
  const cameraHook = {
    capturePhoto: mockCapturePhoto,
    createFromPhoto: mockCreateFromPhoto,
  };
  let tree!: renderer.ReactTestRenderer;
  await act(async () => {
    tree = renderer.create(<TaskScreen onClose={() => {}} cameraHook={cameraHook} />);
  });
  return tree;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('TaskScreen — camera flow', () => {
  let mockCapturePhoto: jest.Mock;
  let mockCreateFromPhoto: jest.Mock;

  beforeEach(() => {
    mockCapturePhoto = jest.fn().mockResolvedValue(MOCK_URI);
    mockCreateFromPhoto = jest.fn().mockResolvedValue(MOCK_TASK);
  });

  it('renders "Use Camera" button on the choose view', async () => {
    const tree = await render(mockCapturePhoto, mockCreateFromPhoto);
    const btn = tree.root.findByProps({ testID: 'camera-start' });
    expect(btn).toBeTruthy();
  });

  it('shows TaskPhotoPreview after successful capture', async () => {
    const tree = await render(mockCapturePhoto, mockCreateFromPhoto);
    const btn = tree.root.findByProps({ testID: 'camera-start' });
    await act(async () => { btn.props.onPress(); });

    const preview = tree.root.findByProps({ testID: 'photo-preview' });
    expect(preview).toBeTruthy();
  });

  it('returns to choose view when camera is cancelled (capturePhoto returns null)', async () => {
    mockCapturePhoto.mockResolvedValue(null);
    const tree = await render(mockCapturePhoto, mockCreateFromPhoto);
    const btn = tree.root.findByProps({ testID: 'camera-start' });
    await act(async () => { btn.props.onPress(); });

    const previews = tree.root.findAllByProps({ testID: 'photo-preview' });
    expect(previews.length).toBe(0);
    expect(tree.root.findByProps({ testID: 'camera-start' })).toBeTruthy();
  });

  it('calls capturePhoto again on Retake', async () => {
    const tree = await render(mockCapturePhoto, mockCreateFromPhoto);
    await act(async () => {
      tree.root.findByProps({ testID: 'camera-start' }).props.onPress();
    });
    await act(async () => {
      tree.root.findByProps({ testID: 'retake-btn' }).props.onPress();
    });

    expect(mockCapturePhoto).toHaveBeenCalledTimes(2);
  });

  it('shows TaskForm after Confirm, calling createFromPhoto', async () => {
    const tree = await render(mockCapturePhoto, mockCreateFromPhoto);
    await act(async () => {
      tree.root.findByProps({ testID: 'camera-start' }).props.onPress();
    });
    await act(async () => {
      tree.root.findByProps({ testID: 'confirm-btn' }).props.onPress();
    });

    expect(mockCreateFromPhoto).toHaveBeenCalledWith(MOCK_URI, undefined);
    expect(tree.root.findByProps({ testID: 'task-form' })).toBeTruthy();
  });

  it('returns to choose view when Cancel is pressed on preview', async () => {
    const tree = await render(mockCapturePhoto, mockCreateFromPhoto);
    await act(async () => {
      tree.root.findByProps({ testID: 'camera-start' }).props.onPress();
    });
    await act(async () => {
      tree.root.findByProps({ testID: 'cancel-preview-btn' }).props.onPress();
    });

    expect(tree.root.findByProps({ testID: 'camera-start' })).toBeTruthy();
  });
});
