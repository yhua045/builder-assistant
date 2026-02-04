import React from 'react';
import { View, Text, ScrollView, Image, Pressable } from 'react-native';

export type Project = {
  id: string;
  name: string;
  totalExpense: number;
  status: string;
  completion: number;
  image: string;
};

export default function ProjectsList({ projects }: { projects: Project[] }) {
  return (
    <View className="mb-6">
      <View className="px-6 mb-4 flex-row items-center justify-between">
        <Text className="text-xl font-bold text-foreground">Active Projects</Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, gap: 16 }}
      >
        {projects.map((project) => (
          <Pressable key={project.id}>
            <View className="bg-card border border-border rounded-2xl overflow-hidden w-72">
              <Image
                source={{ uri: project.image }}
                className="w-full h-40"
                resizeMode="cover"
              />
              <View className="p-4">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-foreground font-bold text-base flex-1">{project.name}</Text>
                  <View className="bg-chart-2/10 px-2 py-1 rounded">
                    <Text className="text-chart-2 text-xs font-medium">{project.status}</Text>
                  </View>
                </View>
                <Text className="text-2xl font-bold text-foreground mb-3">
                  ${project.totalExpense.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </Text>
                <View className="mb-2">
                  <View className="flex-row items-center justify-between mb-1">
                    <Text className="text-muted-foreground text-xs">Progress</Text>
                    <Text className="text-foreground text-xs font-medium">{project.completion}%</Text>
                  </View>
                  <View className="bg-muted h-2 rounded-full overflow-hidden">
                    <View className="bg-primary h-full rounded-full" style={{ width: `${project.completion}%` }} />
                  </View>
                </View>
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
