module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    // Map the Babel virtual module @env to a manual mock so Jest can resolve it
    '^@env$': '<rootDir>/__mocks__/@env.js',
    // Analytics SDK mocks (packages not installed as native modules)
    '^@react-native-firebase/analytics$': '<rootDir>/__mocks__/@react-native-firebase/analytics.js',
    '^mixpanel-react-native$': '<rootDir>/__mocks__/mixpanel-react-native.js',
    '^@sentry/react-native$': '<rootDir>/__mocks__/@sentry/react-native.js',
    // Auth native module mocks (issue #226)
    '^react-native-keychain$': '<rootDir>/__mocks__/react-native-keychain.js',
    '^react-native-app-auth$': '<rootDir>/__mocks__/react-native-app-auth.js',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|@react-native-async-storage|@react-native-ml-kit|react-native-image-picker|react-native-nitro-sound|react-native-permissions|nativewind|react-native-css-interop|lucide-react-native|jest-cucumber|@cucumber|uuid)/)',
  ],
  // Ignore any nested worktree folders to prevent duplicate mocks/tests discovery
  // Also exclude shared test utilities that have no test blocks
  testPathIgnorePatterns: ['<rootDir>/worktrees/.*', '<rootDir>/__tests__/utils/.*'],
  watchPathIgnorePatterns: ['<rootDir>/worktrees/.*'],
  // Prevent Jest from loading modules from worktrees (resolves haste duplicate warnings)
  modulePathIgnorePatterns: ['<rootDir>/worktrees/.*'],
};
