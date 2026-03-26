const React = require('react');
const { View } = require('react-native');

const SafeAreaView = ({ children, ...props }) => React.createElement(View, props, children);
const SafeAreaProvider = ({ children, ...props }) => React.createElement(View, props, children);

// Provide displayName for interop wrappers that rely on it in tests
SafeAreaView.displayName = 'SafeAreaView';
SafeAreaProvider.displayName = 'SafeAreaProvider';

const useSafeAreaInsets = () => ({ top: 0, bottom: 0, left: 0, right: 0 });

module.exports = {
  SafeAreaView,
  SafeAreaProvider,
  useSafeAreaInsets,
};
