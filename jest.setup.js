/**
 * Jest setup for React Native tests
 */

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