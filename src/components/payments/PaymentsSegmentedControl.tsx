import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import type { PaymentsMode } from '../../hooks/usePayments';

interface PaymentsSegmentedControlProps {
  value: PaymentsMode;
  onChange: (mode: PaymentsMode) => void;
}

const SEGMENTS: { mode: PaymentsMode; label: string }[] = [
  { mode: 'firefighter', label: '🔥 The Firefighter' },
  { mode: 'site_manager', label: '📋 The Site Manager' },
];

export default function PaymentsSegmentedControl({ value, onChange }: PaymentsSegmentedControlProps) {
  return (
    <View style={styles.container} className="bg-muted rounded-xl p-1 flex-row">
      {SEGMENTS.map(({ mode, label }) => {
        const active = value === mode;
        return (
          <TouchableOpacity
            key={mode}
            onPress={() => onChange(mode)}
            style={styles.segment}
            className={active ? 'bg-card rounded-lg shadow-sm' : ''}
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
