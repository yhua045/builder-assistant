import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTasks } from '../../hooks/useTasks';
import { Task } from '../../domain/entities/Task';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TaskStatusBadge } from '../../components/tasks/TaskStatusBadge';
import { Edit, Trash2, Calendar, Clock, MapPin, ArrowLeft } from 'lucide-react-native';
import { cssInterop } from 'nativewind';

cssInterop(Edit, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Trash2, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Calendar, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Clock, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(ArrowLeft, { className: { target: 'style', nativeStyleToProp: { color: true } } });

export default function TaskDetailsPage() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { taskId } = route.params;
  const { getTask, deleteTask } = useTasks();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const t = await getTask(taskId);
      setTask(t);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [taskId, getTask]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      loadData();
    });
    // Load initial data
    loadData();
    return unsubscribe;
  }, [navigation, loadData]);

  const handleDelete = () => {
    Alert.alert(
      'Delete Task',
      'Are you sure you want to delete this task?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTask(taskId);
              navigation.goBack();
            } catch (e) {
              Alert.alert('Error', 'Failed to delete task');
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator />
      </View>
    );
  }

  if (!task) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <Text className="text-muted-foreground">Task not found</Text>
      </View>
    );
  }

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-background">
      <View className="flex-row justify-between items-center px-4 py-4 border-b border-border">
        <TouchableOpacity onPress={() => navigation.goBack()} className="p-2">
          <ArrowLeft size={24} className="text-foreground" />
        </TouchableOpacity>
        <View className="flex-row gap-2">
          <TouchableOpacity onPress={() => navigation.navigate('EditTask', { taskId })} className="p-2">
            <Edit size={20} className="text-foreground" />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} className="p-2">
            <Trash2 size={20} className="text-destructive" />
          </TouchableOpacity>
        </View>
      </View>
      
      <ScrollView className="flex-1 p-6">
        <View className="flex-row justify-between items-start mb-4">
          <Text className="text-2xl font-bold text-foreground flex-1 mr-4">{task.title}</Text>
          <TaskStatusBadge status={task.status} />
        </View>

        <View className="gap-4 mb-6">
          {task.dueDate && (
             <View className="flex-row items-center gap-2">
               <Calendar size={18} className="text-muted-foreground" />
               <Text className="text-foreground">Due: {new Date(task.dueDate).toLocaleDateString()}</Text>
             </View>
          )}
          {task.scheduledAt && (
             <View className="flex-row items-center gap-2">
               <Clock size={18} className="text-muted-foreground" />
               <Text className="text-foreground">Scheduled: {new Date(task.scheduledAt).toLocaleString()}</Text>
             </View>
          )}
          {task.projectId && (
             <View className="flex-row items-center gap-2">
               <MapPin size={18} className="text-muted-foreground" />
               <Text className="text-foreground">Project ID: {task.projectId}</Text>
             </View>
          )}
        </View>
        
        {task.notes && (
          <View className="bg-card p-4 rounded-lg border border-border">
            <Text className="text-sm font-semibold text-muted-foreground mb-2">NOTES</Text>
            <Text className="text-foreground leading-6">{task.notes}</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
