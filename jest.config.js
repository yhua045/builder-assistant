module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-navigation|@react-native-async-storage|@react-native-ml-kit|react-native-image-picker|react-native-nitro-sound|react-native-permissions|nativewind|react-native-css-interop|lucide-react-native)/)',
  ],
  // Ignore any nested worktree folders to prevent duplicate mocks/tests discovery
  // Also exclude shared test utilities that have no test blocks
  testPathIgnorePatterns: ['<rootDir>/worktrees/.*', '<rootDir>/__tests__/utils/.*'],
  watchPathIgnorePatterns: ['<rootDir>/worktrees/.*'],
  // Prevent Jest from loading modules from worktrees (resolves haste duplicate warnings)
  modulePathIgnorePatterns: ['<rootDir>/worktrees/.*'],
};
