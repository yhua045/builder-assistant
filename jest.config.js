module.exports = {
  preset: 'react-native',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|@react-native-async-storage|@react-native-ml-kit|react-native-image-picker|nativewind|react-native-css-interop|lucide-react-native)/)',
  ],
};
