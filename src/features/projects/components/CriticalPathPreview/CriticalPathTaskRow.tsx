import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
} from 'react-native';
import type { CriticalPathSuggestion } from '../../../../data/critical-path/schema';

interface CriticalPathTaskRowProps {
  suggestion: CriticalPathSuggestion;
  isSelected: boolean;
  disabled?: boolean;
  onPress: (id: string) => void;
}

export function CriticalPathTaskRow({
  suggestion,
  isSelected,
  disabled,
  onPress,
}: CriticalPathTaskRowProps) {
  return (
    <TouchableOpacity
      testID={`task-row-${suggestion.id}`}
      className={`flex-row items-center py-3 px-4 border-b border-gray-200 ${disabled ? 'opacity-40' : ''}`}
      onPress={() => onPress(suggestion.id)}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected }}
    >
      <View
        testID={`task-checkbox-${suggestion.id}`}
        className={`w-[22px] h-[22px] rounded border-2 mr-3 items-center justify-center ${
          isSelected ? 'border-blue-600 bg-blue-600' : 'border-gray-400'
        }`}
      >
        {isSelected && <View className="w-3 h-3 bg-white rounded-sm" />}
      </View>
      <View className="flex-1">
        <Text className="text-[15px] font-medium color-gray-900">{suggestion.title}</Text>
        {suggestion.notes ? (
          <Text className="text-xs color-gray-500 mt-0.5">{suggestion.notes}</Text>
        ) : null}
      </View>
      {suggestion.critical_flag && (
        <View className="bg-red-100 rounded px-1.5 py-0.5 ml-2">
          <Text className="text-[11px] color-red-600 font-semibold">Critical</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}
