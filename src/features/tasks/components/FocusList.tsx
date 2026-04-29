/**
 * FocusList — ranked list of the top-3 focus tasks from the cockpit.
 *
 * Consumed by TasksScreen (src/pages/tasks/index.tsx).
 * Data comes from useCockpitData → CockpitData.focus3.
 */
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { FocusItem } from '../../../domain/entities/CockpitData';
import { Task } from '../../../domain/entities/Task';

export interface FocusListProps {
  /** Max 3 items from useCockpitData focus3. */
  focusItems: FocusItem[];
  /** Called when a row is tapped — passes only the task (issue #131: simplified signature). */
  onItemPress: (task: Task) => void;
}

const RANK_LABELS = ['#1', '#2', '#3'] as const;

export function FocusList({ focusItems, onItemPress }: FocusListProps) {
  if (focusItems.length === 0) return null;

  return (
    <View className="mb-2" testID="focus-list">
      <Text className="text-[13px] font-bold text-slate-500 uppercase tracking-wider px-6 pb-2 pt-1">🎯 Focus</Text>
      <View className="mx-6 rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
        {focusItems.map((item, index) => (
          <TouchableOpacity
            key={item.task.id}
            testID={`focus-item-${item.task.id}`}
            onPress={() => onItemPress(item.task)}
            className={`flex-row items-center px-3.5 py-3 ${
              index < focusItems.length - 1 ? 'border-b border-slate-200' : ''
            }`}
            accessible
            accessibilityRole="button"
            accessibilityLabel={`Focus task ${RANK_LABELS[index]}: ${item.task.title}. ${item.urgencyLabel}. Tap to open details.`}
          >
            {/* Rank badge */}
            <View className="w-8 h-8 rounded-full bg-slate-100 items-center justify-center mr-3 shrink-0">
              <Text className="text-[11px] font-bold text-slate-600">{RANK_LABELS[index] ?? `#${index + 1}`}</Text>
            </View>

            {/* Row content */}
            <View className="flex-1">
              {/* Top row: title + urgency label */}
              <View className="flex-row items-center justify-between gap-2">
                <Text className="text-sm font-semibold text-slate-900 flex-1" numberOfLines={1}>
                  {item.task.title}
                </Text>
                {item.urgencyLabel ? (
                  <Text className="text-xs text-slate-500 shrink-0">{item.urgencyLabel}</Text>
                ) : null}
              </View>

              {/* Sub-row: score + next-in-line */}
              <Text className="text-[11px] text-slate-400 mt-0.5">
                {`Score: ${item.score}${
                  item.nextInLine.length > 0
                    ? ` · ${item.nextInLine.length} tasks waiting`
                    : ''
                }`}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}
