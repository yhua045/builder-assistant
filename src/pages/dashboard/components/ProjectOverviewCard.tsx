import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { ProjectOverview } from '../../../hooks/useProjectsOverview';
import { AlertCircle, Clock } from 'lucide-react-native';

interface ProjectOverviewCardProps {
  overview: ProjectOverview;
  isComprehensive: boolean;
  onPress: () => void;
}

export function ProjectOverviewCard({ overview, isComprehensive, onPress }: ProjectOverviewCardProps) {
  const { project, progressPercent, nextCriticalTask, overdueCriticalTasksCount, dueSoonCriticalTasksCount } = overview;

  return (
    <Pressable
      onPress={onPress}
      className={`border border-border/50 rounded-2xl mb-4 bg-card ${isComprehensive ? 'p-5' : 'p-4'}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}
    >
      {/* Header row */}
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-lg font-semibold text-foreground flex-1 mb-1">{project.name}</Text>
        <Text className="text-base font-bold text-primary">{progressPercent}%</Text>
      </View>

      {/* Progress Bar */}
      <View className="h-2 w-full bg-secondary rounded-full overflow-hidden mb-3">
        <View 
          className="h-full bg-primary" 
          style={{ width: `${progressPercent}%` }}
        />
      </View>

      {/* Urgency indicators */}
      <View className="flex-row items-center space-x-3 mt-1">
        {overdueCriticalTasksCount > 0 && (
          <View className="flex-row items-center space-x-1 mr-3">
            <AlertCircle size={14} className="text-destructive" />
            <Text className="text-xs text-destructive font-medium">{overdueCriticalTasksCount} Overdue</Text>
          </View>
        )}
        {dueSoonCriticalTasksCount > 0 && (
          <View className="flex-row items-center space-x-1 mr-3">
            <Clock size={14} className="text-orange-500" />
            <Text className="text-xs text-orange-500 font-medium">{dueSoonCriticalTasksCount} Due Soon</Text>
          </View>
        )}
      </View>

      {!isComprehensive && nextCriticalTask && (
        <View className="mt-3 bg-secondary/30 p-2 rounded-lg flex-row items-center">
          <View className="w-2 h-2 rounded-full bg-primary mr-2" />
          <Text className="text-xs text-muted-foreground flex-1" numberOfLines={1}>
            Next up: {nextCriticalTask.title}
          </Text>
        </View>
      )}

      {/* Comprehensive View - Extra Details */}
      {isComprehensive && (
        <View className="mt-4 pt-4 border-t border-border/50">
          <View className="flex-row justify-between mb-3">
             <View>
                <Text className="text-xs text-muted-foreground">Critical Tasks</Text>
                <Text className="text-sm text-foreground font-medium">{overview.criticalTasksCompleted} / {overview.criticalTasksTotal}</Text>
             </View>
             <View>
                <Text className="text-xs text-muted-foreground right-aligned">Other Tasks (Active)</Text>
                <Text className="text-sm text-foreground font-medium pr-1 text-right">{overview.nonCriticalTasks.length}</Text>
             </View>
          </View>

          {nextCriticalTask && (
            <View className="bg-secondary/30 p-3 rounded-lg flex-row justify-between items-center mb-4">
              <View className="flex-1">
                <Text className="text-xs text-muted-foreground mb-1">Critical Next Step</Text>
                <Text className="text-sm text-foreground font-medium" numberOfLines={1}>{nextCriticalTask.title}</Text>
              </View>
              {nextCriticalTask.dueDate && (
                <Text className="text-xs font-semibold px-2 py-1 bg-background rounded text-muted-foreground border border-border">
                  {new Date(nextCriticalTask.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </Text>
              )}
            </View>
          )}

          {/* Quick Actions (Mocked for comprehensive view within dashboard) */}
          <View className="flex-row items-center justify-between">
            <Pressable className="flex-1 py-2 px-3 items-center justify-center rounded-lg bg-primary/10 mr-2">
              <Text className="text-xs font-semibold text-primary">Open Project</Text>
            </Pressable>
            <Pressable className="flex-1 py-2 px-3 items-center justify-center rounded-lg bg-secondary">
              <Text className="text-xs font-semibold text-foreground">Timeline</Text>
            </Pressable>
          </View>
        </View>
      )}
    </Pressable>
  );
}