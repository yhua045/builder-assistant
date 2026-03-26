// Dynamically select .env file based on APP_ENV environment variable
const appEnv = process.env.APP_ENV || 'development';
const envFilePath = appEnv === 'reset' ? '.env.reset' : `.env.${appEnv}`;

module.exports = {
  presets: [
    'module:@react-native/babel-preset',
    // Disable nativewind babel preset in Jest (test env) to avoid runtime JSX
    // interop wrapping during unit/integration tests.
    ...(process.env.NODE_ENV === 'test' ? [] : ['nativewind/babel']),
  ],
  plugins: [
    [
      'module:react-native-dotenv',
      {
        moduleName: '@env',
        path: envFilePath,
        allowUndefined: true,
      },
    ],
    // react-native-reanimated/plugin MUST be last (required by nativewind → react-native-css-interop → reanimated)
    'react-native-reanimated/plugin',
  ],
};
