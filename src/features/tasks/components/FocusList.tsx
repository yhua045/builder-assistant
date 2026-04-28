/**
 * FocusList — ranked list of the top-3 focus tasks from the cockpit.
 *
 * Consumed by TasksScreen (src/pages/tasks/index.tsx).
 * Data comes from useCockpitData → CockpitData.focus3.
 */
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
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
    <View style={styles.container} testID="focus-list">
      <Text style={styles.sectionHeader}>🎯 Focus</Text>
      <View style={styles.listCard}>
        {focusItems.map((item, index) => (
          <TouchableOpacity
            key={item.task.id}
            testID={`focus-item-${item.task.id}`}
            onPress={() => onItemPress(item.task)}
            style={[styles.row, index < focusItems.length - 1 && styles.rowBorder]}
            accessible
            accessibilityRole="button"
            accessibilityLabel={`Focus task ${RANK_LABELS[index]}: ${item.task.title}. ${item.urgencyLabel}. Tap to open details.`}
          >
            {/* Rank badge */}
            <View style={styles.rankBadge}>
              <Text style={styles.rankText}>{RANK_LABELS[index] ?? `#${index + 1}`}</Text>
            </View>

            {/* Row content */}
            <View style={styles.rowContent}>
              {/* Top row: title + urgency label */}
              <View style={styles.rowTop}>
                <Text style={styles.taskTitle} numberOfLines={1}>
                  {item.task.title}
                </Text>
                {item.urgencyLabel ? (
                  <Text style={styles.urgencyLabel}>{item.urgencyLabel}</Text>
                ) : null}
              </View>

              {/* Sub-row: score + next-in-line */}
              <Text style={styles.subText}>
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

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 24,
    paddingBottom: 8,
    paddingTop: 4,
  },
  listCard: {
    marginHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#fff',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    flexShrink: 0,
  },
  rankText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#475569',
  },
  rowContent: {
    flex: 1,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  taskTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
    flex: 1,
  },
  urgencyLabel: {
    fontSize: 12,
    color: '#64748b',
    flexShrink: 0,
  },
  subText: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
});
