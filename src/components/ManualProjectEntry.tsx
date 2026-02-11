import React from 'react';
import { View, Alert } from 'react-native';
import { ManualProjectEntryButton } from './ManualProjectEntryButton';
import ManualProjectEntryForm from './ManualProjectEntryForm';
import { useProjects } from '../hooks/useProjects';
import type { CreateProjectRequest } from '../application/usecases/project/CreateProjectUseCase';

interface Props {
  initialVisible?: boolean;
}

const ManualProjectEntry: React.FC<Props> = ({ initialVisible = false }) => {
  const [visible, setVisible] = React.useState(initialVisible);
  const { createProject } = useProjects();

  const handleOpen = () => setVisible(true);
  const handleCancel = () => setVisible(false);

  const handleSave = async (dto: CreateProjectRequest) => {
    const result = await createProject(dto);
    
    if (result.success) {
      setVisible(false);
      // Show success feedback
      Alert.alert('Success', 'Project created successfully');
    } else {
      // Show error feedback
      const errorMessage = result.errors?.join('\n') || 'Failed to create project';
      Alert.alert('Error', errorMessage);
    }
  };

  return (
    <View>
      <ManualProjectEntryButton onPress={handleOpen} />
      <ManualProjectEntryForm visible={visible} onSave={handleSave} onCancel={handleCancel} />
    </View>
  );
};

export default ManualProjectEntry;
