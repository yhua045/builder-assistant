import React from 'react';
import { View } from 'react-native';
import { Task } from '../../../domain/entities/Task';
import { Check, X, Clock, AlertTriangle } from 'lucide-react-native';

interface TaskIconRowProps {
  tasks: Task[];
}

export function TaskIconRow({ tasks }: TaskIconRowProps) {
  if (!tasks || tasks.length === 0) return null;

  return (
    <View className="flex-row items-center gap-3 mt-3 mb-4">
      {tasks.slice(0, 6).map(task => {
        let bgColor = 'bg-yellow-500';
        let IconComponent: React.ElementType = Clock;
        const iconColor = '#fff';

        if (task.status === 'completed') {
          bgColor = 'bg-green-500';
          IconComponent = Check;
        } else if (task.status === 'blocked') {
          bgColor = 'bg-red-500';
          IconComponent = X;
        } else if ((task.status as string) === 'overdue') {
          bgColor = 'bg-red-600';
          IconComponent = AlertTriangle;
        }
        // pending / in_progress → yellow clock (default)

        return (
          <View
            key={task.id}
            className={`w-8 h-8 rounded-full items-center justify-center shadow-sm ${bgColor}`}
          >
            <IconComponent size={12} color={iconColor} strokeWidth={2.5} />
          </View>
        );
      })}
    </View>
  );
}
