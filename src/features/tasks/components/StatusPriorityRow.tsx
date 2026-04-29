/**
 * StatusPriorityRow — quick-edit pill selectors for task status and priority.
 *
 * Extracted from TaskBottomSheet for reuse in TaskDetailsPage (issue #131).
 * Purely presentational: callers own the state and optimistic update logic.
 */
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import type { Task } from '../../../domain/entities/Task';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StatusPriorityRowProps {
  status: Task['status'];
  priority: NonNullable<Task['priority']>;
  onStatusChange: (status: Task['status']) => void;
  onPriorityChange: (priority: NonNullable<Task['priority']>) => void;
  /** When true the priority pills are rendered read-only (disabled + dimmed). */
  disablePriority?: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_PILLS: { value: Task['status']; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'completed', label: 'Done' },
];

const PRIORITY_PILLS: { value: NonNullable<Task['priority']>; label: string }[] = [
  { value: 'urgent', label: '🔴 Urgent' },
  { value: 'high', label: '🟠 High' },
  { value: 'medium', label: '🟡 Medium' },
  { value: 'low', label: '🟢 Low' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function StatusPriorityRow({
  status,
  priority,
  onStatusChange,
  onPriorityChange,
  disablePriority = false,
}: StatusPriorityRowProps) {
  return (
    <View className="px-5 pt-3 pb-2 border-b border-slate-200">
      {/* Status pills */}
      <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Status</Text>
      <View className="flex-row flex-wrap gap-2">
        {STATUS_PILLS.map(({ value, label }) => {
          const isActive = status === value;
          return (
            <TouchableOpacity
              key={value}
              testID={`status-pill-${value}`}
              onPress={() => onStatusChange(value)}
              className={`px-3.5 py-1.5 rounded-full border ${
                isActive ? 'bg-blue-500 border-blue-500' : 'bg-slate-50 border-slate-200'
              }`}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              <Text
                className={`text-[13px] font-semibold ${
                  isActive ? 'text-white' : 'text-slate-600'
                }`}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Priority pills */}
      <Text className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 mt-3">Priority</Text>
      <View className="flex-row flex-wrap gap-2">
        {PRIORITY_PILLS.map(({ value, label }) => {
          const isActive = priority === value;
          return (
            <TouchableOpacity
              key={value}
              testID={`priority-pill-${value}`}
              onPress={disablePriority ? undefined : () => onPriorityChange(value)}
              disabled={disablePriority}
              className={`px-3.5 py-1.5 rounded-full border ${
                isActive ? 'bg-blue-500 border-blue-500' : 'bg-slate-50 border-slate-200'
              } ${disablePriority ? 'opacity-40' : ''}`}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive, disabled: disablePriority }}
            >
              <Text
                className={`text-[13px] font-semibold ${
                  isActive ? 'text-white' : 'text-slate-600'
                }`}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}
