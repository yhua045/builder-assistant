import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { PaymentsFilterOption } from '../../hooks/useGlobalPaymentsScreen';

interface PaymentsFilterBarProps {
  value: PaymentsFilterOption;
  onChange: (option: PaymentsFilterOption) => void;
}

const SEGMENTS: { option: PaymentsFilterOption; label: string }[] = [
  { option: 'quotations', label: 'Quotations' },
  { option: 'pending', label: 'Pending' },
  { option: 'paid', label: 'Paid' },
  { option: 'all', label: 'All' },
];

export function PaymentsFilterBar({ value, onChange }: PaymentsFilterBarProps) {
  return (
    <View style={styles.container} className="bg-muted rounded-xl p-1 flex-row">
      {SEGMENTS.map(({ option, label }) => {
        const active = value === option;
        return (
          <TouchableOpacity
            key={option}
            testID={`filter-option-${option}`}
            onPress={() => onChange(option)}
            style={styles.segment}
            className={active ? 'bg-card rounded-lg shadow-sm' : undefined}
            activeOpacity={0.7}
          >
            <Text
              className={`text-sm font-semibold text-center ${
                active ? 'text-foreground' : 'text-muted-foreground'
              }`}
            >
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { height: 44 },
  segment: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
