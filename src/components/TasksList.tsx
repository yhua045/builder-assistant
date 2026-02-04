import React from 'react';
import { View, Text } from 'react-native';
import { Clock, CheckSquare } from 'lucide-react-native';

export type Task = { id: string; title: string; date: string; type: string };

export default function TasksList({ tasks }: { tasks: Task[] }) {
  return (
    <View className="px-6 mb-6">
      <Text className="text-xl font-bold text-foreground mb-4">Upcoming Tasks</Text>
      <View className="gap-3">
        {tasks.map((task) => (
          <View key={task.id} className="bg-card border border-border rounded-xl p-4 flex-row items-center">
            <View className="bg-primary/10 p-2 rounded-lg mr-3">
              <CheckSquare className="text-primary" size={20} />
            </View>
            <View className="flex-1">
              <Text className="text-foreground font-semibold mb-1">{task.title}</Text>
              <View className="flex-row items-center">
                <Clock className="text-muted-foreground" size={12} />
                <Text className="text-muted-foreground text-xs ml-1">{task.date}</Text>
              </View>
            </View>
            <View className="bg-accent px-2 py-1 rounded">
              <Text className="text-accent-foreground text-xs">{task.type}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
