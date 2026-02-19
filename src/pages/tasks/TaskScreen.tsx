import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, Modal, ActivityIndicator, Alert } from 'react-native';
import { X } from 'lucide-react-native';
import { TaskForm } from '../../components/tasks/TaskForm';
import MockVoiceParsingService from '../../infrastructure/voice/MockVoiceParsingService';
import MockAudioRecorder from '../../infrastructure/voice/MockAudioRecorder';
import { useVoiceTask } from '../../hooks/useVoiceTask';
import { useTasks } from '../../hooks/useTasks';
import { TaskDraft } from '../../application/services/IVoiceParsingService';

interface Props {
  onClose: () => void;
  audioRecorder?: any;
  voiceParsingService?: any;
}

export default function TaskScreen({ onClose, audioRecorder, voiceParsingService }: Props) {
  const recorder = useMemo(() => audioRecorder ?? new MockAudioRecorder(), [audioRecorder]);
  const voiceService = useMemo(() => voiceParsingService ?? new MockVoiceParsingService(), [voiceParsingService]);

  const { state, startRecording, stopAndParse } = useVoiceTask(recorder, voiceService);
  const { createTask } = useTasks();

  const [view, setView] = useState<'choose' | 'form'>('choose');
  const [initialDraft, setInitialDraft] = useState<TaskDraft | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    setView('form');
  };

  const handleSubmit = async (data: any) => {
    setIsSubmitting(true);
    try {
      await createTask({
        title: data.title,
        notes: data.notes,
        projectId: data.projectId,
        dueDate: data.dueDate,
        status: data.status ?? 'pending',
        priority: data.priority ?? 'medium',
      });
      onClose();
    } catch (e) {
      console.error('Create task failed', e);
      Alert.alert('Error', 'Could not create task');
    } finally {
      setIsSubmitting(false);
    }
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
              className="bg-card rounded-xl p-6"
              testID="manual-start"
            >
              <Text className="text-lg font-semibold">Manual entry</Text>
              <Text className="text-sm text-foreground/70 mt-2">Enter the task details manually.</Text>
            </Pressable>

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

        {view === 'form' && (
          <TaskForm
            initialValues={initialDraft as any}
            onSubmit={handleSubmit}
            onCancel={onClose}
            isLoading={isSubmitting}
          />
        )}
      </View>
    </Modal>
  );
}
