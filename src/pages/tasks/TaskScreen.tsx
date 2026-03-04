import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, Modal, ActivityIndicator, Alert } from 'react-native';
import { X } from 'lucide-react-native';
import { container } from 'tsyringe';
import { TaskForm } from '../../components/tasks/TaskForm';
import { TaskPhotoPreview } from '../../components/tasks/TaskPhotoPreview';
import MockVoiceParsingService from '../../infrastructure/voice/MockVoiceParsingService';
import MockAudioRecorder from '../../infrastructure/voice/MockAudioRecorder';
import { useVoiceTask } from '../../hooks/useVoiceTask';
import { useCameraTask, type UseCameraTaskReturn } from '../../hooks/useCameraTask';
import { IVoiceParsingService, TaskDraft } from '../../application/services/IVoiceParsingService';
import { IAudioRecorder } from '../../application/services/IAudioRecorder';
import { ICameraService } from '../../application/services/ICameraService';
import type { Task } from '../../domain/entities/Task';

type ViewMode = 'choose' | 'preview' | 'form';

interface Props {
  onClose: () => void;
  audioRecorder?: any;
  voiceParsingService?: any;
  /** Optional camera adapter override (used in tests) */
  cameraAdapter?: ICameraService;
  /** Optional pre-built camera hook override (used in tests) */
  cameraHook?: UseCameraTaskReturn;
}

export default function TaskScreen({ onClose, audioRecorder, voiceParsingService, cameraAdapter, cameraHook: cameraHookProp }: Props) {
  const recorder = useMemo(() => {
    if (audioRecorder) return audioRecorder;
    try {
      const resolved = container.resolve<IAudioRecorder>('IAudioRecorder');
      console.log('[TaskScreen] using DI audio recorder:', resolved?.constructor?.name ?? typeof resolved);
      return resolved;
    } catch (error) {
      console.log('[TaskScreen] fallback to MockAudioRecorder (DI resolve failed):', error);
      return new MockAudioRecorder();
    }
  }, [audioRecorder]);

  const voiceService = useMemo(() => {
    if (voiceParsingService) return voiceParsingService;
    try {
      const resolved = container.resolve<IVoiceParsingService>('IVoiceParsingService');
      console.log('[TaskScreen] using DI voice service:', resolved?.constructor?.name ?? typeof resolved);
      return resolved;
    } catch (error) {
      console.log('[TaskScreen] fallback to MockVoiceParsingService (DI resolve failed):', error);
      return new MockVoiceParsingService();
    }
  }, [voiceParsingService]);

  const { state, startRecording, stopAndParse } = useVoiceTask(recorder, voiceService);
  const internalCameraHook = useCameraTask(cameraAdapter);
  const cameraHook = cameraHookProp ?? internalCameraHook;

  const [view, setView] = useState<ViewMode>('choose');
  const [initialDraft, setInitialDraft] = useState<TaskDraft | undefined>(undefined);

  // Camera flow state
  const [capturedUri, setCapturedUri] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [createdTask, setCreatedTask] = useState<Task | null>(null);

  // ---------------------------------------------------------------------------
  // Voice handlers
  // ---------------------------------------------------------------------------

  const handleStartVoice = async () => {
    try {
      await startRecording();
    } catch (e: any) {
      Alert.alert('Recording failed', e?.message ?? '');
    }
  };

  const handleStopVoice = async () => {
    try {
      const draft = await stopAndParse();
      setInitialDraft(draft);
      setView('form');
    } catch (e: any) {
      Alert.alert('Parsing failed', e?.message ?? '');
    }
  };

  const handleManual = () => {
    setInitialDraft(undefined);
    setCreatedTask(null);
    setView('form');
  };

  // ---------------------------------------------------------------------------
  // Camera handlers
  // ---------------------------------------------------------------------------

  const doCapture = async (): Promise<string | null> => {
    setIsCapturing(true);
    try {
      return await cameraHook.capturePhoto({ quality: 0.8, maxWidth: 2048, maxHeight: 2048 });
    } catch (e: any) {
      Alert.alert('Camera error', e?.message ?? 'Could not capture photo');
      return null;
    } finally {
      setIsCapturing(false);
    }
  };

  const handleUseCamera = async () => {
    const uri = await doCapture();
    if (!uri) return; // cancelled → stay on choose
    setCapturedUri(uri);
    setView('preview');
  };

  const handleRetake = async () => {
    const uri = await doCapture();
    if (!uri) return; // cancelled → stay on preview
    setCapturedUri(uri);
  };

  const handleConfirm = async () => {
    if (!capturedUri) return;
    setIsCreatingTask(true);
    try {
      const task = await cameraHook.createFromPhoto(capturedUri, undefined);
      setCreatedTask(task);
      setView('form');
    } catch (e: any) {
      Alert.alert('Error', 'Could not create task from photo');
    } finally {
      setIsCreatingTask(false);
    }
  };

  const handleCancelPreview = () => {
    setCapturedUri(null);
    setView('choose');
  };

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-background p-4">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-xl font-bold text-foreground">Add Task</Text>
          <Pressable onPress={onClose}>
            <X className="text-muted-foreground" size={24} />
          </Pressable>
        </View>

        {view === 'choose' && (
          <View className="flex-1 justify-center gap-4">
            <Pressable
              onPress={handleStartVoice}
              className="bg-card rounded-xl p-6 mb-3"
              testID="voice-start"
            >
              <Text className="text-lg font-semibold">🎤 Voice</Text>
              <Text className="text-sm text-foreground/70 mt-2">Dictate a task and we'll pre-fill the form.</Text>
            </Pressable>

            <Pressable
              onPress={handleManual}
              className="bg-card rounded-xl p-6 mb-3"
              testID="manual-start"
            >
              <Text className="text-lg font-semibold">Manual entry</Text>
              <Text className="text-sm text-foreground/70 mt-2">Enter the task details manually.</Text>
            </Pressable>

            <Pressable
              onPress={handleUseCamera}
              className="bg-card rounded-xl p-6"
              testID="camera-start"
              disabled={isCapturing}
            >
              <Text className="text-lg font-semibold">📷 Use Camera</Text>
              <Text className="text-sm text-foreground/70 mt-2">Take a photo to create a task instantly.</Text>
            </Pressable>

            {isCapturing && (
              <View className="mt-4 items-center">
                <ActivityIndicator />
              </View>
            )}

            {state.phase === 'recording' && (
              <Pressable onPress={handleStopVoice} className="mt-6 bg-red-600 p-3 rounded-lg" testID="voice-stop">
                <Text className="text-white text-center">Stop recording</Text>
              </Pressable>
            )}

            {state.phase === 'parsing' && (
              <View className="mt-6 items-center">
                <ActivityIndicator />
                <Text className="text-sm mt-2">Parsing…</Text>
              </View>
            )}
          </View>
        )}

        {view === 'preview' && capturedUri && (
          <TaskPhotoPreview
            photoUri={capturedUri}
            isLoading={isCreatingTask}
            onRetake={handleRetake}
            onConfirm={handleConfirm}
            onCancel={handleCancelPreview}
          />
        )}

        {view === 'form' && (
          <TaskForm
            initialValues={(createdTask ?? initialDraft) as any}
            onSuccess={onClose}
            onCancel={onClose}
          />
        )}
      </View>
    </Modal>
  );
}

