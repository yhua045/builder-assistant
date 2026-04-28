import React from 'react';
import { View, Text } from 'react-native';

interface PendingPaymentBadgeProps {
  amount: number;
  currency?: string;
}

export function PendingPaymentBadge({ amount, currency = '$' }: PendingPaymentBadgeProps) {
  if (!amount || amount === 0) return null;

  const formatted = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <View className="border border-chart-3/20 rounded-xl bg-chart-3/10 px-4 py-2 ml-2 items-end">
      <Text className="text-xs text-chart-3 font-medium uppercase mb-0.5">
        Pending Payment
      </Text>
      <Text className="text-lg font-bold text-chart-3">
        {currency}{formatted}
      </Text>
    </View>
  );
}
