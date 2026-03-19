import React from 'react';
import { View, Text } from 'react-native';
import { Task } from '../../../domain/entities/Task';
import { AlertTriangle } from 'lucide-react-native';

interface AttentionRequiredSectionProps {
  blockedTasks: Task[];
}

export function AttentionRequiredSection({ blockedTasks }: AttentionRequiredSectionProps) {
  if (!blockedTasks || blockedTasks.length === 0) return null;

  return (
    <View className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mt-1">
      <Text className="text-red-500 font-bold text-[13px] mb-2">Attention Required:</Text>
      <View className="flex-row flex-wrap gap-2">
        {blockedTasks.map(task => (
           <View key={task.id} className="bg-background border border-red-500/30 px-2 py-1 rounded">
              <Text className="text-red-500 font-medium text-xs">{task.title}</Text>
           </View>
        ))}
      </View>
    </View>
  );
}
