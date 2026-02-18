import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar, Clock, Plus } from 'lucide-react-native';
import { ThemeToggle } from '../../components/ThemeToggle';
import { cssInterop, useColorScheme } from 'nativewind';
import { useNavigation } from '@react-navigation/native';
import { useTasks } from '../../hooks/useTasks';
import { TasksList } from '../../components/tasks/TasksList';

cssInterop(Calendar, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Clock, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Plus, { className: { target: 'style', nativeStyleToProp: { color: true } } });

type FilterValue = 'all' | 'pending' | 'in_progress' | 'completed' | 'blocked';

const FILTER_PILLS: { label: string; value: FilterValue }[] = [
  { label: 'All', value: 'all' },
  { label: 'Pending', value: 'pending' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Completed', value: 'completed' },
  { label: 'Blocked', value: 'blocked' },
];

export default function TasksScreen() {
  const { tasks, loading, refreshTasks } = useTasks();
  const navigation = useNavigation<any>();
  const [filter, setFilter] = useState<FilterValue>('all');

  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const filteredTasks = useMemo(() => {
    if (filter === 'all') return tasks;
    return tasks.filter((t) => t.status === filter);
  }, [tasks, filter]);

  const pendingCount = useMemo(
    () => tasks.filter((t) => t.status === 'pending').length,
    [tasks],
  );
  const inProgressCount = useMemo(
    () => tasks.filter((t) => t.status === 'in_progress').length,
    [tasks],
  );

  return (
    <SafeAreaView
      className="flex-1 bg-background"
      style={{ backgroundColor: isDark ? '#0f172a' : '#fafbfc' }}
      edges={['top']}
    >
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4 border-b border-border">
        <View>
          <Text className="text-2xl font-bold text-foreground">Tasks</Text>
          <Text className="text-sm text-muted-foreground mt-1">Manage your work</Text>
        </View>
        <View className="flex-row gap-2 items-center">
          <ThemeToggle />
          <TouchableOpacity
            testID="create-task-btn"
            onPress={() => navigation.navigate('CreateTask')}
            className="w-10 h-10 rounded-full bg-primary items-center justify-center"
          >
            <Plus size={24} color="white" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Summary Cards */}
      <View className="px-6 pt-4 pb-2">
        <View className="flex-row gap-4">
          <View className="flex-1 bg-card rounded-2xl p-4 border border-border">
            <View className="flex-row items-center justify-between mb-2">
              <Calendar className="text-primary" size={24} />
              <View className="bg-blue-100 px-3 py-1 rounded-full">
                <Text className="text-blue-700 font-bold text-xs">PENDING</Text>
              </View>
            </View>
            <Text testID="summary-pending-count" className="text-3xl font-bold text-foreground">
              {pendingCount}
            </Text>
            <Text className="text-sm text-muted-foreground mt-1">Pending Tasks</Text>
          </View>

          <View className="flex-1 bg-card rounded-2xl p-4 border border-border">
            <View className="flex-row items-center justify-between mb-2">
              <Clock className="text-amber-500" size={24} />
              <View className="bg-amber-100 px-3 py-1 rounded-full">
                <Text className="text-amber-700 font-bold text-xs">IN PROGRESS</Text>
              </View>
            </View>
            <Text testID="summary-in-progress-count" className="text-3xl font-bold text-foreground">
              {inProgressCount}
            </Text>
            <Text className="text-sm text-muted-foreground mt-1">In Progress</Text>
          </View>
        </View>
      </View>

      {/* Filter Pills */}
      <View className="px-6 pb-2">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8 }}
        >
          {FILTER_PILLS.map(({ label, value }) => (
            <TouchableOpacity
              key={value}
              testID={`filter-pill-${value}`}
              onPress={() => setFilter(value)}
              className={`px-4 py-2 rounded-full border ${
                filter === value ? 'bg-primary border-primary' : 'bg-card border-border'
              }`}
            >
              <Text
                className={`text-xs font-semibold ${
                  filter === value ? 'text-primary-foreground' : 'text-foreground'
                }`}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Task List */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 128 }}
        refreshControl={
          <RefreshControl
            testID="tasks-refresh-control"
            refreshing={loading}
            onRefresh={refreshTasks}
          />
        }
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
