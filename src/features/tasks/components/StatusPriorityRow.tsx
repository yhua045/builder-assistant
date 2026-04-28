/**
 * StatusPriorityRow — quick-edit pill selectors for task status and priority.
 *
 * Extracted from TaskBottomSheet for reuse in TaskDetailsPage (issue #131).
 * Purely presentational: callers own the state and optimistic update logic.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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
    <View style={styles.container}>
      {/* Status pills */}
      <Text style={styles.sectionLabel}>Status</Text>
      <View style={styles.pillRow}>
        {STATUS_PILLS.map(({ value, label }) => {
          const isActive = status === value;
          return (
            <TouchableOpacity
              key={value}
              testID={`status-pill-${value}`}
              onPress={() => onStatusChange(value)}
              style={[styles.pill, isActive ? styles.pillActive : styles.pillInactive]}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
            >
              <Text
                style={[
                  styles.pillText,
                  isActive ? styles.pillTextActive : styles.pillTextInactive,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Priority pills */}
      <Text style={[styles.sectionLabel, styles.priorityLabel]}>Priority</Text>
      <View style={styles.pillRow}>
        {PRIORITY_PILLS.map(({ value, label }) => {
          const isActive = priority === value;
          return (
            <TouchableOpacity
              key={value}
              testID={`priority-pill-${value}`}
              onPress={disablePriority ? undefined : () => onPriorityChange(value)}
              disabled={disablePriority}
              style={[
                styles.pill,
                isActive ? styles.pillActive : styles.pillInactive,
                disablePriority && styles.pillDisabled,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive, disabled: disablePriority }}
            >
              <Text
                style={[
                  styles.pillText,
                  isActive ? styles.pillTextActive : styles.pillTextInactive,
                ]}
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

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  priorityLabel: {
    marginTop: 12,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  pillActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  pillInactive: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  pillTextActive: {
    color: '#fff',
  },
  pillTextInactive: {
    color: '#475569',
  },
  pillDisabled: {
    opacity: 0.4,
  },
});
