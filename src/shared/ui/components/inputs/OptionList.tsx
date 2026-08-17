import React from 'react';
import { View, Text, Pressable } from 'react-native';
import type { DropdownOption } from './Dropdown';

export interface OptionListProps<T extends string = string> {
  label?: string;
  value: T | undefined;
  onChange: (value: T) => void;
  options: DropdownOption<T>[];
  error?: string;
  horizontal?: boolean;
  testID?: string;
}

function OptionList<T extends string = string>({
  label,
  value,
  onChange,
  options,
  error,
  horizontal = true,
  testID,
}: OptionListProps<T>): React.ReactElement {
  return (
    <View testID={testID}>
      {label ? (
        <Text className="mb-1 font-semibold text-foreground">{label}</Text>
      ) : null}

      <View className={horizontal ? 'flex-row flex-wrap gap-2' : 'gap-2'}>
        {options.map((opt) => {
          const selected = opt.value === value;
          return (
            <Pressable
              key={opt.value}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => onChange(opt.value)}
              testID={`option-${opt.value}`}
              className={
                selected
                  ? 'px-3 py-2 rounded-full bg-primary border border-primary'
                  : 'px-3 py-2 rounded-full bg-background border border-border'
              }
            >
              <Text
                className={
                  selected
                    ? 'text-primary-foreground font-medium text-sm'
                    : 'text-foreground text-sm'
                }
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {error ? (
        <Text className="text-destructive text-sm mt-1">{error}</Text>
      ) : null}
    </View>
  );
}

export default OptionList;