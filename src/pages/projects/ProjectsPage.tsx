import React, { useMemo, useCallback, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable, StyleSheet as RNStyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useProjects } from '../../hooks/useProjects';
import { ProjectCard } from '../../components/ProjectCard';
import ManualProjectEntry from '../../components/ManualProjectEntry';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemeToggle } from '../../components/ThemeToggle';
import { Layers, Plus } from 'lucide-react-native';
import { ProjectCardDto } from '../../application/dtos/ProjectCardDto';
import { ProjectDetails } from '../../domain/entities/ProjectDetails';

const ProjectsPage: React.FC = () => {
  const navigation = useNavigation<any>();
  const { projects, loading, error } = useProjects();
  const [createKey, setCreateKey] = useState(0);

  const handleProjectPress = useCallback(
    (project: ProjectCardDto) => {
      navigation.navigate('ProjectDetail', { projectId: project.id });
    },
    [navigation],
  );

  const projectDtos = useMemo((): ProjectCardDto[] => {
    if (!projects) return [];
    
    return projects.map((project: ProjectDetails): ProjectCardDto => ({
      id: project.id,
      owner: project.owner?.name || project.name,
      address: project.property?.address || project.location || 'No Address',
      status: project.status,
      contact: project.owner?.phone || project.owner?.email || 'No contact',
      lastCompletedTask: {
        title: 'Initial Setup',
        completedDate: project.createdAt ? new Date(project.createdAt).toLocaleDateString() : '-' 
      },
      upcomingTasks: project.upcomingTasks,
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
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={() => setCreateKey(k => k + 1)}
            className="p-1.5 rounded-lg active:opacity-60"
            accessibilityLabel="Add new project"
            accessibilityRole="button"
          >
            <Plus className="text-foreground" size={22} />
          </Pressable>
          <ThemeToggle />
        </View>
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
            <Text testID="projects-empty" style={emptyTextStyle}>No projects yet. Tap + to add one.</Text>
              <ManualProjectEntry key={createKey} initialVisible={createKey > 0} hideButton />
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
          {/* Modal-only ManualProjectEntry — no visible button, opened via header + */}
          <ManualProjectEntry key={createKey} initialVisible={createKey > 0} hideButton />
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

