/**
 * Integration tests for TaskScreen — layer-purity assertions and rendering behaviour.
 * Design: design/issue-210-task-screens-refactor.md §8.3
 *
 * Acceptance criteria:
 * - Zero infrastructure/ imports in the component source
 * - Zero tsyringe container import in the component source
 * - Renders 'choose' view by default (three entry-point cards visible)
 * - Renders TaskPhotoPreview when view='preview' with capturedUri
 * - Renders TaskForm when view='form'
 * - Voice stop button visible when voicePhase='recording'
 * - ActivityIndicator visible when isCapturing=true
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import fs from 'fs';
import path from 'path';

// ── Mock UI dependencies ──────────────────────────────────────────────────────

jest.mock('lucide-react-native', () => ({ X: 'X' }));

jest.mock('../../../src/components/tasks/TaskPhotoPreview', () => {
  const { View } = require('react-native');
  return { TaskPhotoPreview: () => <View testID="task-photo-preview" /> };
});

jest.mock('../../../src/components/tasks/TaskForm', () => {
  const { View } = require('react-native');
  return { TaskForm: () => <View testID="task-form" /> };
});

// ── Mock the single View-Model hook ───────────────────────────────────────────

jest.mock('../../../src/hooks/useTaskScreen', () => ({
  useTaskScreen: jest.fn(),
}));

import { useTaskScreen } from '../../../src/hooks/useTaskScreen';
import type { TaskScreenViewModel } from '../../../src/hooks/useTaskScreen';
import TaskScreen from '../../../src/pages/tasks/TaskScreen';

const mockUseTaskScreen = useTaskScreen as jest.MockedFunction<typeof useTaskScreen>;

// ── Default view-model ────────────────────────────────────────────────────────

function makeDefaultVm(overrides: Partial<TaskScreenViewModel> = {}): TaskScreenViewModel {
  return {
    view: 'choose',
    initialDraft: undefined,
    capturedUri: null,
    isCapturing: false,
    isCreatingTask: false,
    createdTask: null,
    voicePhase: 'idle',
    handleStartVoice: jest.fn(),
    handleStopVoice: jest.fn(),
    handleManual: jest.fn(),
    handleUseCamera: jest.fn(),
    handleRetake: jest.fn(),
    handleConfirm: jest.fn(),
    handleCancelPreview: jest.fn(),
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('TaskScreen — layer purity', () => {
  const SOURCE_FILE = path.resolve(
    __dirname,
    '../../../src/pages/tasks/TaskScreen.tsx',
  );

  it('does NOT import from infrastructure/ at any depth', () => {
    const source = fs.readFileSync(SOURCE_FILE, 'utf8');
    expect(source).not.toMatch(/from ['"].*infrastructure\//);
    expect(source).not.toMatch(/require\(['"].*infrastructure\//);
  });

  it('does NOT import container from tsyringe', () => {
    const source = fs.readFileSync(SOURCE_FILE, 'utf8');
    expect(source).not.toMatch(/from ['"]tsyringe['"]/);
    expect(source).not.toMatch(/require\(['"]tsyringe['"]\)/);
  });
});

describe('TaskScreen — rendering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTaskScreen.mockReturnValue(makeDefaultVm());
  });

  it('renders three entry-point cards on the "choose" view', () => {
    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<TaskScreen onClose={jest.fn()} />);
    });

    expect(tree.root.findByProps({ testID: 'voice-start' })).toBeTruthy();
    expect(tree.root.findByProps({ testID: 'manual-start' })).toBeTruthy();
    expect(tree.root.findByProps({ testID: 'camera-start' })).toBeTruthy();
  });

  it('renders TaskPhotoPreview when view="preview" and capturedUri is set', () => {
    mockUseTaskScreen.mockReturnValue(
      makeDefaultVm({ view: 'preview', capturedUri: 'file:///mock/photo.jpg' }),
    );

    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<TaskScreen onClose={jest.fn()} />);
    });

    expect(tree.root.findByProps({ testID: 'task-photo-preview' })).toBeTruthy();
  });

  it('renders TaskForm when view="form"', () => {
    mockUseTaskScreen.mockReturnValue(makeDefaultVm({ view: 'form' }));

    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<TaskScreen onClose={jest.fn()} />);
    });

    expect(tree.root.findByProps({ testID: 'task-form' })).toBeTruthy();
  });

  it('renders voice-stop button when voicePhase="recording"', () => {
    mockUseTaskScreen.mockReturnValue(makeDefaultVm({ voicePhase: 'recording' }));

    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<TaskScreen onClose={jest.fn()} />);
    });

    expect(tree.root.findByProps({ testID: 'voice-stop' })).toBeTruthy();
  });

  it('renders ActivityIndicator when isCapturing=true', () => {
    mockUseTaskScreen.mockReturnValue(makeDefaultVm({ isCapturing: true }));

    let tree!: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(<TaskScreen onClose={jest.fn()} />);
    });

    const { ActivityIndicator } = require('react-native');
    const indicators = tree.root.findAllByType(ActivityIndicator);
    expect(indicators.length).toBeGreaterThan(0);
  });
});
