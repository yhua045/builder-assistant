import React from 'react';
import { View, Text } from 'react-native';

interface AmountPayableBannerProps {
  total: number;
  currency?: string;
}

const formatCurrency = (amount: number, currency = 'AUD') =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency, minimumFractionDigits: 0 }).format(amount);

export default function AmountPayableBanner({ total, currency }: AmountPayableBannerProps) {
  return (
    <View className="bg-primary rounded-2xl px-5 py-4 mb-4">
      <Text className="text-primary-foreground text-xs font-semibold uppercase tracking-wider mb-1">
        Total Amount Payable
      </Text>
      <Text className="text-primary-foreground text-3xl font-bold">
        {formatCurrency(total, currency)}
      </Text>
    </View>
  );
}
