// Minimal mock for react-native-css-interop used in Jest environment.
// Provide the few helpers the runtime expects so tests don't execute DOM shims.
module.exports = {
  maybeHijackSafeAreaProvider: (type) => type,
  shimFactory: (type) => type,
};
