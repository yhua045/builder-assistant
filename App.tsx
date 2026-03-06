/**
 * Builder Assistant App
 * 
 * Main application entry point demonstrating clean architecture.
 * The app separates domain logic, application use cases, and UI components.
 */

import React, { useEffect } from 'react';
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

// Demo data imports (dev only)
import { initDatabase } from './src/infrastructure/database/connection';
import { seedDemoData } from './src/infrastructure/demo/seedDemoData';
import { resetDemoData } from './src/infrastructure/demo/resetDemoData';
// Allow process.env access consistent with registerServices.ts
declare const process: any;

if (__DEV__) {
  verifyInstallation();
}

function App() {
  const isDarkMode = rnUseColorScheme() === 'dark';

  // Initialize database and seed demo data on app startup
  useEffect(() => {
    const initializeApp = async () => {
      try {
        await initDatabase();

        if (__DEV__) {
          // Reset demo data if environment variable is set
          if (process.env.RESET_DEMO_DATA === 'true') {
            console.log('[app] Resetting demo data...');
            await resetDemoData();
            await seedDemoData();
          } else if (process.env.SEED_DEMO_DATA === 'true') {
            // Seed demo data if environment variable is set
            console.log('[app] Seeding demo data...');
            await seedDemoData();
          }
        }
      } catch (error) {
        console.error('[app] Initialization error:', error);
      }
    };

    initializeApp();
  }, []);

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
