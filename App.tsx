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

// Temporary placeholder for original content to be migrated
function AppContent() {
  const safeAreaInsets = useSafeAreaInsets();
  const { projects, loading, error, createProject, getProjectAnalysis, refreshProjects } = useProjects();
  const [showDemo, setShowDemo] = useState(false);

  const handleCreateDemoProject = async () => {
    const demoProject = {
      name: 'Residential Home Construction',
      description: 'A 2-story family home with modern amenities and energy-efficient design.',
      budget: 350000,
      startDate: new Date(),
      expectedEndDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000), // 180 days from now
    };

    const result = await createProject(demoProject);
    
    if (result.success) {
      Alert.alert('Success', 'Demo project created successfully!');
    } else {
      Alert.alert('Error', result.errors?.join(', ') || 'Failed to create project');
    }
  };

  const handleProjectPress = async (project: Project) => {
    const analysis = await getProjectAnalysis(project.id);
    
    if (analysis.success && analysis.analysis) {
      const { projectOverview, recommendations } = analysis.analysis;
      
      Alert.alert(
        `Project Analysis: ${project.name}`,
        `Status: ${projectOverview.status}\n` +
        `Progress: ${projectOverview.progressPercentage.toFixed(1)}%\n` +
        `Budget Usage: ${projectOverview.budgetUtilization.toFixed(1)}%\n` +
        `Over Budget: ${projectOverview.isOverBudget ? 'Yes' : 'No'}\n\n` +
        `Recommendations:\n${recommendations.slice(0, 3).join('\n') || 'No recommendations at this time'}`
      );
    } else {
      Alert.alert('Error', 'Failed to analyze project');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: safeAreaInsets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Builder Assistant</Text>
        <Text style={styles.headerSubtitle}>Project Management & Analysis</Text>
      </View>

      {/* Demo Section */}
      <View style={styles.demoSection}>
        <TouchableOpacity 
          style={styles.demoButton}
          onPress={handleCreateDemoProject}
        >
          <Text style={styles.demoButtonText}>+ Create Demo Project</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.architectureButton}
          onPress={() => setShowDemo(!showDemo)}
        >
          <Text style={styles.architectureButtonText}>
            {showDemo ? 'Hide' : 'Show'} Architecture Info
          </Text>
        </TouchableOpacity>
      </View>

      {/* Architecture Demo Info */}
      {showDemo && (
        <View style={styles.architectureInfo}>
          <Text style={styles.architectureTitle}>Clean Architecture Demonstrated:</Text>
          <Text style={styles.architectureText}>
            • Domain Layer: Project entities with business rules{'\n'}
            • Application Layer: Use cases (CreateProject, GetAnalysis){'\n'}
            • UI Layer: React components with custom hooks{'\n'}
            • Services: Local storage implementation{'\n'}
            • Utils: Date and currency formatting{'\n'}
            • Platform separation: iOS/Android specific code isolated
          </Text>
        </View>
      )}

      {/* Project List */}
      <ProjectList
        projects={projects}
        loading={loading}
        error={error}
        onProjectPress={handleProjectPress}
        onRefresh={refreshProjects}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  } as ViewStyle,

  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  } as ViewStyle,

  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
  } as TextStyle,

  headerSubtitle: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
  } as TextStyle,

  demoSection: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  } as ViewStyle,

  demoButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  } as ViewStyle,

  demoButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  } as TextStyle,

  architectureButton: {
    flex: 1,
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  } as ViewStyle,

  architectureButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  } as TextStyle,

  architectureInfo: {
    backgroundColor: '#E3F2FD',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  } as ViewStyle,

  architectureTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1976D2',
    marginBottom: 8,
  } as TextStyle,

  architectureText: {
    fontSize: 14,
    color: '#424242',
    lineHeight: 20,
  } as TextStyle,
});

export default App;
