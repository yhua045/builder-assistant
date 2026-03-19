import React from 'react';
import { View, Text } from 'react-native';
import { PhaseOverview } from '../../../hooks/useProjectsOverview';
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
          <View className="flex-row items-center bg-background border border-red-500/20 px-2 py-0.5 rounded-sm">
            <AlertTriangle size={12} color="#ef4444" className="mr-1" />
            <Text className="text-red-500 text-[10px] uppercase font-bold tracking-wider">Blocker</Text>
          </View>
        )}
      </View>

      {/* Subtitle */}
      <Text className="text-xs text-muted-foreground mb-3">
        Critical Path: {completedCount}/{totalCount} tasks completed
      </Text>

      {/* Progress Bar */}
      <View className="h-2 w-full bg-secondary rounded-full overflow-hidden mb-1">
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
