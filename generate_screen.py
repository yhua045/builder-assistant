screen_content = """import React from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useProjectDetail } from '../../hooks/useProjectDetail';
import { useUpdateProject } from '../../hooks/useUpdateProject';
import ManualProjectEntryForm from '../../components/ManualProjectEntryForm';

export default function ProjectEditScreen() {
  const route = useRoute<any>();
  const navigation = useNavigation<any>();
  const { projectId } = route.params as { projectId: string };
  const { project, loading } = useProjectDetail(projectId);
  const { updateProject } = useUpdateProject();

  const initialValues = project ? {
    name: project.name,
    address: project.location,
    description: project.description,
    startDate: project.startDate ?? null,
    endDate: project.expectedEndDate ?? null,
    budget: project.budget != null ? String(project.budget) : '',
    projectType: 'complete_rebuild',
    state: 'NSW',
    notes: typeof project.meta?.notes === 'string' ? project.meta.notes : '',
  } : undefined;

  const handleSave = async (formData: any) => {
    const result = await updateProject({
      projectId,
      name: formData.name,
      description: formData.description,
      location: formData.address,
      startDate: formData.startDate ?? undefined,
      expectedEndDate: formData.expectedEndDate ?? undefined,
      budget: formData.budget ? parseFloat(formData.budget) : undefined,
    });
    if (result.success) {
      navigation.goBack();
    } else {
      Alert.alert('Error', result.errors?.join('\\n') ?? 'Could not save project');
    }
  };

  if (loading || !project) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ManualProjectEntryForm
      visible={true}
      onSave={handleSave}
      onCancel={() => navigation.goBack()}
      criticalPathHook={{
        tasks: [],
        criticalPath: [],
        ganttData: [],
        isAnalyzing: false,
        error: null,
        analyzeCriticalPath: async () => {},
        applyTasksToProject: async () => {}
      } as any}
      projectId={projectId}
      excludeCriticalTasks={true}
      initialValues={initialValues}
    />
  );
}
"""

with open('src/pages/projects/ProjectEditScreen.tsx', 'w') as f:
    f.write(screen_content)
