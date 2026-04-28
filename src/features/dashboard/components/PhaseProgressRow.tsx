import React from 'react';
import { View, Text } from 'react-native';
import { PhaseOverview } from '../hooks/useProjectsOverview';
import { TaskIconRow } from './TaskIconRow';
import { AttentionRequiredSection } from './AttentionRequiredSection';
import { AlertTriangle } from 'lucide-react-native';

interface PhaseProgressRowProps {
  phaseOverview: PhaseOverview;
}

export function PhaseProgressRow({ phaseOverview }: PhaseProgressRowProps) {
  const { phaseName, tasks, progressPercent, completedCount, totalCount } = phaseOverview;
  
  const blockedTasks = tasks.filter(t => t.status === 'blocked');
  const hasBlocker = blockedTasks.length > 0;

  return (
    <View className="mb-6">
      {/* Title & Blocker Badge Row */}
      <View className="flex-row items-center justify-between mb-1">
        <Text className="text-base font-bold text-foreground flex-1">{phaseName}</Text>
        {hasBlocker && (
          <View className="flex-row items-center bg-red-50 px-2 py-1 rounded-md">
            <AlertTriangle className="text-red-500 mr-1" size={14} />
            <Text className="text-red-600 text-xs font-bold">BLOCKER</Text>
          </View>
        )}
      </View>

      {/* Subtitle */}
      <Text className="text-xs text-muted-foreground mb-3">
        Critical Path: {completedCount}/{totalCount} tasks completed
      </Text>

      {/* Progress Bar */}
      <View className="h-2.5 w-full bg-muted rounded-full overflow-hidden mb-1">
        <View 
          className={`h-full ${hasBlocker ? 'bg-red-500' : 'bg-primary'}`} 
          style={{ width: `${progressPercent}%` }}
        />
      </View>

      {/* Icons */}
      <TaskIconRow tasks={tasks} />

      {/* Warning Box */}
      <AttentionRequiredSection blockedTasks={blockedTasks} />
    </View>
  );
}
