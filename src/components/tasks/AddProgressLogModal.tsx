import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { X, Camera, Trash2 } from 'lucide-react-native';
import { cssInterop } from 'nativewind';
import { launchImageLibrary } from 'react-native-image-picker';
import { ProgressLog } from '../../domain/entities/ProgressLog';

cssInterop(X, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Camera, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Trash2, { className: { target: 'style', nativeStyleToProp: { color: true } } });

export interface AddProgressLogFormData {
  logType: ProgressLog['logType'];
  notes?: string;
  photos?: string[];
  actor?: string;
}

const LOG_TYPES: { value: ProgressLog['logType']; label: string }[] = [
  { value: 'info', label: 'Info' },
  { value: 'inspection', label: 'Inspection' },
  { value: 'delay', label: 'Delay' },
  { value: 'issue', label: 'Issue' },
  { value: 'completion', label: 'Completion' },
  { value: 'general', label: 'General' },
  { value: 'other', label: 'Other' },
];

interface Props {
  visible: boolean;
  /** When supplied, modal opens in edit mode pre-populated with these values. */
  initialValues?: AddProgressLogFormData & { id: string };
  onSubmit(data: AddProgressLogFormData): void;
  onClose(): void;
}

export function AddProgressLogModal({ visible, initialValues, onSubmit, onClose }: Props) {
  const isEditMode = Boolean(initialValues);

  const [logType, setLogType] = useState<ProgressLog['logType'] | ''>('');
  const [notes, setNotes] = useState('');
  const [actor, setActor] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);

  // Pre-populate when editing
  useEffect(() => {
    if (visible && initialValues) {
      setLogType(initialValues.logType);
      setNotes(initialValues.notes ?? '');
      setActor(initialValues.actor ?? '');
      setPhotos(initialValues.photos ?? []);
    } else if (!visible) {
      // Reset on close
      setLogType('');
      setNotes('');
      setActor('');
      setPhotos([]);
    }
  }, [visible, initialValues]);

  const handleAddPhotos = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        selectionLimit: 5,
        quality: 0.8,
      } as any);
      if (result.assets) {
        const uris = result.assets
          .map((a) => a.uri)
          .filter((u): u is string => Boolean(u));
        setPhotos((prev) => [...prev, ...uris].slice(0, 5));
      }
    } catch {
      Alert.alert('Error', 'Could not open photo library.');
    }
  };

  const handleRemovePhoto = (uri: string) => {
    setPhotos((prev) => prev.filter((p) => p !== uri));
  };

  const handleSubmit = () => {
    if (!logType) return;
    onSubmit({
      logType,
      notes: notes.trim() || undefined,
      actor: actor.trim() || undefined,
      photos: photos.length > 0 ? photos : undefined,
    });
    // Form is reset via the useEffect when `visible` goes false
  };

  const handleClose = () => {
    onClose();
  };

  const isValid = logType !== '';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={handleClose}
    >
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-card rounded-t-2xl p-6 max-h-[85%]">
          {/* Header */}
          <View className="flex-row justify-between items-center mb-5">
            <Text className="text-lg font-bold text-foreground">
              {isEditMode ? 'Edit Progress Log' : 'Add Progress Log'}
            </Text>
            <TouchableOpacity onPress={handleClose} className="p-1" accessibilityLabel="Close modal">
              <X size={24} className="text-muted-foreground" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Log Type */}
            <Text className="text-sm font-medium text-foreground mb-2">
              Log Type <Text className="text-destructive">*</Text>
            </Text>
            <View className="flex-row flex-wrap gap-2 mb-5">
              {LOG_TYPES.map((type) => (
                <TouchableOpacity
                  key={type.value}
                  accessibilityLabel={`log type ${type.value}`}
                  onPress={() => setLogType(type.value)}
                  className={`px-3 py-1.5 rounded-full border ${
                    logType === type.value
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-muted'
                  }`}
                >
                  <Text
                    className={`text-xs font-medium ${
                      logType === type.value ? 'text-primary' : 'text-foreground'
                    }`}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Notes */}
            <Text className="text-sm font-medium text-foreground mb-2">Notes</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Add any details here…"
              multiline
              numberOfLines={3}
              className="border border-border rounded-lg p-3 bg-muted text-foreground mb-5"
              placeholderTextColor="#9ca3af"
              accessibilityLabel="Notes"
            />

            {/* Actor */}
            <Text className="text-sm font-medium text-foreground mb-2">
              Actor <Text className="text-muted-foreground">(optional)</Text>
            </Text>
            <TextInput
              value={actor}
              onChangeText={setActor}
              placeholder="e.g. Mike Johnson"
              className="border border-border rounded-lg p-3 bg-muted text-foreground mb-5"
              placeholderTextColor="#9ca3af"
              accessibilityLabel="Actor"
            />

            {/* Photos */}
            <Text className="text-sm font-medium text-foreground mb-2">
              Photos <Text className="text-muted-foreground">(optional, max 5)</Text>
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-5">
              <View className="flex-row gap-2">
                {photos.map((uri) => (
                  <View key={uri} className="relative">
                    <Image
                      source={{ uri }}
                      className="w-20 h-20 rounded-lg"
                      resizeMode="cover"
                    />
                    <TouchableOpacity
                      onPress={() => handleRemovePhoto(uri)}
                      className="absolute top-0.5 right-0.5 bg-black/60 rounded-full p-0.5"
                      accessibilityLabel="Remove photo"
                    >
                      <Trash2 size={12} className="text-white" />
                    </TouchableOpacity>
                  </View>
                ))}
                {photos.length < 5 && (
                  <TouchableOpacity
                    onPress={handleAddPhotos}
                    className="w-20 h-20 rounded-lg border border-dashed border-border bg-muted items-center justify-center"
                    accessibilityLabel="Add photos"
                  >
                    <Camera size={24} className="text-muted-foreground" />
                    <Text className="text-xs text-muted-foreground mt-1">Add</Text>
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>

            {/* Submit */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!isValid}
              accessibilityLabel={isEditMode ? 'Save Changes' : 'Add Log'}
              className={`py-3 rounded-lg items-center mb-2 ${
                isValid ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <Text
                className={`font-semibold ${
                  isValid ? 'text-primary-foreground' : 'text-muted-foreground'
                }`}
              >
                {isEditMode ? 'Save Changes' : 'Add Log'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
