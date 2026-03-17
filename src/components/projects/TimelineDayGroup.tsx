/**
 * TimelineDayGroup
 *
 * A collapsible day bucket in the project timeline.
 *
 * Layout (design §3.7):
 *   ┌── w-16 ──┬──── flex-1 ────────────────────────────┐
 *   │  20      │  ● vertical line                        │
 *   │  Thu     │  TimelineTaskCard...                    │
 *   └──────────┴─────────────────────────────────────────┘
 *
 * The date label is pinned to items-start so it always aligns with
 * the first task card, regardless of card heights.
 */

import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, LayoutAnimation, Platform, UIManager } from 'react-native';
import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { cssInterop } from 'nativewind';
import { Task } from '../../domain/entities/Task';
import { DayGroup } from '../../hooks/useProjectTimeline';
import { TimelineTaskCard } from './TimelineTaskCard';

cssInterop(ChevronDown, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(ChevronRight, { className: { target: 'style', nativeStyleToProp: { color: true } } });

// Enable LayoutAnimation on Android.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface TimelineDayGroupProps {
  group: DayGroup;
  isLast: boolean;
  onOpenTask: (task: Task) => void;
  onAddProgressLog: (task: Task) => void;
  onAttachDocument: (task: Task) => void;
  onMarkComplete: (task: Task) => void;
  testID?: string;
}

export function TimelineDayGroup({
  group,
  isLast,
  onOpenTask,
  onAddProgressLog,
  onAttachDocument,
  onMarkComplete,
  testID,
}: TimelineDayGroupProps) {
  const [expanded, setExpanded] = useState(true);

  const toggleExpanded = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  }, []);

  return (
    <View className="flex-row" testID={testID}>
      {/* ── Left column: date label (fixed width, top-aligned) ── */}
      <View className="w-16 pr-3 items-end" style={{ paddingTop: 10 }}>
        <Text
          testID={testID ? `${testID}-date-label` : undefined}
          className="text-sm font-bold text-foreground leading-tight"
        >
          {group.date !== '__nodate__'
            ? new Date(`${group.date}T00:00:00Z`).getUTCDate().toString()
            : '—'}
        </Text>
        <Text className="text-xs text-muted-foreground uppercase leading-tight">
          {group.date !== '__nodate__'
            ? new Date(`${group.date}T00:00:00Z`).toLocaleDateString('en-AU', {
                weekday: 'short',
                timeZone: 'UTC',
              })
            : ''}
        </Text>
      </View>

      {/* ── Right column: connector line + task cards ── */}
      <View className="flex-1 relative">
        {/* Vertical connector line — runs full height, hidden on last group */}
        {!isLast && (
          <View className="absolute left-0 top-0 bottom-0 w-px bg-border" />
        )}

        {/* Timeline dot + collapse toggle */}
        <Pressable
          onPress={toggleExpanded}
          className="flex-row items-center gap-2 pb-2 active:opacity-70"
          testID={testID ? `${testID}-toggle` : undefined}
        >
          <View className="w-2.5 h-2.5 rounded-full bg-primary border-2 border-background -ml-[5px]" />
          <Text className="text-xs text-muted-foreground font-medium">{group.label}</Text>
          {expanded ? (
            <ChevronDown size={12} color="#6b7280" />
          ) : (
            <ChevronRight size={12} color="#6b7280" />
          )}
          <View className="ml-1 px-1.5 py-0.5 bg-muted rounded-full">
            <Text className="text-[10px] text-muted-foreground font-semibold">
              {group.tasks.length}
            </Text>
          </View>
        </Pressable>

        {/* Task cards */}
        {expanded && (
          <View className="pl-4 pb-6 gap-2">
            {group.tasks.map((task, idx) => (
              <TimelineTaskCard
                key={task.id}
                task={task}
                onOpen={onOpenTask}
                onAddProgressLog={onAddProgressLog}
                onAttachDocument={onAttachDocument}
                onMarkComplete={onMarkComplete}
                testID={testID ? `${testID}-task-${idx}` : `task-card-${task.id}`}
              />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}
