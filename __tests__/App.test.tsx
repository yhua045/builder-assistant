/**
 * @format
 */

// Mock navigation and nativewind to avoid ESM imports from node_modules
jest.mock('@react-navigation/native', () => ({
  NavigationContainer: ({ children }: any) => children,
}));

jest.mock('nativewind', () => ({
  useColorScheme: () => ({ colorScheme: 'light' }),
  verifyInstallation: () => {},
  vars: (v: any) => v,
}));

// Mock the app's tabs layout to avoid importing navigation ESM modules
jest.mock('../src/pages/tabs', () => ({ __esModule: true, default: () => null }));

// Mock random-values polyfill to avoid runtime issues in Jest
jest.mock('react-native-get-random-values', () => ({}));

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
