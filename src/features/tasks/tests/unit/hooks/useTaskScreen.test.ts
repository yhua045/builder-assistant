/**
 * Unit tests for useTaskScreen View-Model hook
 * Design: design/issue-210-task-screens-refactor.md §8.1
 *
 * Acceptance criteria:
 * - Returns correct initial state: view='choose', isCapturing=false, isCreatingTask=false, createdTask=null, voicePhase='idle'
 * - DI fallback: MockAudioRecorder / MockVoiceParsingService used when container throws
 * - Prop overrides skip DI resolution
 * - handleManual sets view='form', initialDraft=undefined, createdTask=null
 * - handleStartVoice calls startRecording
 * - handleStopVoice calls stopAndParse, sets initialDraft, transitions view to 'form'
 * - handleStopVoice error path: view stays 'choose'
 * - handleUseCamera: success → capturedUri set, view='preview'; cancelled → view='choose'
 * - handleRetake: replaces capturedUri
 * - handleConfirm: calls createFromPhoto, sets createdTask, view='form'
 * - handleCancelPreview: capturedUri=null, view='choose'
 * - cameraHook prop override: uses provided hook instead of useCameraTask
 */

import { renderHook, act } from '@testing-library/react-native';

// ── Module mocks (hoisted) ────────────────────────────────────────────────────

jest.mock('tsyringe', () => ({
  container: { resolve: jest.fn() },
  injectable: jest.fn(),
  inject: jest.fn(),
  singleton: jest.fn(),
  registry: jest.fn(),
}));

jest.mock('../../../../../infrastructure/di/registerServices', () => ({}));

jest.mock('../../../hooks/useVoiceTask', () => ({
  useVoiceTask: jest.fn(),
}));

jest.mock('../../../hooks/useCameraTask', () => ({
  useCameraTask: jest.fn(),
}));

jest.mock('../../../../../infrastructure/voice/MockAudioRecorder', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    startRecording: jest.fn().mockResolvedValue(undefined),
    stopRecording: jest.fn().mockResolvedValue('file:///tmp/audio.m4a'),
  })),
  MockAudioRecorder: jest.fn().mockImplementation(() => ({
    startRecording: jest.fn().mockResolvedValue(undefined),
    stopRecording: jest.fn().mockResolvedValue('file:///tmp/audio.m4a'),
  })),
}));

jest.mock('../../../../../infrastructure/voice/MockVoiceParsingService', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    parseAudio: jest.fn().mockResolvedValue({ title: 'Mock Task' }),
  })),
  MockVoiceParsingService: jest.fn().mockImplementation(() => ({
    parseAudio: jest.fn().mockResolvedValue({ title: 'Mock Task' }),
  })),
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

import { container } from 'tsyringe';
import { useVoiceTask } from '../../../hooks/useVoiceTask';
import { useCameraTask } from '../../../hooks/useCameraTask';
import { useTaskScreen } from '../../../hooks/useTaskScreen';
import MockAudioRecorder from '../../../../../infrastructure/voice/MockAudioRecorder';
import MockVoiceParsingService from '../../../../../infrastructure/voice/MockVoiceParsingService';

// ── Typed helpers ─────────────────────────────────────────────────────────────

const mockContainerResolve = container.resolve as jest.Mock;
const mockUseVoiceTask = useVoiceTask as jest.MockedFunction<typeof useVoiceTask>;
const mockUseCameraTask = useCameraTask as jest.MockedFunction<typeof useCameraTask>;
const MockAudioRecorderCtor = MockAudioRecorder as unknown as jest.Mock;
const MockVoiceParsingServiceCtor = MockVoiceParsingService as unknown as jest.Mock;

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PHOTO_URI = 'file:///mock/photo.jpg';
const NEW_PHOTO_URI = 'file:///mock/new_photo.jpg';
const CAMERA_TASK = { id: 'task-1', title: 'Camera Task', status: 'pending' as const };

