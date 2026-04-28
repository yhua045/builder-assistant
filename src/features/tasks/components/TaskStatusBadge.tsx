import React from 'react';
import { View, Text } from 'react-native';
import { Task } from '../../../domain/entities/Task';

interface Props {
  status: Task['status'];
}

export function TaskStatusBadge({ status }: Props) {
  const getStatusConfig = () => {
    switch (status) {
      case 'pending':
        return { label: 'Pending', bg: 'bg-yellow-100 dark:bg-yellow-900', text: 'text-yellow-800 dark:text-yellow-200' };
      case 'in_progress':
        return { label: 'In Progress', bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-800 dark:text-blue-200' };
      case 'completed':
        return { label: 'Completed', bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-800 dark:text-green-200' };
      case 'blocked':
        return { label: 'Blocked', bg: 'bg-red-100 dark:bg-red-900', text: 'text-red-800 dark:text-red-200' };
      case 'cancelled':
        return { label: 'Cancelled', bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-600 dark:text-gray-400' };
      default:
        return { label: status, bg: 'bg-gray-100', text: 'text-gray-800' };
    }
  };

  const config = getStatusConfig();

  return (
    <View className={`px-2 py-1 rounded-full ${config.bg} self-start`}>
      <Text className={`text-xs font-medium ${config.text}`}>
        {config.label}
      </Text>
    </View>
  );
}
