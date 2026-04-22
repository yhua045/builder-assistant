import React from 'react';
import { View, Text, Pressable, Modal, ActivityIndicator } from 'react-native';
import { X } from 'lucide-react-native';
import { TaskForm } from '../../components/tasks/TaskForm';
import { TaskPhotoPreview } from '../../components/tasks/TaskPhotoPreview';
import { IAudioRecorder } from '../../application/services/IAudioRecorder';
import { IVoiceParsingService } from '../../application/services/IVoiceParsingService';
import { ICameraService } from '../../application/services/ICameraService';
import { type UseCameraTaskReturn } from '../../hooks/useCameraTask';
import { useTaskScreen } from '../../hooks/useTaskScreen';

interface Props {
  onClose: () => void;
  audioRecorder?: IAudioRecorder;
  voiceParsingService?: IVoiceParsingService;
  /** Optional camera adapter override (used in tests) */
  cameraAdapter?: ICameraService;
  /** Optional pre-built camera hook override (used in tests) */
  cameraHook?: UseCameraTaskReturn;
}

export default function TaskScreen({ onClose, audioRecorder, voiceParsingService, cameraAdapter, cameraHook }: Props) {
  const vm = useTaskScreen({ audioRecorder, voiceParsingService, cameraAdapter, cameraHook });

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View className="flex-1 bg-background p-4">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-xl font-bold text-foreground">Add Task</Text>
          <Pressable onPress={onClose}>
            <X className="text-muted-foreground" size={24} />
          </Pressable>
        </View>

        {vm.view === 'choose' && (
          <View className="flex-1 justify-center gap-4">
            <Pressable
              onPress={vm.handleStartVoice}
              className="bg-card rounded-xl p-6 mb-3"
              testID="voice-start"
            >
              <Text className="text-lg font-semibold">🎤 Voice</Text>
              <Text className="text-sm text-foreground/70 mt-2">Dictate a task and we'll pre-fill the form.</Text>
            </Pressable>

            <Pressable
              onPress={vm.handleManual}
              className="bg-card rounded-xl p-6 mb-3"
              testID="manual-start"
            >
              <Text className="text-lg font-semibold">Manual entry</Text>
              <Text className="text-sm text-foreground/70 mt-2">Enter the task details manually.</Text>
            </Pressable>

            <Pressable
              onPress={vm.handleUseCamera}
              className="bg-card rounded-xl p-6"
              testID="camera-start"
              disabled={vm.isCapturing}
            >
              <Text className="text-lg font-semibold">📷 Use Camera</Text>
              <Text className="text-sm text-foreground/70 mt-2">Take a photo to create a task instantly.</Text>
            </Pressable>

            {vm.isCapturing && (
              <View className="mt-4 items-center">
                <ActivityIndicator />
              </View>
            )}

            {vm.voicePhase === 'recording' && (
              <Pressable onPress={vm.handleStopVoice} className="mt-6 bg-red-600 p-3 rounded-lg" testID="voice-stop">
                <Text className="text-white text-center">Stop recording</Text>
              </Pressable>
            )}

            {vm.voicePhase === 'parsing' && (
              <View className="mt-6 items-center">
                <ActivityIndicator />
                <Text className="text-sm mt-2">Parsing…</Text>
              </View>
            )}
          </View>
        )}

        {vm.view === 'preview' && vm.capturedUri && (
          <TaskPhotoPreview
            photoUri={vm.capturedUri}
            isLoading={vm.isCreatingTask}
            onRetake={vm.handleRetake}
            onConfirm={vm.handleConfirm}
            onCancel={vm.handleCancelPreview}
          />
        )}

        {vm.view === 'form' && (
          <TaskForm
            initialValues={(vm.createdTask ?? vm.initialDraft) as any}
            onSuccess={onClose}
            onCancel={onClose}
          />
        )}
      </View>
    </Modal>
  );
}
