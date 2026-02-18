import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Task } from '../../domain/entities/Task';
import { TaskStatusBadge } from './TaskStatusBadge';
import { Clock, Briefcase } from 'lucide-react-native';
import { cssInterop } from 'nativewind';

cssInterop(Clock, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Briefcase, { className: { target: 'style', nativeStyleToProp: { color: true } } });

interface Props {
  tasks: Task[];
  onPress: (id: string) => void;
}

export function TasksList({ tasks, onPress }: Props) {
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (tasks.length === 0) {
    return (
      <View className="p-8 items-center justify-center">
        <Text className="text-muted-foreground text-center">No tasks found.</Text>
      </View>
    );
  }

  return (
    <View className="gap-3 px-4">
      {tasks.map((task) => (
        <TouchableOpacity
          key={task.id}
          onPress={() => onPress(task.id)}
          className="bg-card border border-border rounded-xl p-4 flex-row items-center active:opacity-70"
        >
          <View className="flex-1 gap-2">
            <View className="flex-row justify-between items-start">
              <Text className="text-foreground font-semibold text-base flex-1 mr-2" numberOfLines={1}>
                {task.title}
              </Text>
              <TaskStatusBadge status={task.status} />
            </View>
            
            <View className="flex-row items-center gap-4">
              {task.dueDate && (
                <View className="flex-row items-center gap-1">
                  <Clock size={14} className="text-muted-foreground" />
                  <Text className="text-muted-foreground text-xs">
                    Due {formatDate(task.dueDate)}
                  </Text>
                </View>
              )}
              
              {task.projectId && (
                <View className="flex-row items-center gap-1">
                  <Briefcase size={14} className="text-muted-foreground" />
                  <Text className="text-muted-foreground text-xs" numberOfLines={1}>
                    Project #{task.projectId.slice(0, 8)}...
                  </Text>
                </View>
              )}
            </View>
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
}
