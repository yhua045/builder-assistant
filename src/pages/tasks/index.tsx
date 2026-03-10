import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Plus } from 'lucide-react-native';
import { ThemeToggle } from '../../components/ThemeToggle';
import { cssInterop, useColorScheme } from 'nativewind';
import { useNavigation } from '@react-navigation/native';
import { useTasks } from '../../hooks/useTasks';
import { useProjects } from '../../hooks/useProjects';
import { useCockpitData } from '../../hooks/useCockpitData';
import { useBlockerBar } from '../../hooks/useBlockerBar';
import { TasksList } from '../../components/tasks/TasksList';
import { BlockerCarousel } from '../../components/tasks/BlockerCarousel';
import { FocusList } from '../../components/tasks/FocusList';
import type { Task } from '../../domain/entities/Task';

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
  const { tasks, loading, refreshTasks, updateTask } = useTasks();
  const navigation = useNavigation<any>();
  const [filter, setFilter] = useState<FilterValue>('all');

  // ── Cockpit data ────────────────────────────────────────────────
  // useBlockerBar iterates all projects to find the first with active blockers.
  // useCockpitData drives the Focus-3 list for the default (first) project.
  const { projects } = useProjects();
  const defaultProjectId = useMemo(() => projects[0]?.id ?? '', [projects]);
  const { cockpit, refresh: refreshCockpit } = useCockpitData(defaultProjectId);
  const { result: blockerBarResult, refresh: refreshBlockerBar } = useBlockerBar(projects);

  // ── Navigation handler ──────────────────────────────────────────
  // Directly navigate to TaskDetails — no intermediate bottom sheet (issue #131)
  const handleBlockerCardPress = useCallback((task: Task) => {
    navigation.navigate('TaskDetails', { taskId: task.id });
  }, [navigation]);

  // ── Refresh coordination ─────────────────────────────────────────
  const handleRefresh = useCallback(async () => {
    await Promise.all([refreshTasks(), refreshCockpit(), refreshBlockerBar()]);
  }, [refreshTasks, refreshCockpit, refreshBlockerBar]);

  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const filteredTasks = useMemo(() => {
    if (filter === 'all') return tasks;
    return tasks.filter((t) => t.status === filter);
  }, [tasks, filter]);

  const containerBg = isDark ? styles.darkBg : styles.lightBg;

  return (
    <SafeAreaView
      className="flex-1 bg-background"
      style={containerBg}
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

      {/* Hero: Blocker Carousel (primary section, top of screen) */}
      {blockerBarResult && (
        <View className="pt-4">
          <BlockerCarousel
            data={blockerBarResult}
            onCardPress={handleBlockerCardPress}
          />
        </View>
      )}

      {/* Cockpit — Focus List */}
      {cockpit && cockpit.focus3.length > 0 && (
        <View className="pt-1 pb-2">
          <FocusList
            focusItems={cockpit.focus3}
            onItemPress={handleBlockerCardPress}
          />
        </View>
      )}

      {/* Filter Pills */}
      <View className="px-6 pb-2">
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={filterContentStyle}
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
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            testID="tasks-refresh-control"
            refreshing={loading}
            onRefresh={handleRefresh}
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

const filterContentStyle = { gap: 8 } as const;

const styles = StyleSheet.create({
  darkBg: { backgroundColor: '#0f172a' },
  lightBg: { backgroundColor: '#fafbfc' },
  scrollContent: { paddingBottom: 128 },
});
