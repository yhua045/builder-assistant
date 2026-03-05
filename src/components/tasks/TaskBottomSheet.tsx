/**
 * TaskBottomSheet — peek-mode slide-up overlay for quick task inspection & editing.
 *
 * Allows quick status/priority edits (optimistic) and provides navigation to the full
 * TaskDetailsPage. Not a replacement for TaskDetailsPage — only a fast on-site peek.
 *
 * Implementation uses RN Modal with animationType="slide":
 *   - iOS: presentationStyle="formSheet" gives a compact half-sheet appearance.
 *   - Android: content is wrapped with maxHeight + rounded top corners to simulate peek.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { Task } from '../../domain/entities/Task';

export interface TaskBottomSheetProps {
  visible: boolean;
  task: Task | null;
  /** Prerequisites that are blocking this task (from BlockerItem.blockedPrereqs). */
  prereqs?: Task[];
  /** Tasks that are directly waiting on this task. */
  nextInLine?: Task[];
  onClose: () => void;
  /** Optimistic mutation — call with the full updated task object. */
  onUpdateTask: (updated: Task) => Promise<void>;
  /** Navigate to the full TaskDetailsPage. */
  onOpenFullDetails: (taskId: string) => void;
  /** Nudge: closes sheet and triggers AddDelayReason flow (navigates to TaskDetails). */
  onMarkBlocked: (taskId: string) => void;
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

const MAX_PREREQS_SHOWN = 5;
const MAX_NEXT_SHOWN = 3;

function prereqIcon(status: Task['status']): string {
  if (status === 'completed') return '✅';
  if (status === 'blocked') return '🔴';
  return '⏳';
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TaskBottomSheet({
  visible,
  task,
  prereqs = [],
  nextInLine = [],
  onClose,
  onUpdateTask,
  onOpenFullDetails,
  onMarkBlocked,
}: TaskBottomSheetProps) {
  // Local copy of task for optimistic updates.
  const [localTask, setLocalTask] = useState<Task | null>(task);

  // Sync when a different task is opened.
  useEffect(() => {
    setLocalTask(task);
  }, [task]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleStatusChange = useCallback(
    (status: Task['status']) => {
      if (!localTask) return;
      const updated: Task = { ...localTask, status };
      setLocalTask(updated); // optimistic
      onUpdateTask(updated);
    },
    [localTask, onUpdateTask],
  );

  const handlePriorityChange = useCallback(
    (priority: NonNullable<Task['priority']>) => {
      if (!localTask) return;
      const updated: Task = { ...localTask, priority };
      setLocalTask(updated); // optimistic
      onUpdateTask(updated);
    },
    [localTask, onUpdateTask],
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  const sheetContent = !localTask ? null : (
    <View style={styles.sheetContent}>
      {/* Drag handle */}
      <View style={styles.dragHandle} />

      {/* Header: title + close */}
      <View style={styles.header}>
        <Text style={styles.taskTitle} numberOfLines={2}>
          {localTask.title}
        </Text>
        <TouchableOpacity
          testID="sheet-close-btn"
          onPress={onClose}
          style={styles.closeBtn}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <Text style={styles.closeBtnText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
        {/* Status pills */}
        <Text style={styles.sectionLabel}>Status</Text>
        <View style={styles.pillRow}>
          {STATUS_PILLS.map(({ value, label }) => (
            <TouchableOpacity
              key={value}
              testID={`status-pill-${value}`}
              onPress={() => handleStatusChange(value)}
              style={[
                styles.pill,
                localTask.status === value ? styles.pillActive : styles.pillInactive,
              ]}
            >
              <Text
                style={[
                  styles.pillText,
                  localTask.status === value ? styles.pillTextActive : styles.pillTextInactive,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Priority pills */}
        <Text style={styles.sectionLabel}>Priority</Text>
        <View style={styles.pillRow}>
          {PRIORITY_PILLS.map(({ value, label }) => (
            <TouchableOpacity
              key={value}
              testID={`priority-pill-${value}`}
              onPress={() => handlePriorityChange(value)}
              style={[
                styles.pill,
                localTask.priority === value ? styles.pillActive : styles.pillInactive,
              ]}
            >
              <Text
                style={[
                  styles.pillText,
                  localTask.priority === value ? styles.pillTextActive : styles.pillTextInactive,
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Prerequisites */}
        {prereqs.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Prerequisites</Text>
            <View style={styles.listSection}>
              {prereqs.slice(0, MAX_PREREQS_SHOWN).map((p) => (
                <View key={p.id} style={styles.listRow}>
                  <Text style={styles.listIcon}>{prereqIcon(p.status)}</Text>
                  <Text style={styles.listItemText} numberOfLines={1}>
                    {p.title}
                  </Text>
                </View>
              ))}
              {prereqs.length > MAX_PREREQS_SHOWN && (
                <Text style={styles.overflowText}>
                  +{prereqs.length - MAX_PREREQS_SHOWN} more
                </Text>
              )}
            </View>
          </>
        )}

        {/* Next in line */}
        {nextInLine.length > 0 && (
          <>
            <Text style={styles.sectionLabel}>Next in Line</Text>
            <View style={styles.listSection}>
              {nextInLine.slice(0, MAX_NEXT_SHOWN).map((t) => (
                <View key={t.id} style={styles.listRow}>
                  <Text style={styles.listIcon}>→</Text>
                  <Text style={styles.listItemText} numberOfLines={1}>
                    {t.title}
                  </Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* Quick actions */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            testID="action-mark-blocked"
            onPress={() => onMarkBlocked(localTask.id)}
            style={[styles.actionBtn, styles.actionBtnDestructive]}
          >
            <Text style={styles.actionBtnTextDestructive}>⚠ Mark as Blocked</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="action-full-details"
            onPress={() => onOpenFullDetails(localTask.id)}
            style={[styles.actionBtn, styles.actionBtnPrimary]}
          >
            <Text style={styles.actionBtnTextPrimary}>📋 See Full Details</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );

  // On Android simulate peek-mode by constraining height.
  const androidWrapper: object | null =
    Platform.OS === 'android'
      ? {
          flex: 1,
          justifyContent: 'flex-end',
          backgroundColor: 'rgba(0,0,0,0.4)',
        }
      : null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'formSheet' : 'overFullScreen'}
      onRequestClose={onClose}
      transparent={Platform.OS === 'android'}
    >
      {Platform.OS === 'android' ? (
        <View style={androidWrapper!}>
          <View style={styles.androidSheet}>{sheetContent}</View>
        </View>
      ) : (
        sheetContent
      )}
    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  sheetContent: {
    flex: 1,
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
  },
  androidSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '75%' as any,
    paddingTop: 8,
  },
  dragHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#cbd5e1',
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  taskTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 24,
    marginRight: 8,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  closeBtnText: {
    fontSize: 14,
    color: '#475569',
    fontWeight: '600',
  },
  scrollBody: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 32,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 16,
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
  listSection: {
    gap: 6,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  listIcon: {
    fontSize: 14,
    width: 20,
    textAlign: 'center',
  },
  listItemText: {
    flex: 1,
    fontSize: 14,
    color: '#334155',
  },
  overflowText: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnDestructive: {
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  actionBtnPrimary: {
    backgroundColor: '#3b82f6',
  },
  actionBtnTextDestructive: {
    fontSize: 14,
    fontWeight: '600',
    color: '#dc2626',
  },
  actionBtnTextPrimary: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
