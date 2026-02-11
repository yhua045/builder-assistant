/**
 * ProjectList Component
 * 
 * Displays a list of projects with loading and error states
 */

import React from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { Project } from '../domain/entities/Project';
import { ProjectCardDto } from '../application/dtos/ProjectCardDto';
import { ProjectCard } from './ProjectCard';

interface ProjectListProps {
  projects: Project[];
  loading: boolean;
  error: string | null;
  onProjectPress?: (project: Project) => void;
  onRefresh?: () => void;
}

export const ProjectList: React.FC<ProjectListProps> = ({
  projects,
  loading,
  error,
  onProjectPress,
  onRefresh,
}) => {
  if (loading && projects.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text style={styles.loadingText}>Loading projects...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>
          Error loading projects: {error}
        </Text>
      </View>
    );
  }

  if (projects.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.emptyTitle}>No Projects Yet</Text>
        <Text style={styles.emptyText}>
          Create your first building project to get started with managing your construction timeline and materials.
        </Text>
      </View>
    );
  }

  const renderProject = ({ item }: { item: Project }) => {
    const projectDto: ProjectCardDto = {
      id: item.id,
      owner: item.name,
      address: item.description || 'No Address',
      status: item.status,
      contact: 'Unknown',
      lastCompletedTask: {
        title: 'Initial Setup',
        completedDate: item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '-',
      },
      upcomingTasks: [],
    };

    return (
      <ProjectCard
        project={projectDto}
        onPress={() => onProjectPress?.(item)}
      />
    );
  };

  return (
    <FlatList
      data={projects}
      renderItem={renderProject}
      keyExtractor={(item) => item.id}
      style={styles.list}
      contentContainerStyle={styles.listContent}
      showsVerticalScrollIndicator={false}
      refreshing={loading}
      onRefresh={onRefresh}
    />
  );
};

const styles = StyleSheet.create({
  list: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  } as ViewStyle,

  listContent: {
    paddingVertical: 8,
  } as ViewStyle,

  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#F5F5F5',
  } as ViewStyle,

  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  } as TextStyle,

  errorText: {
    fontSize: 16,
    color: '#F44336',
    textAlign: 'center',
    lineHeight: 24,
  } as TextStyle,

  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
    textAlign: 'center',
  } as TextStyle,

  emptyText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    lineHeight: 24,
    maxWidth: 300,
  } as TextStyle,
});