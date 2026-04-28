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
// Mock css interop to avoid runtime JSX hijacking in tests
jest.mock('react-native-css-interop');

jest.mock('./src/hooks/useQuickLookup', () => ({
  useQuickLookup: () => ({
    quickAdd: jest.fn().mockResolvedValue({ id: 'dummy-id', name: 'Dummy' }),
    getSuggested: jest.fn().mockResolvedValue([]),
    selectContact: jest.fn(),
    lookupByLicense: jest.fn().mockResolvedValue([]),
    suggestedContacts: [],
    isLoadingSuggestions: false
  }),
}));
jest.mock('react-native-safe-area-context');
jest.mock('@react-native-community/datetimepicker');

// No global mock for @tanstack/react-query - tests that use hooks must wrap with QueryClientProvider
// via renderHookWithQuery() or wrapWithQuery()
// Global mock for native-stack introduced after vertical slices brought navigators into barrel exports
jest.mock('@react-navigation/native-stack', () => {
  return {
    createNativeStackNavigator: jest.fn().mockReturnValue({
      Navigator: ({ children }) => children,
      Screen: () => null,
    }),
  };
});
