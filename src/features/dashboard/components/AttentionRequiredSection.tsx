import React from 'react';
import { View, Text } from 'react-native';
import { Task } from '../../../domain/entities/Task';

interface AttentionRequiredSectionProps {
  blockedTasks: Task[];
}

export function AttentionRequiredSection({ blockedTasks }: AttentionRequiredSectionProps) {
  if (!blockedTasks || blockedTasks.length === 0) return null;

  return (
    <View className="bg-red-50/50 border border-red-100 rounded-lg p-3 mt-1">
      <Text className="text-xs text-red-700 font-semibold mb-1">Attention Required:</Text>
      <View className="flex-row flex-wrap gap-2">
        {blockedTasks.map(task => (
           <View key={task.id} className="bg-white/80 border border-red-200 px-2 py-1 rounded">
              <Text className="text-xs text-red-800">{task.title}</Text>
           </View>
        ))}
      </View>
    </View>
  );
}
