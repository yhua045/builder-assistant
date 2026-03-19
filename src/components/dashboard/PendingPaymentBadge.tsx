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
    <View className="border border-orange-500/30 rounded-xl bg-orange-500/10 px-3 py-1.5 ml-2">
      <Text className="text-[10px] text-orange-500 dark:text-orange-400 font-bold uppercase tracking-wide text-center mb-0.5" style={{ letterSpacing: 0.5 }}>
        Pending Payment
      </Text>
      <Text className="text-base font-bold text-orange-500 dark:text-orange-400 text-center">
        {currency}{formatted}
      </Text>
    </View>
  );
}
