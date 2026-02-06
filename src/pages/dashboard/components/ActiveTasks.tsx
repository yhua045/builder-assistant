import React from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { ClipboardList, Clock } from 'lucide-react-native';

type Task = {
  id: string;
  title: string;
  time: string;
  vendor: string;
  project: string;
  type: string;
};

export default function ActiveTasks({ tasks }: { tasks: Task[] }) {
  return (
    <View className="mb-6">
      <View className="px-6 mb-3 flex-row items-center">
        <ClipboardList className="text-chart-2 mr-2" size={20} />
        <Text className="text-lg font-bold text-foreground">Next Up</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 24, gap: 12 }}>
        {tasks.map((task) => (
          <Pressable key={task.id}>
            <View className="bg-card border border-border rounded-xl p-4 w-72">
              <View className="flex-row items-start justify-between mb-3">
                <View className="flex-1 mr-2">
                  <Text className="text-foreground font-bold text-base mb-1">{task.title}</Text>
                  <Text className="text-muted-foreground text-sm">{task.vendor}</Text>
                </View>
                <View className="bg-chart-2/10 px-2 py-1 rounded">
                  <Text className="text-chart-2 text-xs font-medium">{task.type}</Text>
                </View>
              </View>

              <View className="flex-row items-center mb-2">
                <Clock className="text-primary mr-1.5" size={14} />
                <Text className="text-primary text-sm font-medium">{task.time}</Text>
              </View>

              <View className="bg-muted px-2 py-1 rounded self-start">
                <Text className="text-muted-foreground text-xs">{task.project}</Text>
              </View>
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
