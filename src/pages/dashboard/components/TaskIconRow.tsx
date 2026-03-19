import React from 'react';
import { View } from 'react-native';
import { Task } from '../../../domain/entities/Task';
import { Check, X, Clock } from 'lucide-react-native';

interface TaskIconRowProps {
  tasks: Task[];
}

export function TaskIconRow({ tasks }: TaskIconRowProps) {
  if (!tasks || tasks.length === 0) return null;

  return (
    <View className="flex-row flex-wrap items-center gap-2 mt-3 mb-4">
      {tasks.map(task => {
        let bgColor = "bg-secondary";
        let IconIcon = Clock;
        let iconColor = "#888";

        if (task.status === 'completed') {
          bgColor = "bg-green-500";
          IconIcon = Check;
          iconColor = "#fff";
        } else if (task.status === 'blocked') {
          bgColor = "bg-red-500";
          IconIcon = X;
          iconColor = "#fff";
        } else if (task.status === 'in_progress') {
           bgColor = "bg-orange-400";
           iconColor = "#fff";
        } else {
           bgColor = "bg-orange-500"; // pending color from mockup
           iconColor = "#fff";
        }

        return (
          <View 
            key={task.id} 
            className={`w-7 h-7 rounded-full items-center justify-center ${bgColor}`}
          >
             <IconIcon size={14} color={iconColor} strokeWidth={2.5} />
          </View>
        );
      })}
    </View>
  );
}
