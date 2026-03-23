import React, { useState, useMemo, useEffect } from 'react';
import { View, Alert } from 'react-native';
import { container } from 'tsyringe';
import { ManualProjectEntryButton } from './ManualProjectEntryButton';
import ManualProjectEntryForm from './ManualProjectEntryForm';
import { useProjects } from '../hooks/useProjects';
import { useCriticalPath } from '../hooks/useCriticalPath';
import type { CreateProjectRequest } from '../application/usecases/project/CreateProjectUseCase';
import { CriticalPathPreview } from './CriticalPathPreview/CriticalPathPreview';
import { SuggestCriticalPathUseCase } from '../application/usecases/criticalpath/SuggestCriticalPathUseCase';
import { CreateTaskUseCase } from '../application/usecases/task/CreateTaskUseCase';
import type { TaskRepository } from '../domain/repositories/TaskRepository';
import { CriticalPathService } from '../application/services/CriticalPathService';

interface Props {
  initialVisible?: boolean;
}

const ManualProjectEntry: React.FC<Props> = ({ initialVisible = false }) => {
  const [step, setStep] = useState<'idle' | 'form' | 'critical-path'>(
    initialVisible ? 'form' : 'idle'
  );
  
  const [createdProject, setCreatedProject] = useState<{id: string, projectType: string, state: string} | null>(null);
  const { createProject } = useProjects();

  const taskRepository = useMemo(() => container.resolve<TaskRepository>('TaskRepository'), []);
  const suggestUseCase = useMemo(() => new SuggestCriticalPathUseCase(new CriticalPathService()), []);
  const createTaskUseCase = useMemo(() => new CreateTaskUseCase(taskRepository), [taskRepository]);

  const criticalPathHook = useCriticalPath({
    suggestUseCase,
    createTaskUseCase,
  });

  useEffect(() => {
    if (step === 'critical-path' && createdProject) {
      criticalPathHook.suggest({
        project_type: createdProject.projectType as any,
        state: createdProject.state as any,
      });
    }
  }, [step, createdProject, criticalPathHook]);

  const handleOpen = () => setStep('form');
  const handleCancel = () => {
    setStep('idle');
    setCreatedProject(null);
  };

  const handleSave = async (dto: CreateProjectRequest & { projectType?: any, state?: any }) => {
    const result = await createProject(dto);
    
    if (result.success && result.projectId) {
      setCreatedProject({
        id: result.projectId,
        projectType: dto.projectType || 'complete_rebuild',
        state: dto.state || 'NSW'
      });
      setStep('critical-path');
    } else {
      const errorMessage = result.errors?.join('\n') || 'Failed to create project';
      Alert.alert('Error', errorMessage);
    }
  };

  return (
    <View>
      <ManualProjectEntryButton onPress={handleOpen} />
      
      {step === 'form' && (
        <ManualProjectEntryForm visible={true} onSave={handleSave} onCancel={handleCancel} />
      )}

      {step === 'critical-path' && createdProject && (
        <View style={{ flex: 1, backgroundColor: 'white' }}>
          <CriticalPathPreview
            projectId={createdProject.id}
            hookResult={criticalPathHook}
          />
        </View>
      )}
    </View>
  );
};

export default ManualProjectEntry;