import React from 'react';
import { View, Text, Image, Pressable } from 'react-native';
import { Plus } from 'lucide-react-native';
import { cssInterop } from 'nativewind';

cssInterop(Plus, { className: { target: 'style', nativeStyleToProp: { color: true } } });

const mockProgressLogs = [
  {
    id: 'pl1',
    date: 'Dec 22, 2024',
    time: '2:30 PM',
    inspector: 'Mike Johnson',
    text: 'Main panel installed and wired. All breakers labeled according to specifications. Grounding connections verified and secure. No issues found.',
    image: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=800&auto=format&fit=crop&q=60'
  },
  {
    id: 'pl2',
    date: 'Dec 21, 2024',
    time: '10:15 AM',
    inspector: 'John Martinez',
    text: 'Rough-in inspection completed. All conduits properly secured. Need to verify final connections before power-up.',
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&auto=format&fit=crop&q=60'
  }
];

import { ProgressLog } from "../../domain/entities/ProgressLog";
export function TaskProgressSection({ progressLogs = [], onAddLog }: { progressLogs?: ProgressLog[]; onAddLog?: () => void }) {
  const renderProgressLog = ({ item, index }: { item: any; index: number }) => (
    <View key={item.id} className="flex-row gap-4">
      {/* Timeline Line */}
      <View className="items-center">
        <View className="w-4 h-4 rounded-full bg-primary border-4 border-background" />
        {index !== mockProgressLogs.length - 1 && (
          <View className="w-0.5 flex-1 bg-border mt-2" />
        )}
      </View>

      {/* Log Content */}
      <View className="flex-1 pb-6">
        <View className="bg-card border border-border rounded-2xl p-4 mb-3">
          <View className="flex-row items-center justify-between mb-2">
            <Text className="text-sm font-bold text-foreground">{item.date}</Text>
            <Text className="text-xs text-muted-foreground">{item.time}</Text>
          </View>
          <Text className="text-xs text-primary font-medium mb-3">by {item.inspector}</Text>
          <Text className="text-sm text-foreground leading-relaxed mb-3">
            {item.text}
          </Text>
          {item.image && (
            <Image 
              source={{ uri: item.image }} 
              className="w-full h-40 rounded-xl"
              resizeMode="cover"
            />
          )}
        </View>
      </View>
    </View>
  );

  return (
    <View className="px-6 mb-6">
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
          Progress Logs
        </Text>
        <Pressable className="flex-row items-center gap-2 bg-primary/10 px-3 py-2 rounded-full">
          <Plus className="text-primary" size={16} />
          <Text className="text-xs text-primary font-semibold">Add Log</Text>
        </Pressable>
      </View>

      <View className="pl-2">
        {(progressLogs && progressLogs.length > 0 ? progressLogs : mockProgressLogs).map((log, index) => renderProgressLog({ item: log, index }))}
      </View>
    </View>
  );
}
