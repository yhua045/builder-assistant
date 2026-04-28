import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { CriticalTasksTimeline } from '../../src/features/tasks/components/CriticalTasksTimeline';
import { BlockedTaskItem } from '../../src/features/tasks/utils/selectTopBlockedTasks';

describe('CriticalTasksTimeline', () => {
  it('renders "No critical blocked tasks." when items array is empty', () => {
    const { getByText } = render(<CriticalTasksTimeline items={[]} />);
    expect(getByText('No critical blocked tasks.')).toBeTruthy();
  });

  it('renders a list of valid items correctly', () => {
    const items: BlockedTaskItem[] = [
      {
        id: '1',
        title: 'Fix foundation',
        projectId: 'p1',
        projectName: 'Riverside Residence',
        projectColor: '#10B981',
        status: 'blocked',
        scheduledAt: '2026-10-18',
        severity: 'high',
      },
      {
        id: '2',
        title: 'Roofing delivery',
        projectId: 'p2',
        projectName: 'Downtown Plaza',
        projectColor: '#3B82F6',
        status: 'blocked',
        scheduledAt: '2026-10-20',
        severity: 'critical',
      },
    ];

    const { getByText } = render(<CriticalTasksTimeline items={items} />);
    
    expect(getByText('Fix foundation')).toBeTruthy();
    expect(getByText('Riverside Residence')).toBeTruthy();
    expect(getByText('2026-10-18')).toBeTruthy();
    expect(getByText('high')).toBeTruthy();

    expect(getByText('Roofing delivery')).toBeTruthy();
    expect(getByText('Downtown Plaza')).toBeTruthy();
    expect(getByText('2026-10-20')).toBeTruthy();
    expect(getByText('critical')).toBeTruthy();
  });

  it('calls onItemPress when an item is tapped', () => {
    const mockOnPress = jest.fn();
    const items: BlockedTaskItem[] = [
      {
        id: '1',
        title: 'Fix foundation',
        projectId: 'p1',
        projectName: 'Riverside',
        status: 'blocked',
      },
    ];

    const { getByText } = render(<CriticalTasksTimeline items={items} onItemPress={mockOnPress} />);
    
    fireEvent.press(getByText('Fix foundation'));
    expect(mockOnPress).toHaveBeenCalledWith(items[0]);
  });
});
