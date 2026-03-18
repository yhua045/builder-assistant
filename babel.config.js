module.exports = {
  presets: ['module:@react-native/babel-preset', 'nativewind/babel'],
  plugins: [
    [
      'module:react-native-dotenv',
      {
        moduleName: '@env',
        path: '.env',
        envName: 'APP_ENV',
        allowUndefined: true,
      },
    ],
    // react-native-reanimated/plugin MUST be last (required by nativewind → react-native-css-interop → reanimated)
    'react-native-reanimated/plugin',
  ],
};
