import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { DelayReasonType } from '../../domain/entities/DelayReason';
import { X, Check } from 'lucide-react-native';
import { cssInterop } from 'nativewind';

cssInterop(X, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Check, { className: { target: 'style', nativeStyleToProp: { color: true } } });

export interface AddDelayReasonFormData {
  reasonTypeId: string;
  notes?: string;
  delayDurationDays?: number;
  delayDate?: string;
  actor?: string;
}

interface Props {
  visible: boolean;
  delayReasonTypes: DelayReasonType[];
  onSubmit: (data: AddDelayReasonFormData) => void;
  onClose: () => void;
}

export function AddDelayReasonModal({ visible, delayReasonTypes, onSubmit, onClose }: Props) {
  const [selectedTypeId, setSelectedTypeId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [durationDays, setDurationDays] = useState('');
  const [actor, setActor] = useState('');

  const handleSubmit = () => {
    if (!selectedTypeId) return;

    onSubmit({
      reasonTypeId: selectedTypeId,
      notes: notes.trim() || undefined,
      delayDurationDays: durationDays ? parseInt(durationDays, 10) : undefined,
      actor: actor.trim() || undefined,
    });

    // Reset form
    setSelectedTypeId('');
    setNotes('');
    setDurationDays('');
    setActor('');
  };

  const handleClose = () => {
    setSelectedTypeId('');
    setNotes('');
    setDurationDays('');
    setActor('');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 justify-end bg-black/50">
        <View className="bg-card rounded-t-2xl p-6 max-h-[80%]">
          <View className="flex-row justify-between items-center mb-4">
            <Text className="text-lg font-bold text-foreground">Add Delay Reason</Text>
            <TouchableOpacity onPress={handleClose} className="p-1">
              <X size={24} className="text-muted-foreground" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Reason Type Picker */}
            <Text className="text-sm font-medium text-foreground mb-2">Reason Type *</Text>
            <View className="gap-2 mb-4">
              {delayReasonTypes.map((type) => (
                <TouchableOpacity
                  key={type.id}
                  onPress={() => setSelectedTypeId(type.id)}
                  className={`p-3 rounded-lg border ${
                    selectedTypeId === type.id
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-muted'
                  }`}
                >
                  <View className="flex-row items-center gap-2">
                    {selectedTypeId === type.id && (
                      <Check size={16} className="text-primary" />
                    )}
                    <Text
                      className={`text-sm ${
                        selectedTypeId === type.id
                          ? 'text-primary font-medium'
                          : 'text-foreground'
                      }`}
                    >
                      {type.label}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Notes */}
            <Text className="text-sm font-medium text-foreground mb-2">Notes</Text>
            <TextInput
              value={notes}
              onChangeText={setNotes}
              placeholder="Additional details..."
              multiline
              numberOfLines={3}
              className="border border-border rounded-lg p-3 bg-muted text-foreground mb-4"
              placeholderTextColor="#9ca3af"
            />

            {/* Duration */}
            <Text className="text-sm font-medium text-foreground mb-2">Delay Duration (days)</Text>
            <TextInput
              value={durationDays}
              onChangeText={setDurationDays}
              placeholder="e.g. 3"
              keyboardType="numeric"
              className="border border-border rounded-lg p-3 bg-muted text-foreground mb-4"
              placeholderTextColor="#9ca3af"
            />

            {/* Actor */}
            <Text className="text-sm font-medium text-foreground mb-2">Responsible Party</Text>
            <TextInput
              value={actor}
              onChangeText={setActor}
              placeholder="e.g. Builder, Council"
              className="border border-border rounded-lg p-3 bg-muted text-foreground mb-4"
              placeholderTextColor="#9ca3af"
            />

            {/* Submit */}
            <TouchableOpacity
              onPress={handleSubmit}
              disabled={!selectedTypeId}
              className={`py-3 rounded-lg items-center ${
                selectedTypeId ? 'bg-primary' : 'bg-muted'
              }`}
            >
              <Text
                className={`font-semibold ${
                  selectedTypeId ? 'text-primary-foreground' : 'text-muted-foreground'
                }`}
              >
                Add Delay Reason
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
