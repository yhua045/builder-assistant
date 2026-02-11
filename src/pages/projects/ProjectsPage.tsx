import React from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { useProjects } from '../../hooks/useProjects';
import { ProjectCard } from '../../components/ProjectCard';

const ProjectsPage: React.FC = () => {
  const { projects, loading, error } = useProjects();

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator testID="projects-loading" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.padded}>
        <Text testID="projects-error">{error}</Text>
      </View>
    );
  }

  if (!projects || projects.length === 0) {
    return (
      <View style={styles.padded}>
        <Text testID="projects-empty">No projects yet</Text>
      </View>
    );
  }

  return (
    <FlatList
      testID="projects-list"
      data={projects}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <ProjectCard project={item} />}
    />
  );
};

export default ProjectsPage;

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  padded: { padding: 16 },
});
