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
import { CriticalTasksTimeline } from '../../components/tasks/CriticalTasksTimeline';
import { FocusList } from '../../components/tasks/FocusList';
import type { Task } from '../../domain/entities/Task';
import { selectTopBlockedTasks, BlockedTaskItem } from '../../utils/selectTopBlockedTasks';

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
  const [selectedFilters, setSelectedFilters] = useState<Set<FilterValue>>(
    new Set(['all'])
  );

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
    if (selectedFilters.has('all') || selectedFilters.size === 0) return tasks;
    return tasks.filter((t) => selectedFilters.has(t.status as FilterValue));
  }, [tasks, selectedFilters]);

  const containerBg = isDark ? styles.darkBg : styles.lightBg;

  // Derive timeline items from tasks
  const timelineItems = useMemo(() => {
    // Map Task to BlockedTaskItem
    const rawItems: BlockedTaskItem[] = tasks.map(t => {
      const project = projects.find(p => p.id === t.projectId);
      return {
        id: t.id,
        title: t.title,
        projectId: t.projectId || 'unassigned',
        projectName: project?.name || 'No Project',
        scheduledAt: t.scheduledAt,
        status: t.status as 'blocked' | 'pending', // domain type allows other statuses but util filters 'blocked'
        severity: (t.priority as BlockedTaskItem['severity']) || 'medium',
      };
    });
    return selectTopBlockedTasks(rawItems, 2);
  }, [tasks, projects]);

  const blockBarOrWinning = blockerBarResult?.kind === 'winning' ? blockerBarResult : null;

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

      {/* Hero: Winning Card */}
      {blockBarOrWinning && (
        <View className="pt-4">
          <BlockerCarousel
            data={blockBarOrWinning}
            onCardPress={handleBlockerCardPress}
          />
        </View>
      )}

      {/* Hero: Critical Timeline (primary section, top of screen) */}
      {timelineItems.length > 0 && !blockBarOrWinning && (
        <View className="px-6 py-4">
          <View className="flex-row items-center gap-2 mb-4">
            <Text className="text-lg font-bold text-foreground">Critical Tasks</Text>
          </View>
          <CriticalTasksTimeline
            testID="critical-tasks-timeline"
            items={timelineItems}
            onItemPress={(item) => navigation.navigate('TaskDetails', { taskId: item.id })}
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
          {FILTER_PILLS.map(({ label, value }) => {
            const selected = selectedFilters.has(value);
            return (
              <TouchableOpacity
                key={value}
                testID={`filter-pill-${value}`}
                onPress={() => {
                  setSelectedFilters((prev) => {
                    const next = new Set(prev);
                    if (value === 'all') {
                      // Toggle 'all' — if enabling, clear others; if disabling, remove it
                      if (next.has('all')) {
                        next.delete('all');
                      } else {
                        next.clear();
                        next.add('all');
                      }
                    } else {
                      // If 'all' was selected, remove it when selecting specific filters
                      if (next.has('all')) next.delete('all');
                      if (next.has(value)) next.delete(value);
                      else next.add(value);
                    }
                    return next;
                  });
                }}
                className={`px-4 py-2 rounded-full border ${
                  selected ? 'bg-primary border-primary' : 'bg-card border-border'
                }`}
              >
                <Text
                  className={`text-xs font-semibold ${
                    selected ? 'text-primary-foreground' : 'text-foreground'
                  }`}
                >
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
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
