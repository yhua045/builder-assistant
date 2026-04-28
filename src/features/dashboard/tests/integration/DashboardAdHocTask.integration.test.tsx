/** Integration test for Dashboard quick action → TaskScreen wiring */
import React from 'react';
import renderer, { act } from 'react-test-renderer';

jest.mock('nativewind', () => ({ cssInterop: jest.fn(), useColorScheme: () => ({ colorScheme: 'light' }) }));
jest.mock('lucide-react-native', () => ({
  DollarSign: 'DollarSign',
  Plus: 'Plus',
  Camera: 'Camera',
  FileText: 'FileText',
  Wrench: 'Wrench',
  Receipt: 'Receipt',
  X: 'X',
}));

// Mock TaskScreen to detect when it's rendered
jest.mock('../../../tasks/screens/TaskScreen', () => ({
  __esModule: true,
  default: () => {
    const ReactLocal = require('react');
    return ReactLocal.createElement('Text', { testID: 'mock-taskscreen' }, 'TASK');
  },
}));

import { DashboardScreen } from '../../screens/DashboardScreen';

describe.skip('Dashboard AdHoc Task wiring', () => {
  it.skip('opens TaskScreen modal when quick action tapped', async () => {
    const tree = renderer.create(<DashboardScreen />);
    const root = tree.root;

    // Find FAB (contains Plus mock) and press it to open quick actions
    const fab = root.findAllByProps({ children: 'Plus' })[0];
    await act(async () => {
      fab.props.onPress();
    });

    // Find the quick action Pressable with title 'Ad Hoc Task'
    const actionPressable = root.findAll((n: any) => n.props && n.type === 'Text' && n.props.children === 'Ad Hoc Task')[0].parent;
    await act(async () => {
      actionPressable!.props.onPress();
    });

    // TaskScreen mock should now be in the tree
    const found = root.findAllByProps({ testID: 'mock-taskscreen' });
    expect(found.length).toBeGreaterThan(0);
  });
});
