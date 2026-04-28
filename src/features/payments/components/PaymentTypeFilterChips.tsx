import React from 'react';
import { ScrollView, Pressable, Text, StyleSheet } from 'react-native';
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

const ACTIVE_BG_LIGHT  = '#2563eb'; // blue-600
const ACTIVE_BG_DARK   = '#3b82f6'; // blue-500
const BORDER_LIGHT     = '#d4d4d8'; // zinc-300
const BORDER_DARK      = '#3f3f46'; // zinc-700
const MUTED_TEXT_LIGHT = '#71717a'; // zinc-500
const MUTED_TEXT_DARK  = '#a1a1aa'; // zinc-400

export function PaymentTypeFilterChips({ value, onChange, isDark }: PaymentTypeFilterChipsProps) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {CHIPS.map((chip) => {
        const isActive = value === chip.option;
        return (
          <Pressable
            key={chip.option}
            testID={`filter-chip-${chip.option}`}
            onPress={() => onChange(chip.option)}
            style={[
              styles.chip,
              isActive ? styles.chipActive : styles.chipInactive,
              isDark
                ? isActive
                  ? { backgroundColor: ACTIVE_BG_DARK, borderColor: ACTIVE_BG_DARK }
                  : { borderColor: BORDER_DARK }
                : null,
            ]}
          >
            <Text
              style={[
                styles.label,
                isActive
                  ? styles.labelActive
                  : isDark
                  ? { color: MUTED_TEXT_DARK }
                  : styles.labelInactive,
              ]}
            >
              {chip.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 4,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipActive: {
    backgroundColor: ACTIVE_BG_LIGHT,
    borderColor: ACTIVE_BG_LIGHT,
  },
  chipInactive: {
    backgroundColor: 'transparent',
    borderColor: BORDER_LIGHT,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.1,
    lineHeight: 18,
  },
  labelActive: {
    color: '#ffffff',
  },
  labelInactive: {
    color: MUTED_TEXT_LIGHT,
  },
});
