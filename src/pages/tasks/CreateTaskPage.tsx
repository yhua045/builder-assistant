import React, { useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { TaskForm } from '../../components/tasks/TaskForm';
import { useTasks } from '../../hooks/useTasks';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CreateTaskPage() {
  const navigation = useNavigation<any>();
  const { createTask, loading } = useTasks();

  const handleCreate = async (data: any) => {
    try {
      await createTask(data);
      navigation.goBack();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to create task');
    }
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <View className="px-6 py-4 border-b border-border">
        <Text className="text-xl font-bold text-foreground">New Task</Text>
      </View>
      <TaskForm
        onSubmit={handleCreate}
        onCancel={() => navigation.goBack()}
        isLoading={loading}
      />
    </SafeAreaView>
  );
}
