import React from 'react';
import { View, Text, ScrollView, ActivityIndicator, Pressable, StyleSheet as RNStyleSheet } from 'react-native';
import { ProjectCard } from '../components/ProjectCard';
import ManualProjectEntry from '../components/ManualProjectEntry';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemeToggle } from '../../../components/ThemeToggle';
import { Layers, Plus } from 'lucide-react-native';
import { useProjectsPage } from '../hooks/useProjectsPage';

const ProjectsPage: React.FC = () => {
  const vm = useProjectsPage();


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
            onPress={vm.openCreate}
            className="p-1.5 rounded-lg active:opacity-60"
            accessibilityLabel="Add new project"
            accessibilityRole="button"
          >
            <Plus className="text-foreground" size={22} />
          </Pressable>
          <ThemeToggle />
        </View>
      </View>

      {vm.loading && (
        <View className="px-6 gap-4">
          <ActivityIndicator testID="projects-loading" size="large" />
        </View>
      )}

      {vm.error && (
        <View className="px-6 gap-4">
          <Text testID="projects-error" className="text-destructive">{vm.error}</Text>
        </View>
      )}

      {!vm.loading && !vm.error && !vm.hasProjects && (
          <View className="px-6 gap-4">
            <Text testID="projects-empty" style={emptyTextStyle}>No projects yet. Tap + to add one.</Text>
              <ManualProjectEntry key={vm.createKey} initialVisible={vm.createKey > 0} hideButton />
          </View>
      )}
  
      {!vm.loading && !vm.error && vm.hasProjects && (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Projects List */}
          <View className="px-6 gap-4">
            {vm.projectDtos.map((project) => (
              <ProjectCard key={project.id} project={project} onPress={(p) => vm.navigateToProject(p.id)} />
            ))}
          </View>
          {/* Modal-only ManualProjectEntry — no visible button, opened via header + */}
          <ManualProjectEntry key={vm.createKey} initialVisible={vm.createKey > 0} hideButton />
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

