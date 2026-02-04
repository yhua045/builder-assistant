import React from 'react';
import { View, Text } from 'react-native';
import { TrendingUp, DollarSign } from 'lucide-react-native';
import { cssInterop } from 'nativewind';

cssInterop(TrendingUp, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(DollarSign, { className: { target: 'style', nativeStyleToProp: { color: true } } });

export default function TotalExpenseCard({ totalExpense }: { totalExpense: number }) {
  return (
    <View className="px-6 mb-6">
      <View className="bg-card rounded-2xl p-6 border border-border">
        <View className="flex-row items-center justify-between mb-4">
          <Text className="text-muted-foreground text-sm font-medium">Total Expenses</Text>
          <View className="bg-primary/10 p-2 rounded-lg">
            <DollarSign className="text-primary" size={20} />
          </View>
        </View>
        <Text className="text-4xl font-bold text-foreground mb-2">
          ${totalExpense.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </Text>
        <View className="flex-row items-center">
          <TrendingUp className="text-chart-2" size={16} />
          <Text className="text-chart-2 text-sm ml-1 font-medium">+12.5% from last month</Text>
        </View>
      </View>
    </View>
  );
}
