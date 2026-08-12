/**
 * Builder Assistant App
 * 
 * Main application entry point demonstrating clean architecture.
 * The app separates domain logic, application use cases, and UI components.
 */

import React, { useEffect, useMemo } from 'react';
import {
  StatusBar,
  useColorScheme as rnUseColorScheme,
  View,
  StyleSheet,
} from 'react-native';
import { useProjects } from './src/features/projects';
import { KnowledgeEmbeddingLaunchScreen } from './src/features/knowledge-embedding';
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

// TanStack Query
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Analytics & error monitoring
import { container } from 'tsyringe';
import { ErrorBoundary } from './src/components/shared/ErrorBoundary';
import type { ErrorReportingAdapter } from './src/infrastructure/analytics/ErrorReportingAdapter';
import './src/infrastructure/di/registerServices';

// Demo data imports (dev only)
import { initDatabase } from './src/infrastructure/database/connection';
import { seedDemoData } from './src/infrastructure/demo/seedDemoData';
import { resetDemoData } from './src/infrastructure/demo/resetDemoData';
import { SEED_DEMO_DATA, RESET_DEMO_DATA } from '@env';

if (__DEV__) {
  verifyInstallation();
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,        // No auto-refetch — only explicit invalidateQueries() triggers refetches
      refetchOnWindowFocus: false, // Don't refetch when app returns to foreground
      refetchOnReconnect: false,   // App is fully local (SQLite); network reconnect is irrelevant
      gcTime: 5 * 60_000,         // Keep cache entries for 5 min after last subscriber unmounts
      retry: 1,
    },
  },
});

function AppContent() {
  const isDarkMode = rnUseColorScheme() === 'dark';
  const { projects, loading } = useProjects();
  const hasProjects = (projects?.length ?? 0) > 0;

  // Resolve error reporting adapter once (stable singleton)
  const errorReporter = useMemo<ErrorReportingAdapter | undefined>(() => {
    try {
      return container.resolve<ErrorReportingAdapter>('ErrorReportingAdapter');
    } catch {
      return undefined;
    }
  }, []);

  // Capture unhandled promise rejections globally
  useEffect(() => {
    if (!errorReporter) return;
    const handleRejection = (event: { reason?: unknown }) => {
      const err =
        event?.reason instanceof Error
          ? event.reason
          : new Error(String(event?.reason ?? 'Unhandled promise rejection'));
      errorReporter.captureException(err, { source: 'unhandled_rejection' });
    };
    if (typeof (global as any).addEventListener === 'function') {
      (global as any).addEventListener('unhandledrejection', handleRejection);
      return () =>
        (global as any).removeEventListener('unhandledrejection', handleRejection);
    }
  }, [errorReporter]);

  // Initialize database and seed demo data on app startup
  useEffect(() => {
    const initializeApp = async () => {
      try {
        await initDatabase();

        if (__DEV__) {
          // Reset demo data if environment variable is set
          if (RESET_DEMO_DATA === 'true') {
            console.log('[app] Resetting demo data...');
            await resetDemoData();
          } else if (SEED_DEMO_DATA === 'true') {
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
      <View style={containerStyle}>
        <ErrorBoundary errorReportingAdapter={errorReporter}>
          <NavigationContainer>
            {!loading && !hasProjects ? (
              <KnowledgeEmbeddingLaunchScreen />
            ) : (
              <TabsLayout />
            )}
          </NavigationContainer>
        </ErrorBoundary>
      </View>
    </SafeAreaProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  );
}

export default App;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
