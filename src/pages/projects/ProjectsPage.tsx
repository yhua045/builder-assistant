import React, { useMemo, useCallback } from 'react';
import { View, Text, ScrollView, ActivityIndicator, StyleSheet as RNStyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useProjects } from '../../hooks/useProjects';
import { ProjectCard } from '../../components/ProjectCard';
import ManualProjectEntry from '../../components/ManualProjectEntry';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemeToggle } from '../../components/ThemeToggle';
import { Layers } from 'lucide-react-native';
import { ProjectCardDto } from '../../application/dtos/ProjectCardDto';
import { Project } from '../../domain/entities/Project';
import { ProjectsStackParamList } from './ProjectsNavigator';

const ProjectsPage: React.FC = () => {
  const navigation = useNavigation<any>();
  const { projects, loading, error } = useProjects();

  const handleProjectPress = useCallback(
    (project: ProjectCardDto) => {
      navigation.navigate('ProjectDetail', { projectId: project.id });
    },
    [navigation],
  );

  const projectDtos = useMemo((): ProjectCardDto[] => {
    if (!projects) return [];
    
    return projects.map((project: Project): ProjectCardDto => ({
      id: project.id,
      owner: project.name, // Using Name as owner placeholder
      address: project.description || 'No Address',
      status: project.status,
      contact: 'Unknown',
      lastCompletedTask: {
        title: 'Initial Setup',
        completedDate: project.createdAt ? new Date(project.createdAt).toLocaleDateString() : '-' 
      },
      upcomingTasks: [],
      // Ensure all fields from DTO are covered.
    }));
  }, [projects]);


  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="px-6 py-4 flex-row items-center justify-between">
        <View className="flex-row items-center">
          <Layers className="text-primary mr-3" size={24} />
          <Text className="text-2xl font-bold text-foreground">Projects</Text>
        </View>
        <ThemeToggle />
      </View>

      {loading && (
        <View className="px-6 gap-4">
          <ActivityIndicator testID="projects-loading" size="large" />
        </View>
      )}

      {error && (
        <View className="px-6 gap-4">
          <Text testID="projects-error" className="text-destructive">{error}</Text>
        </View>
      )}

      {!loading && !error && projectDtos.length === 0 && (
          <View className="px-6 gap-4">
            <Text testID="projects-empty" style={emptyTextStyle}>No projects yet</Text>
              <ManualProjectEntry />
          </View>
      )}
  
      {!loading && !error && projectDtos.length > 0 && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Projects List */}
          <View className="px-6 gap-4">
            {projectDtos.map((project) => (
              <ProjectCard key={project.id} project={project} onPress={handleProjectPress} />
            ))}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
};


export default ProjectsPage;


const emptyTextStyle = { marginBottom: 20 } as const;

const styles = RNStyleSheet.create({
  scrollContent: { paddingBottom: 128 },
});

