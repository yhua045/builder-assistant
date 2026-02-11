/**
 * ProjectCard Component
 * 
 * Displays a project summary in a card format
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Project, ProjectStatus } from '../domain/entities/Project';
import { DateUtils } from '../utils/DateUtils';
import { CurrencyUtils } from '../utils/CurrencyUtils';

interface ProjectCardProps {
  project: Project;
  onPress?: (project: Project) => void;
  style?: ViewStyle;
  onArchive?: (projectId: string) => void;
  onUnarchive?: (projectId: string) => void;
  onToggleFavorite?: (projectId: string) => void;
  onChangeStatus?: (projectId: string, newStatus: ProjectStatus) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onPress,
  style,
}) => {
  const getStatusColor = (status: ProjectStatus): string => {
    switch (status) {
      case ProjectStatus.PLANNING:
        return '#FFA500'; // Orange
      case ProjectStatus.IN_PROGRESS:
        return '#4CAF50'; // Green
      case ProjectStatus.ON_HOLD:
        return '#FF9800'; // Amber
      case ProjectStatus.COMPLETED:
        return '#2196F3'; // Blue
      case ProjectStatus.CANCELLED:
        return '#F44336'; // Red
      default:
        return '#757575'; // Grey
    }
  };

  const getStatusText = (status: ProjectStatus): string => {
    return status.replace('_', ' ').toUpperCase();
  };

  const calculateProgress = (): number => {
    if (project.phases.length === 0) return 0;
    const completedPhases = project.phases.filter(phase => phase.isCompleted).length;
    return (completedPhases / project.phases.length) * 100;
  };

  const progress = calculateProgress();

  return (
    <TouchableOpacity
      style={[styles.card, style]}
      onPress={() => onPress?.(project)}
      activeOpacity={0.7}
    >
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={2}>
          {project.name}
        </Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(project.status) }]}>
          <Text style={styles.statusText}>
            {getStatusText(project.status)}
          </Text>
        </View>
      </View>

      <Text style={styles.description} numberOfLines={3}>
        {project.description}
      </Text>

      <View style={styles.infoRow}>
        <Text style={styles.label}>Budget:</Text>
        <Text style={styles.value}>
          {CurrencyUtils.formatCurrency(project.budget ?? 0)}
        </Text>
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.label}>Duration:</Text>
        <Text style={styles.value}>
          {project.startDate ? DateUtils.formatDate(project.startDate) : '—'} - {project.expectedEndDate ? DateUtils.formatDate(project.expectedEndDate) : '—'}
        </Text>
      </View>

      {project.phases.length > 0 && (
        <View style={styles.progressContainer}>
          <View style={styles.progressHeader}>
            <Text style={styles.label}>Progress:</Text>
            <Text style={styles.progressText}>
              {progress.toFixed(0)}% ({project.phases.filter(p => p.isCompleted).length}/{project.phases.length} phases)
            </Text>
          </View>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${progress}%` }
              ]}
            />
          </View>
        </View>
      )}

      <View style={styles.footer}>
            <Text style={styles.footerText}>
              {project.materials.length} materials • {project.phases.length} phases
            </Text>
            <View style={styles.actions}>
              {((project as any).archived) ? (
                <TouchableOpacity testID="unarchive-button" onPress={() => onUnarchive?.(project.id)}>
                  <Text style={styles.actionText}>Unarchive</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity testID="archive-button" onPress={() => onArchive?.(project.id)}>
                  <Text style={styles.actionText}>Archive</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity testID="favorite-button" onPress={() => onToggleFavorite?.(project.id)}>
                <Text style={styles.actionText}>★</Text>
              </TouchableOpacity>

              <TouchableOpacity testID="status-button" onPress={() => onChangeStatus?.(project.id, ProjectStatus.COMPLETED)}>
                <Text style={styles.actionText}>Set Completed</Text>
              </TouchableOpacity>
            </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    marginHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  } as ViewStyle,

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  } as ViewStyle,

  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
    flex: 1,
    marginRight: 12,
  } as TextStyle,

  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  } as ViewStyle,

  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  } as TextStyle,

  description: {
    fontSize: 14,
    color: '#666666',
    lineHeight: 20,
    marginBottom: 16,
  } as TextStyle,

  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  } as ViewStyle,

  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#888888',
  } as TextStyle,

  value: {
    fontSize: 14,
    color: '#333333',
    flex: 1,
    textAlign: 'right',
  } as TextStyle,

  progressContainer: {
    marginTop: 12,
    marginBottom: 8,
  } as ViewStyle,

  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  } as ViewStyle,

  progressText: {
    fontSize: 12,
    color: '#666666',
  } as TextStyle,

  progressBar: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    overflow: 'hidden',
  } as ViewStyle,

  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
  } as ViewStyle,

  footer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  } as ViewStyle,

  footerText: {
    fontSize: 12,
    color: '#999999',
  } as TextStyle,
  actions: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 12,
  } as ViewStyle,

  actionText: {
    fontSize: 13,
    color: '#2563eb',
    fontWeight: '600',
  } as TextStyle,
});