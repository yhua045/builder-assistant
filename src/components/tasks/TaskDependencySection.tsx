import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Task } from '../../domain/entities/Task';
import { Link2, Plus, AlertCircle, Clock } from 'lucide-react-native';
import { cssInterop } from 'nativewind';

cssInterop(Link2, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Plus, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(AlertCircle, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Clock, { className: { target: 'style', nativeStyleToProp: { color: true } } });

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
  const blockingCount = dependencyTasks.filter(
    (t) => t.status !== 'completed' && t.status !== 'cancelled',
  ).length;

  return (
    <View className="px-6 mb-6">
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-2">
          <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Dependent Tasks
          </Text>
        </View>
        <View className="flex-row items-center gap-3">
          {blockingCount > 0 && (
            <Text className="text-xs text-amber-600 font-semibold">
              {blockingCount} blocked
            </Text>
          )}
          {onAddDependency && (
            <TouchableOpacity onPress={onAddDependency} className="p-1">
              <Plus size={16} className="text-primary" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {dependencyTasks.length === 0 ? (
        <View className="bg-card border border-border rounded-2xl p-4">
          <Text className="text-sm text-muted-foreground text-center">No dependent tasks</Text>
        </View>
      ) : (
        <View className="gap-3">
          {dependencyTasks.map((dep) => {
            const isBlocked = dep.status !== 'completed' && dep.status !== 'cancelled';
            
            return (
              <TouchableOpacity
                key={dep.id}
                onLongPress={() => onRemoveDependency?.(dep.id)}
                delayLongPress={500}
                onPress={() => onDependencyPress?.(dep)}
                className="bg-card border border-border rounded-2xl p-4"
              >
                <View className="flex-row items-start justify-between">
                  <View className="flex-1 mr-3">
                    <View className="flex-row items-center gap-2 mb-1">
                      <Link2 className="text-muted-foreground" size={14} />
                      <Text className="text-foreground font-semibold text-sm">
                        {dep.title}
                      </Text>
                    </View>
                    <View className="flex-row items-center gap-2 mt-2">
                      {isBlocked ? (
                        <>
                          <AlertCircle className="text-red-500" size={14} />
                          <Text className="text-red-500 text-xs font-medium">
                            Blocked by this task
                          </Text>
                        </>
                      ) : (
                        <>
                          <Clock className="text-amber-500" size={14} />
                          <Text className="text-muted-foreground text-xs">
                            Waiting for completion
                          </Text>
                        </>
                      )}
                    </View>
                  </View>
                  {isBlocked && (
                    <View className="bg-red-50 px-2 py-1 rounded-md">
                      <Text className="text-red-600 text-xs font-bold">BLOCKED</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}
