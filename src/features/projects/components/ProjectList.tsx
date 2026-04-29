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
  ActivityIndicator,
} from 'react-native';
import { Project } from '../../../domain/entities/Project';
import { ProjectCardDto } from '../application/ProjectCardDto';
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
      <View className="flex-1 justify-center items-center p-8 bg-[#F5F5F5]">
        <ActivityIndicator size="large" color="#4CAF50" />
        <Text className="mt-4 text-base text-[#666666] text-center">Loading projects...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View className="flex-1 justify-center items-center p-8 bg-[#F5F5F5]">
        <Text className="text-base text-[#F44336] text-center leading-6">
          Error loading projects: {error}
        </Text>
      </View>
    );
  }

  if (projects.length === 0) {
    return (
      <View className="flex-1 justify-center items-center p-8 bg-[#F5F5F5]">
        <Text className="text-2xl font-bold text-[#333333] mb-4 text-center">No Projects Yet</Text>
        <Text className="text-base text-[#666666] text-center leading-6 max-w-[300px]">
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
      className="flex-1 bg-[#F5F5F5]"
      contentContainerClassName="py-2"
      showsVerticalScrollIndicator={false}
      refreshing={loading}
      onRefresh={onRefresh}
    />
  );
};