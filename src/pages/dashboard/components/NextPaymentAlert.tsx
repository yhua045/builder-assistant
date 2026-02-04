import React from 'react';
import { View, Text } from 'react-native';
import { Calendar, AlertCircle } from 'lucide-react-native';
import { cssInterop } from 'nativewind';

cssInterop(Calendar, { className: { target: 'style', nativeStyleToProp: { color: true } } });
cssInterop(AlertCircle, { className: { target: 'style', nativeStyleToProp: { color: true } } });

export type NextPayment = {
  vendor: string;
  amount: number;
  dueDate: string;
  project?: string;
};

export default function NextPaymentAlert({ nextPayment }: { nextPayment: NextPayment }) {
  return (
    <View className="px-6 mb-6">
      <View className="bg-destructive/10 border border-destructive/30 rounded-2xl p-4">
        <View className="flex-row items-start">
          <View className="bg-destructive/20 p-2 rounded-lg mr-3">
            <AlertCircle className="text-destructive" size={20} />
          </View>
          <View className="flex-1">
            <Text className="text-foreground font-semibold mb-1">Next Payment Due</Text>
            <Text className="text-muted-foreground text-sm mb-2">{nextPayment.vendor}</Text>
            <View className="flex-row items-center justify-between">
              <Text className="text-destructive font-bold text-lg">
                ${nextPayment.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </Text>
              <View className="flex-row items-center">
                <Calendar className="text-muted-foreground" size={14} />
                <Text className="text-muted-foreground text-xs ml-1">{nextPayment.dueDate}</Text>
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
}
