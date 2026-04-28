import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, View, Text, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { container } from 'tsyringe';
import { TaskForm } from '../components/TaskForm';
import { VoiceRecordingOverlay } from '../components/VoiceRecordingOverlay';
import { useVoiceTask } from '../hooks/useVoiceTask';
import { IAudioRecorder } from '../../../application/services/IAudioRecorder';
import { IVoiceParsingService, TaskDraft } from '../../../application/services/IVoiceParsingService';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CreateTaskPage() {
  const navigation = useNavigation<any>();
  // Resolve voice services from DI container
  const recorder = useMemo(() => container.resolve<IAudioRecorder>('IAudioRecorder'), []);
  const voiceService = useMemo(() => container.resolve<IVoiceParsingService>('IVoiceParsingService'), []);

  const { state, elapsedSeconds, maxSeconds, startRecording, stopAndParse, cancel } =
    useVoiceTask(recorder, voiceService);

  // When the voice draft is ready, store it so we can pass it to TaskForm as initialValues
  const [voiceDraft, setVoiceDraft] = useState<TaskDraft | undefined>(undefined);
  useEffect(() => {
    if (state.phase === 'done') {
      setVoiceDraft(state.draft);
    } else if (state.phase === 'error') {
      Alert.alert('Voice Error', state.message);
    }
  }, [state]);

  const isOverlayVisible = state.phase === 'recording' || state.phase === 'parsing';

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      {/* Header */}
      <View className="px-6 py-4 border-b border-border flex-row items-center justify-between">
        <Text className="text-xl font-bold text-foreground">New Task</Text>
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

      {/* Form — remount with new key when voice draft arrives so initialValues are applied */}
      <TaskForm
        key={voiceDraft ? 'voice-draft' : 'default'}
        initialValues={voiceDraft}
        onSuccess={() => navigation.goBack()}
        onCancel={() => navigation.goBack()}
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

