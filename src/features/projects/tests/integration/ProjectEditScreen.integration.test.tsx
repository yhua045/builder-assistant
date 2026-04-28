import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import ProjectEditScreen from '../../screens/ProjectEditScreen';
import { useProjectDetail } from '../../hooks/useProjectDetail';
import { useUpdateProject } from '../../hooks/useUpdateProject';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Alert } from 'react-native';

jest.mock('../../hooks/useProjectDetail');
jest.mock('../../hooks/useUpdateProject');
jest.mock('@react-navigation/native', () => ({
  useRoute: jest.fn(),
  useNavigation: jest.fn(),
}));

jest.spyOn(Alert, 'alert');

describe('ProjectEditScreen', () => {
  const sampleProject = {
    id: 'p1',
    name: 'Smith Residence',
    location: '123 Fake St',
    description: 'Renovation',
    startDate: new Date('2023-01-01'),
    expectedEndDate: new Date('2023-12-31'),
    budget: 500000,
  };

  const mockNavigate = jest.fn();
  const mockGoBack = jest.fn();
  const mockUpdateProject = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRoute as jest.Mock).mockReturnValue({
      params: { projectId: 'p1' },
    });
    (useNavigation as jest.Mock).mockReturnValue({
      navigate: mockNavigate,
      goBack: mockGoBack,
    });
    (useProjectDetail as jest.Mock).mockReturnValue({
      project: sampleProject,
      loading: false,
    });
    (useUpdateProject as jest.Mock).mockReturnValue({
      updateProject: mockUpdateProject,
      loading: false,
    });
  });

  it('renders with project name pre-filled', () => {
    const { getByDisplayValue } = render(<ProjectEditScreen />);
    expect(getByDisplayValue('Smith Residence')).toBeTruthy();
  });

  it('renders with address pre-filled from project.location', () => {
    const { getByDisplayValue } = render(<ProjectEditScreen />);
    expect(getByDisplayValue('123 Fake St')).toBeTruthy();
  });

  it('does NOT render critical tasks step (step 2)', () => {
    const { queryByText } = render(<ProjectEditScreen />);
    expect(queryByText('Step 2 of 2 · Select your starting tasks')).toBeNull();
  });

  it('tapping Save calls updateProject with correct payload', async () => {
    const { getByText, getByDisplayValue } = render(<ProjectEditScreen />);
    const nameInput = getByDisplayValue('Smith Residence');
    
    fireEvent.changeText(nameInput, 'New Name');
    
    mockUpdateProject.mockResolvedValueOnce({ success: true });
    
    fireEvent.press(getByText('Save Project'));
    
    await waitFor(() => {
      expect(mockUpdateProject).toHaveBeenCalledWith(expect.objectContaining({
        projectId: 'p1',
        name: 'New Name',
      }));
    });
  });

  it('on successful save, calls navigation.goBack()', async () => {
    mockUpdateProject.mockResolvedValueOnce({ success: true });
    const { getByText } = render(<ProjectEditScreen />);
    
    fireEvent.press(getByText('Save Project'));
    
    await waitFor(() => {
      expect(mockGoBack).toHaveBeenCalled();
    });
  });

  it('on failed save, shows Alert with error message', async () => {
    mockUpdateProject.mockResolvedValueOnce({ success: false, errors: ['Project not found'] });
    const { getByText } = render(<ProjectEditScreen />);
    
    fireEvent.press(getByText('Save Project'));
    
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Error', 'Project not found');
    });
  });
});
jest.mock('../../../../components/inputs/ContactSelector', () => () => null);
jest.mock('../../../../components/inputs/TeamSelector', () => () => null);
