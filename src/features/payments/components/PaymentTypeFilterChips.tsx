import React from 'react';
import { ScrollView, Pressable, Text } from 'react-native';
import type { PaymentsFilterOption } from '../hooks/useGlobalPaymentsScreen';

export interface PaymentTypeFilterChipsProps {
  value: PaymentsFilterOption;
  onChange: (option: PaymentsFilterOption) => void;
  isDark: boolean;
}

const CHIPS: { option: PaymentsFilterOption; label: string }[] = [
  { option: 'pending',    label: 'Pending' },
  { option: 'paid',       label: 'Paid' },
  { option: 'unassigned', label: 'Unassigned' },
  { option: 'quotations', label: 'Quotations' },
  { option: 'all',        label: 'All' },
];

export function PaymentTypeFilterChips({ value, onChange, isDark }: PaymentTypeFilterChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}
    >
      {CHIPS.map((chip) => {
        const isActive = value === chip.option;
        return (
          <Pressable
            key={chip.option}
            testID={`filter-chip-${chip.option}`}
            onPress={() => onChange(chip.option)}
            className={`px-4 py-2 rounded-full border items-center justify-center ${
              isActive
                ? isDark
                  ? 'bg-blue-500 border-blue-500'
                  : 'bg-blue-600 border-blue-600'
                : isDark
                ? 'bg-transparent border-zinc-700'
                : 'bg-transparent border-zinc-300'
            }`}
          >
            <Text
              className={`text-[13px] font-semibold tracking-wide leading-snug ${
                isActive
                  ? 'text-white'
                  : isDark
                  ? 'text-zinc-400'
                  : 'text-zinc-500'
              }`}
            >
              {chip.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
