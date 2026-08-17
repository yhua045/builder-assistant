import React from 'react';
import { View, Text } from 'react-native';

type StatItem = {
  id: string;
  label: string;
  value: string | number;
  Icon: React.ComponentType<any>;
  iconClass?: string;
};

export default function QuickStats({ items }: { items: StatItem[] }) {
  return (
    <View className="px-6 mb-6">
      <View className="flex-row gap-3">
        {items.map((item) => (
          <View key={item.id} className="flex-1 bg-card border border-border rounded-xl p-4">
            <View className="bg-chart-1/10 p-2 rounded-lg self-start mb-2">
              <item.Icon className={item.iconClass ?? 'text-chart-1'} size={20} />
            </View>
            <Text className="text-2xl font-bold text-foreground mb-1">{item.value}</Text>
            <Text className="text-muted-foreground text-xs">{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
