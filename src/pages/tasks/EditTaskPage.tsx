import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, View, Text, Alert, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { container } from 'tsyringe';
import { TaskForm } from '../../components/tasks/TaskForm';
import { VoiceRecordingOverlay } from '../../components/tasks/VoiceRecordingOverlay';
import { useTasks } from '../../hooks/useTasks';
import { useVoiceTask } from '../../hooks/useVoiceTask';
import { IAudioRecorder } from '../../application/services/IAudioRecorder';
import { IVoiceParsingService, TaskDraft } from '../../application/services/IVoiceParsingService';
import { Task } from '../../domain/entities/Task';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function EditTaskPage() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { taskId } = route.params;
  const { getTask, updateTask, loading: saving, tasks } = useTasks(); 
  // Wait, useTasks fetches all tasks implicitly. 
  // We can also use getTask explicitly.

  const [task, setTask] = useState<Task | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    let mounted = true;
    getTask(taskId).then(t => {
      if (mounted) {
        setTask(t);
        setFetching(false);
      }
    }).catch(e => {
       console.error(e);
       if (mounted) setFetching(false);
    });
    return () => { mounted = false; };
  }, [taskId]);

  // Resolve voice services from DI container
  const recorder = useMemo(() => container.resolve<IAudioRecorder>('IAudioRecorder'), []);
  const voiceService = useMemo(() => container.resolve<IVoiceParsingService>('IVoiceParsingService'), []);

  const { state, elapsedSeconds, maxSeconds, startRecording, stopAndParse, cancel } =
    useVoiceTask(recorder, voiceService);

  // When voice draft is ready, merge it over the existing task fields.
  // Only defined (non-undefined) draft fields overwrite the task fields.
  const [formKey, setFormKey] = useState(0);
  const [formInitialValues, setFormInitialValues] = useState<Partial<Task> | TaskDraft | undefined>(undefined);
  useEffect(() => {
    if (state.phase === 'done' && task) {
      const definedDraftEntries = Object.entries(state.draft).filter(([, v]) => v !== undefined);
      const merged: Partial<Task> = { ...task, ...Object.fromEntries(definedDraftEntries) };
      setFormInitialValues(merged);
      setFormKey(k => k + 1); // force TaskForm remount so new initialValues are applied
    } else if (state.phase === 'error') {
      Alert.alert('Voice Error', state.message);
    }
  }, [state, task]);

  const handleUpdate = async (data: Partial<Task>) => {
    if (!task) return;
    try {
      await updateTask({ ...task, ...data });
      navigation.goBack();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to update task');
    }
  };

  if (fetching) {
    return <ActivityIndicator className="flex-1" />;
  }

  if (!task) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>Task not found</Text>
      </View>
    );
  }

  const isOverlayVisible = state.phase === 'recording' || state.phase === 'parsing';

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      {/* Header */}
      <View className="px-6 py-4 border-b border-border flex-row items-center justify-between">
        <Text className="text-xl font-bold text-foreground">Edit Task</Text>
        <Pressable
          className="flex-row items-center gap-1 rounded-lg bg-red-50 px-3 py-2"
          onPress={startRecording}
          disabled={isOverlayVisible}
          accessibilityLabel="Start voice recording"
        >
          <Text className="text-base">🎙</Text>
          <Text className="text-sm font-medium text-red-600">Voice</Text>
        </Pressable>
      </View>

      {/* Form — key changes when a voice draft merges in, forcing a remount */}
      <TaskForm
        key={formKey}
        initialValues={formInitialValues ?? task}
        onSubmit={handleUpdate}
        onCancel={() => navigation.goBack()}
        isLoading={saving}
      />

      {/* Voice recording / parsing overlay */}
      <VoiceRecordingOverlay
        visible={isOverlayVisible}
        elapsedSeconds={elapsedSeconds}
        maxSeconds={maxSeconds}
        isParsing={state.phase === 'parsing'}
        onStop={stopAndParse}
        onCancel={cancel}
      />
    </SafeAreaView>
  );
}

