import React, { useState, useMemo } from 'react';
import { View, Alert } from 'react-native';
import { container } from 'tsyringe';
import { ManualProjectEntryButton } from './ManualProjectEntryButton';
import ManualProjectEntryForm from './ManualProjectEntryForm';
import { useProjects } from '../hooks/useProjects';
import { useCriticalPath } from '../../../hooks/useCriticalPath';
import type { CreateProjectRequest } from '../application/CreateProjectUseCase';
import { SuggestCriticalPathUseCase } from '../../../application/usecases/criticalpath/SuggestCriticalPathUseCase';
import { CreateTaskUseCase } from '../../tasks/application/CreateTaskUseCase';
import type { TaskRepository } from '../../../domain/repositories/TaskRepository';
import { CriticalPathService } from '../../../application/services/CriticalPathService';

interface Props {
  initialVisible?: boolean;
  hideButton?: boolean;
}

const ManualProjectEntry: React.FC<Props> = ({ initialVisible = false, hideButton = false }) => {
  const [formVisible, setFormVisible] = useState(initialVisible);
  const [projectId, setProjectId] = useState<string | null>(null);
  const { createProject } = useProjects();

  const taskRepository = useMemo(() => container.resolve<TaskRepository>('TaskRepository'), []);
  const suggestUseCase = useMemo(() => new SuggestCriticalPathUseCase(new CriticalPathService()), []);
  const createTaskUseCase = useMemo(() => new CreateTaskUseCase(taskRepository), [taskRepository]);

  const criticalPathHook = useCriticalPath({ suggestUseCase, createTaskUseCase });
  const { suggest: suggestCriticalPath } = criticalPathHook;

  const handleOpen = () => setFormVisible(true);

  const handleCancel = () => {
    setFormVisible(false);
    setProjectId(null);
  };

  const handleSave = async (dto: CreateProjectRequest & { projectType?: any, state?: any }) => {
    const result = await createProject(dto);

    if (result.success && result.projectId) {
      const projectType = dto.projectType || 'complete_rebuild';
      const state = dto.state || 'NSW';
      setProjectId(result.projectId);
      // Kick off suggestion loading so it's ready when the form transitions to step 2
      suggestCriticalPath({ project_type: projectType, state });
    } else {
      const errorMessage = result.errors?.join('\n') || 'Failed to create project';
      Alert.alert('Error', errorMessage);
    }
  };

  return (
    <View>
      {!hideButton && <ManualProjectEntryButton onPress={handleOpen} />}

      <ManualProjectEntryForm
        visible={formVisible}
        onSave={handleSave}
        onCancel={handleCancel}
        onTasksAdded={handleCancel}
        criticalPathHook={criticalPathHook}
        projectId={projectId}
      />
    </View>
  );
};

export default ManualProjectEntry;