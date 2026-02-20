import React from 'react';
import {
  View,
  Text,
  Image,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';

interface Props {
  photoUri: string;
  isLoading?: boolean;
  onRetake: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Displays a captured photo with Retake, Confirm, and Cancel actions.
 * Shown between camera capture and task creation.
 */
export function TaskPhotoPreview({
  photoUri,
  isLoading,
  onRetake,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <View className="flex-1 bg-background" testID="photo-preview">
      {/* Photo */}
      <View className="flex-1 items-center justify-center bg-black">
        <Image
          source={{ uri: photoUri }}
          style={styles.image}
          resizeMode="contain"
          testID="preview-image"
        />
      </View>

      {/* Actions */}
      <View className="p-4 gap-3 bg-background">
        {isLoading ? (
          <View className="items-center py-4">
            <ActivityIndicator testID="preview-loading" />
            <Text className="text-sm text-muted-foreground mt-2">
              Creating task…
            </Text>
          </View>
        ) : (
          <>
            <Pressable
              testID="confirm-btn"
              onPress={onConfirm}
              className="bg-primary rounded-xl p-4 items-center"
            >
              <Text className="text-primary-foreground font-semibold text-base">
                ✓ Confirm &amp; Create Task
              </Text>
            </Pressable>

            <Pressable
              testID="retake-btn"
              onPress={onRetake}
              className="bg-card rounded-xl p-4 items-center"
            >
              <Text className="text-foreground font-medium text-base">
                ↩ Retake
              </Text>
            </Pressable>

            <Pressable
              testID="cancel-preview-btn"
              onPress={onCancel}
              className="p-3 items-center"
            >
              <Text className="text-muted-foreground text-sm">Cancel</Text>
            </Pressable>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    width: '100%',
    height: '100%',
  },
});
