import React, { useState, useEffect } from 'react';
import { View, Text, Alert, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { TaskForm } from '../../components/tasks/TaskForm';
import { useTasks } from '../../hooks/useTasks';
import { Task } from '../../domain/entities/Task';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function EditTaskPage() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { taskId } = route.params;
  const { getTask, updateTask, loading: saving, tasks } = useTasks(); 
  // Wait, useTasks fetches all tasks implicitly. 
  // We can also use getTask explicitly.

  const [task, setTask] = useState<Task | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    let mounted = true;
    getTask(taskId).then(t => {
      if (mounted) {
        setTask(t);
        setFetching(false);
      }
    }).catch(e => {
       console.error(e);
       if (mounted) setFetching(false);
    });
    return () => { mounted = false; };
  }, [taskId]);

  const handleUpdate = async (data: Partial<Task>) => {
    if (!task) return;
    try {
      await updateTask({ ...task, ...data });
      navigation.goBack();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to update task');
    }
  };

  if (fetching) {
    return <ActivityIndicator className="flex-1" />;
  }

  if (!task) {
    return (
      <View className="flex-1 items-center justify-center">
        <Text>Task not found</Text>
      </View>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <View className="px-6 py-4 border-b border-border">
        <Text className="text-xl font-bold text-foreground">Edit Task</Text>
      </View>
      <TaskForm
        initialValues={task}
        onSubmit={handleUpdate}
        onCancel={() => navigation.goBack()}
        isLoading={saving}
      />
    </SafeAreaView>
  );
}
