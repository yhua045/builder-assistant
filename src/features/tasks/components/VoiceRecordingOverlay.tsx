import React from 'react';
import { ActivityIndicator, Modal, Pressable, Text, View } from 'react-native';

interface Props {
  /** Whether the overlay is currently visible */
  visible: boolean;
  /** Current elapsed seconds (shown during recording phase) */
  elapsedSeconds: number;
  /** Max recording seconds */
  maxSeconds: number;
  /** True while transcription/parsing is in progress */
  isParsing: boolean;
  /** Called when the user taps Stop or the Stop button */
  onStop: () => void;
  /** Called when the user taps Cancel (only shown during recording) */
  onCancel: () => void;
}

/**
 * Full-screen overlay displayed while voice recording or parsing is active.
 * Appears on top of the task form and disappears once a TaskDraft is ready.
 */
export function VoiceRecordingOverlay({
  visible,
  elapsedSeconds,
  maxSeconds,
  isParsing,
  onStop,
  onCancel,
}: Props) {
  const remaining = Math.max(0, maxSeconds - elapsedSeconds);
  const minutes = Math.floor(remaining / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (remaining % 60).toString().padStart(2, '0');

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      statusBarTranslucent
    >
      <View className="flex-1 items-center justify-center bg-black/60">
        <View className="w-80 rounded-2xl bg-background p-8 items-center gap-6">
          {isParsing ? (
            <>
              <ActivityIndicator size="large" color="#6366f1" />
              <Text className="text-lg font-semibold text-foreground text-center">
                Analysing your recording…
              </Text>
              <Text className="text-sm text-muted-foreground text-center">
                This may take a few seconds.
              </Text>
            </>
          ) : (
            <>
              {/* Pulsing mic indicator */}
              <View className="w-20 h-20 rounded-full bg-red-100 items-center justify-center">
                <View className="w-12 h-12 rounded-full bg-red-500 items-center justify-center">
                  <Text className="text-white text-2xl">🎙</Text>
                </View>
              </View>

              <Text className="text-lg font-semibold text-foreground">
                Recording…
              </Text>

              {/* Countdown timer */}
              <Text className="text-4xl font-bold text-foreground tabular-nums">
                {minutes}:{seconds}
              </Text>

              <Text className="text-xs text-muted-foreground">
                Recording stops automatically at {maxSeconds}s
              </Text>

              {/* Action buttons */}
              <View className="flex-row gap-4 w-full">
                <Pressable
                  className="flex-1 items-center rounded-xl border border-border py-3"
                  onPress={onCancel}
                  accessibilityLabel="Cancel recording"
                >
                  <Text className="text-sm font-medium text-muted-foreground">
                    Cancel
                  </Text>
                </Pressable>

                <Pressable
                  className="flex-1 items-center rounded-xl bg-primary py-3"
                  onPress={onStop}
                  accessibilityLabel="Stop and transcribe"
                >
                  <Text className="text-sm font-medium text-primary-foreground">
                    Done
                  </Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

export default VoiceRecordingOverlay;
