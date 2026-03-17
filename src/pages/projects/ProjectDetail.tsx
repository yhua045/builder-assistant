/**
 * ProjectDetail screen
 *
 * Displays project header metadata and a vertical, day-grouped task timeline.
 * Data is fetched via useProjectTimeline which reuses the shared react-query
 * cache (queryKeys.tasks / queryKeys.projectDetail).
 *
 * Navigation: pushed from ProjectsNavigator → ProjectDetail { projectId }.
 */

import React, { useCallback, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { cssInterop } from 'nativewind';
import {
  ArrowLeft,
  MapPin,
  Phone,
  Calendar,
  Clock,
  Layers,
} from 'lucide-react-native';
import { useProjectTimeline } from '../../hooks/useProjectTimeline';
import { TimelineDayGroup } from '../../components/projects/TimelineDayGroup';
import { Task } from '../../domain/entities/Task';

cssInterop(ArrowLeft, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(MapPin, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Phone, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Calendar, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Clock, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(Layers, { className: { target: 'style', nativeStyleToProp: { color: true } } });

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDisplayDate(date: Date | undefined | null): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-AU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function ProjectDetailScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { projectId } = route.params as { projectId: string };

  const { project, dayGroups, loading, error, markComplete } =
    useProjectTimeline(projectId);

  // Scroll to today's group on first data load
  const scrollRef = useRef<ScrollView>(null);

  const handleOpenTask = useCallback(
    (task: Task) => {
      navigation.navigate('TaskDetails', { taskId: task.id });
    },
    [navigation],
  );

  const handleAddProgressLog = useCallback((task: Task) => {
    // Navigate to TaskDetails with the progress-log modal pre-opened.
    // TaskDetailsPage handles this via its own internal state.
    navigation.navigate('TaskDetails', { taskId: task.id, openProgressLog: true });
  }, [navigation]);

  const handleAttachDocument = useCallback((task: Task) => {
    navigation.navigate('TaskDetails', { taskId: task.id, openDocument: true });
  }, [navigation]);

  const handleMarkComplete = useCallback(
    async (task: Task) => {
      Alert.alert(
        'Mark Complete',
        `Mark "${task.title}" as completed?`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Complete',
            style: 'default',
            onPress: async () => {
              try {
                await markComplete(task);
              } catch {
                Alert.alert('Error', 'Could not update task. Please try again.');
              }
            },
          },
        ],
      );
    },
    [markComplete],
  );

  const statusLabel = project?.status
    ? project.status.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : '—';

  const isActive =
    project?.status === 'in_progress' || (project?.status as string) === 'active';

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* ── Header bar ─────────────────────────────────────────────── */}
      <View className="px-6 py-4 flex-row items-center justify-between border-b border-border">
        <Pressable onPress={() => navigation.goBack()} className="p-2 -ml-2">
          <ArrowLeft className="text-foreground" size={24} />
        </Pressable>
        <View className="flex-row items-center gap-2">
          <Layers className="text-primary" size={20} />
          <Text className="text-lg font-bold text-foreground">Project Details</Text>
        </View>
        <View className="w-8" />
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={{ paddingBottom: 128 }}>
        {/* ── Loading / error states ──────────────────────────────── */}
        {loading && (
          <View className="p-8 items-center">
            <ActivityIndicator testID="project-detail-loading" size="large" />
          </View>
        )}

        {!loading && error && (
          <View className="p-6">
            <Text testID="project-detail-error" className="text-destructive text-center">
              {error}
            </Text>
          </View>
        )}

        {/* ── Project header card ─────────────────────────────────── */}
        {!loading && !error && (
          <View className="p-6 bg-card border-b border-border">
            <View className="flex-row items-start justify-between mb-4">
              <View className="flex-1 mr-4">
                <Text
                  testID="project-detail-name"
                  className="text-2xl font-bold text-foreground mb-1"
                >
                  {project?.name ?? '—'}
                </Text>
                {project?.location ? (
                  <View className="flex-row items-center mt-1 gap-1.5">
                    <MapPin className="text-muted-foreground" size={14} />
                    <Text
                      className="text-muted-foreground text-sm flex-1"
                      numberOfLines={2}
                    >
                      {project.location}
                    </Text>
                  </View>
                ) : null}
              </View>
              <View
                className={`px-3 py-1.5 rounded-full ${
                  isActive ? 'bg-chart-2/10' : 'bg-chart-4/10'
                }`}
              >
                <Text
                  className={`text-xs font-semibold uppercase tracking-wide ${
                    isActive ? 'text-chart-2' : 'text-chart-4'
                  }`}
                >
                  {statusLabel}
                </Text>
              </View>
            </View>

            {/* Start / End dates */}
            <View className="flex-row gap-4 mt-2">
              <View className="flex-1 bg-muted/50 rounded-xl p-3">
                <View className="flex-row items-center gap-1.5 mb-1">
                  <Calendar className="text-muted-foreground" size={13} />
                  <Text className="text-xs text-muted-foreground uppercase">
                    Start
                  </Text>
                </View>
                <Text className="text-sm font-semibold text-foreground">
                  {formatDisplayDate(project?.startDate)}
                </Text>
              </View>
              <View className="flex-1 bg-muted/50 rounded-xl p-3">
                <View className="flex-row items-center gap-1.5 mb-1">
                  <Clock className="text-muted-foreground" size={13} />
                  <Text className="text-xs text-muted-foreground uppercase">
                    Est. End
                  </Text>
                </View>
                <Text className="text-sm font-semibold text-foreground">
                  {formatDisplayDate(project?.expectedEndDate)}
                </Text>
              </View>
            </View>

            {/* Owner contact — sourced from hydrated Contact entity */}
            {project?.owner && (
              <View className="flex-row items-center mt-4 pt-4 border-t border-border/50 gap-2">
                <Phone className="text-muted-foreground" size={15} />
                <Text className="text-foreground font-medium text-sm">
                  {project.owner.name}
                  {project.owner.phone ? `  ·  ${project.owner.phone}` : ''}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ── Task timeline ───────────────────────────────────────── */}
        {!loading && !error && (
          <View className="p-6">
            <Text className="text-xl font-bold text-foreground mb-4">
              Task Timeline
            </Text>

            {dayGroups.length === 0 && (
              <Text
                testID="project-detail-no-tasks"
                className="text-muted-foreground text-center py-8"
              >
                No tasks scheduled for this project.
              </Text>
            )}

            {dayGroups.map((group, idx) => (
              <TimelineDayGroup
                key={group.date}
                group={group}
                isLast={idx === dayGroups.length - 1}
                onOpenTask={handleOpenTask}
                onAddProgressLog={handleAddProgressLog}
                onAttachDocument={handleAttachDocument}
                onMarkComplete={handleMarkComplete}
                testID={`day-group-${group.date}`}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
