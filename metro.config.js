const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const { withNativeWind } = require('nativewind/metro');

const defaultConfig = getDefaultConfig(__dirname);

module.exports = withNativeWind(
  mergeConfig(defaultConfig, {
    resolver: {
      extraNodeModules: {
        crypto: require.resolve('crypto-browserify'),
        'node:crypto': require.resolve('crypto-browserify'),
        stream: require.resolve('stream-browserify'),
        buffer: require.resolve('buffer/'),
        process: require.resolve('process/browser'),
        util: require.resolve('util/'),
        events: require.resolve('events/'),
        'drizzle-orm/sqlite-proxy/migrator': path.resolve(
          __dirname,
          'src/shims/drizzle-migrator.ts'
        ),
      },
      // allow CommonJS packages
      sourceExts: [...defaultConfig.resolver.sourceExts, 'cjs'],
    },
  }),
  { input: './global.css' }
);
