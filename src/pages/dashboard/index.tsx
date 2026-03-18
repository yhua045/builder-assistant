import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemeToggle } from '../../components/ThemeToggle';
import { useProjectsOverview } from '../../hooks/useProjectsOverview';
import { ProjectOverviewCard } from './components/ProjectOverviewCard';
import HeroSection from './components/HeroSection';
import { LayoutGrid, List } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
type DashboardNavigationProp = any;

export default function DashboardScreen() {
  const { data: overviews, isLoading, error } = useProjectsOverview();
  const [isComprehensive, setIsComprehensive] = useState(false);
  const navigation = useNavigation<DashboardNavigationProp>();

  const hasProjects = (overviews?.length ?? 0) > 0;

  const navigateToProject = (projectId: string) => {
    // Navigation to Projects stack with screen ProjectDetail
    navigation.navigate('Projects', {
      screen: 'ProjectDetail',
      params: { projectId },
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="px-6 py-4 flex-row items-center justify-between">
        <View>
          <Text className="text-muted-foreground text-sm">Overview</Text>
          <Text className="text-2xl font-bold text-foreground">Critical Path</Text>
        </View>
        <View className="flex-row items-center">
          {hasProjects && (
            <View className="flex-row bg-secondary/50 rounded-lg p-1 mr-4">
              <Pressable
                onPress={() => setIsComprehensive(false)}
                className={`p-1.5 rounded-md ${!isComprehensive ? 'bg-background shadow-sm' : ''}`}
              >
                <List size={18} className={!isComprehensive ? 'text-primary' : 'text-muted-foreground'} />
              </Pressable>
              <Pressable
                onPress={() => setIsComprehensive(true)}
                className={`p-1.5 rounded-md ${isComprehensive ? 'bg-background shadow-sm' : ''}`}
              >
                <LayoutGrid size={18} className={isComprehensive ? 'text-primary' : 'text-muted-foreground'} />
              </Pressable>
            </View>
          )}
          <ThemeToggle />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>
        {isLoading && (
          <View className="px-6 mt-4">
            <Text className="text-muted-foreground">Loading projects...</Text>
          </View>
        )}

        {error && (
          <View className="px-6 mt-4 p-4 bg-destructive/10 rounded-xl">
            <Text className="text-destructive">Failed to load overview data</Text>
          </View>
        )}

        {!isLoading && !error && !hasProjects && <HeroSection />}

        {!isLoading && !error && hasProjects && overviews && (
          <View className="px-6 mt-2">
             <Text className="text-sm font-medium text-muted-foreground mb-4 uppercase tracking-wider">
               Active Projects ({overviews.length})
             </Text>
            {overviews.map(overview => (
              <ProjectOverviewCard
                key={overview.project.id}
                overview={overview}
                isComprehensive={isComprehensive}
                onPress={() => navigateToProject(overview.project.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}