import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useTasks } from '../../hooks/useTasks';
import { TasksList } from '../../components/tasks/TasksList';
import { Plus, Filter } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { ThemeToggle } from '../../components/ThemeToggle';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cssInterop, useColorScheme } from 'nativewind';

cssInterop(Plus, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Filter, { className: { target: 'style', nativeStyleToProp: { color: true } } });

export default function TasksListPage() {
  const { tasks, loading, refreshTasks } = useTasks();
  const navigation = useNavigation<any>();
  const [filter, setFilter] = useState<'all' | 'pending' | 'in_progress'>('all');
  
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const filteredTasks = useMemo(() => {
    if (filter === 'all') return tasks;
    return tasks.filter(t => t.status === filter);
  }, [tasks, filter]);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-row justify-between items-center px-6 py-4 border-b border-border">
        <View>
          <Text className="text-2xl font-bold text-foreground">Tasks</Text>
          <Text className="text-muted-foreground">Manage your work</Text>
        </View>
        <View className="flex-row gap-2">
          <ThemeToggle />
          <TouchableOpacity 
            onPress={() => navigation.navigate('CreateTask')}
            className="w-10 h-10 rounded-full bg-primary items-center justify-center"
          >
            <Plus size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      <View className="px-4 py-2 flex-row gap-2">
         {/* Simple Filter Pills */}
         {(['all', 'pending', 'in_progress'] as const).map(f => (
            <TouchableOpacity 
              key={f}
              onPress={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full border ${
                filter === f 
                  ? 'bg-primary border-primary' 
                  : 'bg-card border-border'
              }`}
            >
              <Text className={`text-xs capitalize ${
                filter === f ? 'text-primary-foreground font-medium' : 'text-muted-foreground'
              }`}>
                {f.replace('_', ' ')}
              </Text>
            </TouchableOpacity>
         ))}
      </View>

      <ScrollView
        className="flex-1"
        refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshTasks} />}
      >
        <View className="py-4">
          <TasksList 
            tasks={filteredTasks} 
            onPress={(id) => navigation.navigate('TaskDetails', { taskId: id })}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
