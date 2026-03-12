/* eslint-env jest */
/**
 * Jest setup for React Native tests
 */

// Ensure reflect-metadata is loaded for DI libraries like tsyringe
import 'reflect-metadata';

// Mock AsyncStorage before any imports
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Mock Alert for testing
jest.mock('react-native', () => {
  const RN = jest.requireActual('react-native');
  
  RN.Alert = {
    alert: jest.fn(),
  };
  
  return RN;
});

// Use manual mocks to avoid NativeWind and SafeAreaContext async effects in Jest
jest.mock('nativewind');
jest.mock('react-native-safe-area-context');
jest.mock('@react-native-community/datetimepicker');