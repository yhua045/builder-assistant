/**
 * useTaskScreen — View-Model Facade for TaskScreen.
 *
 * Design: design/issue-210-task-screens-refactor.md §4
 *
 * Encapsulates:
 *  - DI container resolution for IAudioRecorder and IVoiceParsingService
 *    (with MockAudioRecorder / MockVoiceParsingService fallbacks)
 *  - useCameraTask / useVoiceTask composition
 *  - View-mode state (choose | preview | form)
 *  - All action handlers (voice, camera, manual)
 */

import { useState, useMemo, useCallback } from 'react';
import { Alert } from 'react-native';
import { container } from 'tsyringe';
import '../../../infrastructure/di/registerServices';
import { IAudioRecorder } from '../../../application/services/IAudioRecorder';
import { IVoiceParsingService, TaskDraft } from '../../../application/services/IVoiceParsingService';
import { ICameraService } from '../../../application/services/ICameraService';
import { useVoiceTask } from './useVoiceTask';
import { useCameraTask, type UseCameraTaskReturn } from './useCameraTask';
import MockVoiceParsingService from '../../../infrastructure/voice/MockVoiceParsingService';
import MockAudioRecorder from '../../../infrastructure/voice/MockAudioRecorder';
import type { Task } from '../../../domain/entities/Task';

// ── View types ─────────────────────────────────────────────────────────────────

export type TaskScreenViewMode = 'choose' | 'preview' | 'form';

// ── Public interface ───────────────────────────────────────────────────────────

export interface TaskScreenViewModel {
  // View state
  view: TaskScreenViewMode;
  initialDraft: TaskDraft | undefined;
  capturedUri: string | null;
  isCapturing: boolean;
  isCreatingTask: boolean;
  createdTask: Task | null;

  // Voice recording state (proxied from useVoiceTask)
  voicePhase: 'idle' | 'recording' | 'parsing' | 'done' | 'error';

  // Actions
  handleStartVoice: () => Promise<void>;
  handleStopVoice: () => Promise<void>;
  handleManual: () => void;
  handleUseCamera: () => Promise<void>;
  handleRetake: () => Promise<void>;
  handleConfirm: () => Promise<void>;
  handleCancelPreview: () => void;
}

export interface UseTaskScreenOptions {
  /** Override audio recorder for tests */
  audioRecorder?: IAudioRecorder;
  /** Override voice parsing service for tests */
  voiceParsingService?: IVoiceParsingService;
  /** Override camera adapter for tests */
  cameraAdapter?: ICameraService;
  /** Override full camera hook for tests */
  cameraHook?: UseCameraTaskReturn;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTaskScreen(options?: UseTaskScreenOptions): TaskScreenViewModel {
  const {
    audioRecorder,
    voiceParsingService,
    cameraAdapter,
    cameraHook: cameraHookProp,
  } = options ?? {};

  // ── DI resolution with override support ───────────────────────────────────

  const recorder = useMemo<IAudioRecorder>(() => {
    if (audioRecorder) return audioRecorder;
    try {
      const resolved = container.resolve<IAudioRecorder>('IAudioRecorder');
      console.log('[useTaskScreen] using DI audio recorder:', resolved?.constructor?.name ?? typeof resolved);
      return resolved;
    } catch {
      console.log('[useTaskScreen] fallback to MockAudioRecorder');
      return new MockAudioRecorder();
    }
  }, [audioRecorder]);

  const voiceService = useMemo<IVoiceParsingService>(() => {
    if (voiceParsingService) return voiceParsingService;
    try {
      const resolved = container.resolve<IVoiceParsingService>('IVoiceParsingService');
      console.log('[useTaskScreen] using DI voice service:', resolved?.constructor?.name ?? typeof resolved);
      return resolved;
    } catch {
      console.log('[useTaskScreen] fallback to MockVoiceParsingService');
      return new MockVoiceParsingService();
    }
  }, [voiceParsingService]);

  // ── Sub-hook composition ───────────────────────────────────────────────────

  const { state, startRecording, stopAndParse } = useVoiceTask(recorder, voiceService);
  const internalCameraHook = useCameraTask(cameraAdapter);
  const cameraHook = cameraHookProp ?? internalCameraHook;

  // ── View-mode state ────────────────────────────────────────────────────────

  const [view, setView] = useState<TaskScreenViewMode>('choose');
  const [initialDraft, setInitialDraft] = useState<TaskDraft | undefined>(undefined);
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [createdTask, setCreatedTask] = useState<Task | null>(null);

  // ── Voice handlers ─────────────────────────────────────────────────────────

  const handleStartVoice = useCallback(async () => {
    try {
      await startRecording();
    } catch (e: any) {
      Alert.alert('Recording failed', e?.message ?? '');
    }
  }, [startRecording]);

  const handleStopVoice = useCallback(async () => {
    try {
      const draft = await stopAndParse();
      setInitialDraft(draft);
      setView('form');
    } catch (e: any) {
      Alert.alert('Parsing failed', e?.message ?? '');
    }
  }, [stopAndParse]);

  const handleManual = useCallback(() => {
    setInitialDraft(undefined);
    setCreatedTask(null);
    setView('form');
  }, []);

  // ── Camera helpers ─────────────────────────────────────────────────────────

  const doCapture = useCallback(async (): Promise<string | null> => {
    setIsCapturing(true);
    try {
      return await cameraHook.capturePhoto({ quality: 0.8, maxWidth: 2048, maxHeight: 2048 });
    } catch (e: any) {
      Alert.alert('Camera error', e?.message ?? 'Could not capture photo');
      return null;
    } finally {
      setIsCapturing(false);
    }
  }, [cameraHook]);

  const handleUseCamera = useCallback(async () => {
    const uri = await doCapture();
    if (!uri) return; // cancelled → stay on choose
    setCapturedUri(uri);
    setView('preview');
  }, [doCapture]);

  const handleRetake = useCallback(async () => {
    const uri = await doCapture();
    if (!uri) return; // cancelled → stay on preview
    setCapturedUri(uri);
  }, [doCapture]);

  const handleConfirm = useCallback(async () => {
    if (!capturedUri) return;
    setIsCreatingTask(true);
    try {
      const task = await cameraHook.createFromPhoto(capturedUri, undefined);
      setCreatedTask(task);
      setView('form');
    } catch {
      Alert.alert('Error', 'Could not create task from photo');
    } finally {
      setIsCreatingTask(false);
    }
  }, [capturedUri, cameraHook]);

  const handleCancelPreview = useCallback(() => {
    setCapturedUri(null);
    setView('choose');
  }, []);

  // ── Return View-Model ──────────────────────────────────────────────────────

  return {
    view,
    initialDraft,
    capturedUri,
    isCapturing,
    isCreatingTask,
    createdTask,
    voicePhase: state.phase,
    handleStartVoice,
    handleStopVoice,
    handleManual,
    handleUseCamera,
    handleRetake,
    handleConfirm,
    handleCancelPreview,
  };
}
