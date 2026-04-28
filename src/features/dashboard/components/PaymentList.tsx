import React from 'react';
import { View, Text } from 'react-native';
import { Calendar } from 'lucide-react-native';

type Payment = {
  id: string;
  vendor: string;
  amount: number;
  dueDate: string;
  project: string;
  invoice?: string;
};

export default function PaymentList({ payments }: { payments: Payment[] }) {
  return (
    <View className="gap-3">
      {payments.map((payment) => (
        <View key={payment.id} className="bg-card border border-border rounded-xl p-4">
          <View className="flex-row items-start justify-between mb-2">
            <View className="flex-1 mr-3">
              <Text className="text-foreground font-semibold mb-1">{payment.vendor}</Text>
              <Text className="text-muted-foreground text-xs mb-1">{payment.project}</Text>
              <View className="flex-row items-center">
                <Calendar className="text-muted-foreground mr-1" size={12} />
                <Text className="text-muted-foreground text">{payment.dueDate}</Text>
              </View>
            </View>
            <View className="items-end">
              <Text className="text-foreground font-bold text-lg">${payment.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
              {payment.invoice ? <Text className="text-muted-foreground text-xs">{payment.invoice}</Text> : null}
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}
