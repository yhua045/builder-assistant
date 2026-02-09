/**
 * Builder Assistant App
 * 
 * Main application entry point demonstrating clean architecture.
 * The app separates domain logic, application use cases, and UI components.
 */

import React, { useState } from 'react';
import {
  StatusBar,
  StyleSheet,
  useColorScheme as rnUseColorScheme,
  View,
  Text,
  TouchableOpacity,
  Alert,
  TextStyle,
  ViewStyle,
} from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

// Import clean architecture components
import { ProjectList } from './src/components/ProjectList';
import { useProjects } from './src/hooks/useProjects';
import { Project } from './src/domain/entities/Project';

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

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <NavigationContainer>
        <View
          style={[
            isDark ? darkTheme : lightTheme,
            { flex: 1, backgroundColor: isDark ? 'rgb(15,23,42)' : 'rgb(250,251,252)' },
          ]}
        >
          <TabsLayout />
        </View>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default App;
