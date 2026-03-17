import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Task } from '../../domain/entities/Task';
import { Link2, Plus, AlertCircle, Clock, Play, CheckCircle, XCircle } from 'lucide-react-native';
import { cssInterop } from 'nativewind';

cssInterop(Link2, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Plus, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(AlertCircle, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Clock, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Play, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(CheckCircle, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(XCircle, { className: { target: 'style', nativeStyleToProp: { color: true } } });

// ── Status display helper ────────────────────────────────────────────────────

interface DependencyStatusDisplay {
  icon: React.ReactElement;
  label: string;
  textClass: string;
}

function getDependencyStatusDisplay(status: Task['status']): DependencyStatusDisplay {
  switch (status) {
    case 'completed':
      return {
        icon: <CheckCircle size={14} className="text-green-500" />,
        label: 'Complete',
        textClass: 'text-green-600',
      };
    case 'in_progress':
      return {
        icon: <Play size={14} className="text-blue-500" />,
        label: 'In progress',
        textClass: 'text-blue-600',
      };
    case 'blocked':
      return {
        icon: <AlertCircle size={14} className="text-red-500" />,
        label: 'Blocked',
        textClass: 'text-red-600',
      };
    case 'cancelled':
      return {
        icon: <XCircle size={14} className="text-gray-400" />,
        label: 'Cancelled',
        textClass: 'text-gray-500',
      };
    case 'pending':
    default:
      return {
        icon: <Clock size={14} className="text-amber-500" />,
        label: 'Waiting to complete',
        textClass: 'text-amber-600',
      };
  }
}

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
            const statusDisplay = getDependencyStatusDisplay(dep.status);
            const isActive = dep.status !== 'completed' && dep.status !== 'cancelled';

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
                      {statusDisplay.icon}
                      <Text className={`text-xs font-medium ${statusDisplay.textClass}`}>
                        {statusDisplay.label}
                      </Text>
                    </View>
                  </View>
                  {isActive && (
                    <View className="bg-amber-50 px-2 py-1 rounded-md">
                      <Text className="text-amber-700 text-xs font-bold uppercase">
                        {dep.status.replace('_', ' ')}
                      </Text>
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
