/**
 * Builder Assistant App
 * 
 * Main application entry point demonstrating clean architecture.
 * The app separates domain logic, application use cases, and UI components.
 */

import React from 'react';
import {
  StatusBar,
  useColorScheme as rnUseColorScheme,
  View,
  StyleSheet,
} from 'react-native';
import {
  SafeAreaProvider,
} from 'react-native-safe-area-context';

// Navigation Imports
import { NavigationContainer } from '@react-navigation/native';
import TabsLayout from './src/pages/tabs';
import { lightTheme, darkTheme } from './src/pages/theme';
import { useColorScheme as nwUseColorScheme } from 'nativewind';
import 'react-native-get-random-values';
import { verifyInstallation } from 'nativewind';

if (__DEV__) {
  verifyInstallation();
}

function App() {
  const isDarkMode = rnUseColorScheme() === 'dark';

  const nwColor = nwUseColorScheme();
  const isDark = nwColor.colorScheme === 'dark' || isDarkMode;
  const backgroundColor = isDark ? 'rgb(15,23,42)' : 'rgb(250,251,252)';

  const containerStyle = [isDark ? darkTheme : lightTheme, styles.container, { backgroundColor }];

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <NavigationContainer>
        <View style={containerStyle}>
          <TabsLayout />
        </View>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default App;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
