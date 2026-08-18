/**
 * Analytics instrumentation tests for useTaskScreen.
 *
 * Verifies that the correct events are emitted for each task creation method.
 *
 * AC-1: Events use namespaced names from design taxonomy.
 * AC-2: Distinguishes voice, manual, and camera methods.
 * AC-6: Unit tests verify event emission.
 */

import { renderHook, act } from '@testing-library/react-native';

// ── Module mocks (hoisted) ────────────────────────────────────────────────────

const mockTrack = jest.fn();

jest.mock('../../src/shared/ui/hooks/useAnalytics', () => ({
  useAnalytics: () => ({ track: mockTrack, screen: jest.fn() }),
}));

jest.mock('tsyringe', () => ({
  container: { resolve: jest.fn() },
  injectable: jest.fn(),
  inject: jest.fn(),
  singleton: jest.fn(),
  registry: jest.fn(),
}));

jest.mock('../../src/infrastructure/di/registerServices', () => ({}));

const mockStartRecording = jest.fn().mockResolvedValue(undefined);
const mockStopAndParse = jest.fn().mockResolvedValue({ title: 'Parsed Task' });

jest.mock('../../src/features/tasks/hooks/useVoiceTask', () => ({
  useVoiceTask: jest.fn().mockReturnValue({
    state: { phase: 'idle' },
    startRecording: mockStartRecording,
    stopAndParse: mockStopAndParse,
  }),
}));

const mockCapturePhoto = jest.fn().mockResolvedValue('file:///photo.jpg');
const mockCreateFromPhoto = jest.fn().mockResolvedValue({ id: 'task-1', title: 'Photo Task' });

jest.mock('../../src/features/tasks/hooks/useCameraTask', () => ({
  useCameraTask: jest.fn().mockReturnValue({
    capturePhoto: mockCapturePhoto,
    createFromPhoto: mockCreateFromPhoto,
  }),
}));

jest.mock('../../src/infrastructure/voice/MockAudioRecorder', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({ startRecording: jest.fn(), stopRecording: jest.fn() })),
}));

jest.mock('../../src/infrastructure/voice/MockVoiceParsingService', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({ parseAudio: jest.fn() })),
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { useTaskScreen } from '../../src/features/tasks/hooks/useTaskScreen';

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useTaskScreen — analytics instrumentation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset stubs that may have been cleared
    mockStartRecording.mockResolvedValue(undefined);
    mockStopAndParse.mockResolvedValue({ title: 'Parsed Task' });
    mockCapturePhoto.mockResolvedValue('file:///photo.jpg');
    mockCreateFromPhoto.mockResolvedValue({ id: 'task-1', title: 'Photo Task' });

    const { useVoiceTask } = require('../../src/features/tasks/hooks/useVoiceTask');
    (useVoiceTask as jest.Mock).mockReturnValue({
      state: { phase: 'idle' },
      startRecording: mockStartRecording,
      stopAndParse: mockStopAndParse,
    });

    const { useCameraTask } = require('../../src/features/tasks/hooks/useCameraTask');
    (useCameraTask as jest.Mock).mockReturnValue({
      capturePhoto: mockCapturePhoto,
      createFromPhoto: mockCreateFromPhoto,
    });
  });

  it('handleManual emits task.creation_method_selected with method=manual', () => {
    const { result } = renderHook(() => useTaskScreen());
    act(() => result.current.handleManual());
    expect(mockTrack).toHaveBeenCalledWith('task.creation_method_selected', { method: 'manual' });
  });

  it('handleStartVoice emits task.creation_method_selected with method=voice', async () => {
    const { result } = renderHook(() => useTaskScreen());
    await act(async () => { await result.current.handleStartVoice(); });
    expect(mockTrack).toHaveBeenCalledWith('task.creation_method_selected', { method: 'voice' });
  });

  it('handleStopVoice emits task.created with method=voice on success', async () => {
    const { result } = renderHook(() => useTaskScreen());
    await act(async () => { await result.current.handleStopVoice(); });
    expect(mockTrack).toHaveBeenCalledWith('task.created', { method: 'voice' });
  });

  it('handleUseCamera emits task.creation_method_selected with method=camera', async () => {
    const { result } = renderHook(() => useTaskScreen());
    await act(async () => { await result.current.handleUseCamera(); });
    expect(mockTrack).toHaveBeenCalledWith('task.creation_method_selected', { method: 'camera' });
  });

  it('handleConfirm emits task.created with method=camera on success', async () => {
    const { result } = renderHook(() => useTaskScreen());
    // First get into preview mode
    await act(async () => { await result.current.handleUseCamera(); });
    mockTrack.mockClear();
    await act(async () => { await result.current.handleConfirm(); });
    expect(mockTrack).toHaveBeenCalledWith('task.created', { method: 'camera' });
  });

  it('handleCancelPreview emits task.creation_cancelled', async () => {
    const { result } = renderHook(() => useTaskScreen());
    await act(async () => { await result.current.handleUseCamera(); });
    mockTrack.mockClear();
    act(() => result.current.handleCancelPreview());
    expect(mockTrack).toHaveBeenCalledWith('task.creation_cancelled');
  });

  it('handleStopVoice does NOT emit task.created when parsing fails', async () => {
    mockStopAndParse.mockRejectedValue(new Error('parse error'));
    const { useVoiceTask } = require('../../src/features/tasks/hooks/useVoiceTask');
    (useVoiceTask as jest.Mock).mockReturnValue({
      state: { phase: 'idle' },
      startRecording: mockStartRecording,
      stopAndParse: mockStopAndParse,
    });

    const { result } = renderHook(() => useTaskScreen());
    await act(async () => { await result.current.handleStopVoice(); });
    const createdCalls = mockTrack.mock.calls.filter(([e]) => e === 'task.created');
    expect(createdCalls).toHaveLength(0);
  });
});
