import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import type { CriticalPathSuggestion } from '../../../../data/critical-path/schema';

interface CriticalPathTaskRowProps {
  suggestion: CriticalPathSuggestion;
  isSelected: boolean;
  disabled?: boolean;
  onPress: (id: string) => void;
}

export function CriticalPathTaskRow({
  suggestion,
  isSelected,
  disabled,
  onPress,
}: CriticalPathTaskRowProps) {
  return (
    <TouchableOpacity
      testID={`task-row-${suggestion.id}`}
      style={[styles.row, disabled && styles.rowDisabled]}
      onPress={() => onPress(suggestion.id)}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected }}
    >
      <View
        testID={`task-checkbox-${suggestion.id}`}
        style={[styles.checkbox, isSelected && styles.checkboxSelected]}
      >
        {isSelected && <View style={styles.checkMark} />}
      </View>
      <View style={styles.taskInfo}>
        <Text style={styles.taskTitle}>{suggestion.title}</Text>
        {suggestion.notes ? (
          <Text style={styles.taskNotes}>{suggestion.notes}</Text>
        ) : null}
      </View>
      {suggestion.critical_flag && (
        <View style={styles.criticalBadge}>
          <Text style={styles.criticalBadgeText}>Critical</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  rowDisabled: {
    opacity: 0.4,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#9CA3AF',
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    borderColor: '#2563EB',
    backgroundColor: '#2563EB',
  },
  checkMark: {
    width: 12,
    height: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 2,
  },
  taskInfo: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
  taskNotes: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
  },
  criticalBadge: {
    backgroundColor: '#FEE2E2',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  criticalBadgeText: {
    fontSize: 11,
    color: '#DC2626',
    fontWeight: '600',
  },
});
