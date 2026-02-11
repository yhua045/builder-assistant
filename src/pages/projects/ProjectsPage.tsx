import React from 'react';
import { View, Text, FlatList, ActivityIndicator, StyleSheet } from 'react-native';
import { useProjects } from '../../hooks/useProjects';
import { ProjectCard } from '../../components/ProjectCard';
import { container } from 'tsyringe';
import { ArchiveProjectUseCase } from '../../application/usecases/project/ArchiveProjectUseCase';
import { UnarchiveProjectUseCase } from '../../application/usecases/project/UnarchiveProjectUseCase';
import { UpdateProjectStatusUseCase } from '../../application/usecases/project/UpdateProjectStatusUseCase';
import { ProjectValidationService } from '../../domain/services/ProjectValidationService';

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
      renderItem={({ item }) => (
        <ProjectCard
          project={item}
          onPress={() => { /* navigate to details if needed */ }}
          onArchive={async (id) => {
            const repo = container.resolve<any>('ProjectRepository');
            const uc = new ArchiveProjectUseCase(repo);
            await uc.execute(id);
            await refreshProjects();
          }}
          onUnarchive={async (id) => {
            const repo = container.resolve<any>('ProjectRepository');
            const uc = new UnarchiveProjectUseCase(repo);
            await uc.execute(id);
            await refreshProjects();
          }}
          onToggleFavorite={async (_id) => {
            // favorites are not implemented in domain yet — placeholder
          }}
          onChangeStatus={async (id, newStatus) => {
            const repo = container.resolve<any>('ProjectRepository');
            const validation = new ProjectValidationService();
            const uc = new UpdateProjectStatusUseCase(repo, validation);
            const res = await uc.execute({ projectId: id, newStatus });
            if (res.success) await refreshProjects();
          }}
        />
      )}
    />
  );
};

export default ProjectsPage;

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  padded: { padding: 16 },
});
