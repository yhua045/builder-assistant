module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-native-async-storage|@react-native-ml-kit|react-native-image-picker|nativewind|react-native-css-interop|lucide-react-native)/)',
  ],
  // Ignore any nested worktree folders to prevent duplicate mocks/tests discovery
  testPathIgnorePatterns: ['<rootDir>/worktrees/.*'],
  watchPathIgnorePatterns: ['<rootDir>/worktrees/.*'],
  // Prevent Jest from loading modules from worktrees (resolves haste duplicate warnings)
  modulePathIgnorePatterns: ['<rootDir>/worktrees/.*'],
};
