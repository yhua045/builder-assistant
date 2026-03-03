import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Task } from '../../domain/entities/Task';
import { TaskStatusBadge } from './TaskStatusBadge';
import { Link2, Plus, AlertTriangle } from 'lucide-react-native';
import { cssInterop } from 'nativewind';

cssInterop(Link2, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Plus, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(AlertTriangle, { className: { target: 'style', nativeStyleToProp: { color: true } } });

interface Props {
  dependencyTasks: Task[];
  onAddDependency?: () => void;
  onRemoveDependency?: (dependsOnTaskId: string) => void;
  onDependencyPress?: (task: Task) => void;
}

export function TaskDependencySection({
  dependencyTasks,
  onAddDependency,
  onRemoveDependency,
  onDependencyPress,
}: Props) {
  const hasBlockingDependency = dependencyTasks.some(
    (t) => t.status !== 'completed' && t.status !== 'cancelled',
  );

  return (
    <View className="bg-card p-4 rounded-lg border border-border">
      <View className="flex-row justify-between items-center mb-3">
        <View className="flex-row items-center gap-2">
          <Text className="text-sm font-semibold text-muted-foreground">DEPENDENCIES</Text>
          {hasBlockingDependency && (
            <View className="flex-row items-center gap-1 bg-red-100 dark:bg-red-900 px-2 py-0.5 rounded-full">
              <AlertTriangle size={12} className="text-red-600 dark:text-red-300" />
              <Text className="text-xs font-medium text-red-600 dark:text-red-300">Blocked</Text>
            </View>
          )}
        </View>
        {onAddDependency && (
          <TouchableOpacity onPress={onAddDependency} className="flex-row items-center gap-1">
            <Plus size={16} className="text-primary" />
            <Text className="text-sm text-primary font-medium">Add</Text>
          </TouchableOpacity>
        )}
      </View>

      {dependencyTasks.length === 0 ? (
        <Text className="text-sm text-muted-foreground">No dependencies</Text>
      ) : (
        <View className="gap-2">
          {dependencyTasks.map((dep) => (
            <TouchableOpacity
              key={dep.id}
              onPress={() => onDependencyPress?.(dep)}
              className="flex-row items-center justify-between bg-muted p-3 rounded-lg"
            >
              <View className="flex-row items-center gap-2 flex-1 mr-2">
                <Link2 size={14} className="text-muted-foreground" />
                <Text className="text-sm text-foreground" numberOfLines={1}>
                  {dep.title}
                </Text>
              </View>
              <TaskStatusBadge status={dep.status} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}
