import React from 'react';
import { View, Text } from 'react-native';
import { DollarSign } from 'lucide-react-native';
import PaymentList from './PaymentList';

type Payment = {
  id: string;
  vendor: string;
  amount: number;
  dueDate: string;
  project: string;
  invoice?: string;
};

export default function CashOutflow({ payments }: { payments: Payment[] }) {
  const total = payments.reduce((s, p) => s + p.amount, 0);

  return (
    <View className="px-6 mb-6">
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center">
          <DollarSign className="text-primary mr-2" size={20} />
          <Text className="text-lg font-bold text-foreground">Payment Due This Week</Text>
        </View>
      </View>

      <View className="bg-primary/10 border border-primary/30 rounded-xl p-4 mb-4">
        <Text className="text-muted-foreground text-sm mb-1">Total Due This Week</Text>
        <Text className="text-primary font-bold text-3xl">${total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</Text>
        <Text className="text-muted-foreground text-xs mt-1">{payments.length} payment{payments.length !== 1 ? 's' : ''} scheduled</Text>
      </View>

      <PaymentList payments={payments} />
    </View>
  );
}