let mockStartRecording: jest.Mock;
let mockStopAndParse: jest.Mock;
let mockCapturePhoto: jest.Mock;
let mockCreateFromPhoto: jest.Mock;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useTaskScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: container.resolve throws → triggers DI fallback
    mockContainerResolve.mockImplementation(() => {
      throw new Error('Not registered');
    });

    // Voice hook defaults
    mockStartRecording = jest.fn().mockResolvedValue(undefined);
    mockStopAndParse = jest.fn().mockResolvedValue({ title: 'Parsed Task' });
    mockUseVoiceTask.mockReturnValue({
      state: { phase: 'idle' },
      startRecording: mockStartRecording,
      stopAndParse: mockStopAndParse,
      elapsedSeconds: 0,
      maxSeconds: 60,
      cancel: jest.fn(),
    } as any);

    // Camera hook defaults
    mockCapturePhoto = jest.fn().mockResolvedValue(PHOTO_URI);
    mockCreateFromPhoto = jest.fn().mockResolvedValue(CAMERA_TASK);
    mockUseCameraTask.mockReturnValue({
      capturePhoto: mockCapturePhoto,
      createFromPhoto: mockCreateFromPhoto,
    });
  });

  // ── Initial state ─────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('returns view="choose", all flags false/null, voicePhase="idle"', () => {
      const { result } = renderHook(() => useTaskScreen());

      expect(result.current.view).toBe('choose');
      expect(result.current.isCapturing).toBe(false);
      expect(result.current.isCreatingTask).toBe(false);
      expect(result.current.createdTask).toBeNull();
      expect(result.current.voicePhase).toBe('idle');
      expect(result.current.initialDraft).toBeUndefined();
      expect(result.current.capturedUri).toBeNull();
    });
  });

  // ── DI fallback ────────────────────────────────────────────────────────────

  describe('DI fallback', () => {
    it('instantiates MockAudioRecorder when container.resolve throws', () => {
      renderHook(() => useTaskScreen());
      expect(MockAudioRecorderCtor).toHaveBeenCalledTimes(1);
    });

    it('instantiates MockVoiceParsingService when container.resolve throws', () => {
      renderHook(() => useTaskScreen());
      expect(MockVoiceParsingServiceCtor).toHaveBeenCalledTimes(1);
    });

    it('skips MockAudioRecorder when audioRecorder prop is provided', () => {
      const customRecorder = { startRecording: jest.fn(), stopRecording: jest.fn() } as any;
      renderHook(() => useTaskScreen({ audioRecorder: customRecorder }));
      expect(MockAudioRecorderCtor).not.toHaveBeenCalled();
    });

    it('skips MockVoiceParsingService when voiceParsingService prop is provided', () => {
      const customService = { parseAudio: jest.fn() } as any;
      renderHook(() => useTaskScreen({ voiceParsingService: customService }));
      expect(MockVoiceParsingServiceCtor).not.toHaveBeenCalled();
    });
  });

  // ── handleManual ──────────────────────────────────────────────────────────

  describe('handleManual', () => {
    it('sets view to "form", initialDraft to undefined, createdTask to null', () => {
      const { result } = renderHook(() => useTaskScreen());

      act(() => { result.current.handleManual(); });

      expect(result.current.view).toBe('form');
      expect(result.current.initialDraft).toBeUndefined();
      expect(result.current.createdTask).toBeNull();
    });
  });

  // ── handleStartVoice ──────────────────────────────────────────────────────

  describe('handleStartVoice', () => {
    it('calls startRecording on the voice hook', async () => {
      const { result } = renderHook(() => useTaskScreen());
      await act(async () => { await result.current.handleStartVoice(); });
      expect(mockStartRecording).toHaveBeenCalledTimes(1);
    });
  });

  // ── handleStopVoice ───────────────────────────────────────────────────────

  describe('handleStopVoice', () => {
    it('calls stopAndParse, sets initialDraft, and transitions view to "form"', async () => {
      const draft = { title: 'Voice Task' };
      mockStopAndParse.mockResolvedValue(draft);
      const { result } = renderHook(() => useTaskScreen());

      await act(async () => { await result.current.handleStopVoice(); });

      expect(mockStopAndParse).toHaveBeenCalledTimes(1);
      expect(result.current.initialDraft).toEqual(draft);
      expect(result.current.view).toBe('form');
    });

    it('does NOT change view when stopAndParse throws', async () => {
      mockStopAndParse.mockRejectedValue(new Error('Parsing failed'));
      const { result } = renderHook(() => useTaskScreen());

      await act(async () => { await result.current.handleStopVoice(); });

      expect(result.current.view).toBe('choose');
    });
  });

  // ── handleUseCamera ───────────────────────────────────────────────────────

  describe('handleUseCamera', () => {
    it('sets capturedUri and view to "preview" after successful capture', async () => {
      const { result } = renderHook(() => useTaskScreen());

      await act(async () => { await result.current.handleUseCamera(); });

      expect(result.current.capturedUri).toBe(PHOTO_URI);
      expect(result.current.view).toBe('preview');
    });

    it('stays on "choose" when capture is cancelled (returns null)', async () => {
      mockCapturePhoto.mockResolvedValue(null);
      const { result } = renderHook(() => useTaskScreen());

      await act(async () => { await result.current.handleUseCamera(); });

      expect(result.current.view).toBe('choose');
      expect(result.current.capturedUri).toBeNull();
    });

    it('resets isCapturing to false after capture completes', async () => {
      const { result } = renderHook(() => useTaskScreen());

      await act(async () => { await result.current.handleUseCamera(); });

      expect(result.current.isCapturing).toBe(false);
    });
  });

  // ── handleRetake ──────────────────────────────────────────────────────────

  describe('handleRetake', () => {
    it('replaces capturedUri with a new URI', async () => {
      const { result } = renderHook(() => useTaskScreen());
      await act(async () => { await result.current.handleUseCamera(); });
      expect(result.current.capturedUri).toBe(PHOTO_URI);

      mockCapturePhoto.mockResolvedValue(NEW_PHOTO_URI);
      await act(async () => { await result.current.handleRetake(); });

      expect(result.current.capturedUri).toBe(NEW_PHOTO_URI);
    });
  });

  // ── handleConfirm ─────────────────────────────────────────────────────────

  describe('handleConfirm', () => {
    it('calls createFromPhoto with captured URI, sets createdTask, transitions to "form"', async () => {
      const { result } = renderHook(() => useTaskScreen());
      await act(async () => { await result.current.handleUseCamera(); });
      await act(async () => { await result.current.handleConfirm(); });

      expect(mockCreateFromPhoto).toHaveBeenCalledWith(PHOTO_URI, undefined);
      expect(result.current.createdTask).toEqual(CAMERA_TASK);
      expect(result.current.view).toBe('form');
    });

    it('resets isCreatingTask to false after confirm completes', async () => {
      const { result } = renderHook(() => useTaskScreen());
      await act(async () => { await result.current.handleUseCamera(); });
      await act(async () => { await result.current.handleConfirm(); });

      expect(result.current.isCreatingTask).toBe(false);
    });
  });

  // ── handleCancelPreview ───────────────────────────────────────────────────

  describe('handleCancelPreview', () => {
    it('sets capturedUri to null and view to "choose"', async () => {
      const { result } = renderHook(() => useTaskScreen());
      await act(async () => { await result.current.handleUseCamera(); });

      act(() => { result.current.handleCancelPreview(); });

      expect(result.current.capturedUri).toBeNull();
      expect(result.current.view).toBe('choose');
    });
  });

  // ── cameraHook prop override ──────────────────────────────────────────────

  describe('cameraHook prop override', () => {
    it('uses provided cameraHook instead of internal useCameraTask', async () => {
      const overrideCapturePhoto = jest.fn().mockResolvedValue('file:///override.jpg');
      const overrideCameraHook = {
        capturePhoto: overrideCapturePhoto,
        createFromPhoto: jest.fn().mockResolvedValue({ id: 'override-task' }),
      };

      const { result } = renderHook(() => useTaskScreen({ cameraHook: overrideCameraHook }));
      await act(async () => { await result.current.handleUseCamera(); });

      expect(overrideCapturePhoto).toHaveBeenCalled();
      expect(mockCapturePhoto).not.toHaveBeenCalled();
      expect(result.current.capturedUri).toBe('file:///override.jpg');
    });
  });
});
