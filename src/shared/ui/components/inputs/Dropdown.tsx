import React, { useState } from 'react';
import { FlatList, Modal, Pressable, Text, View } from 'react-native';
import { ChevronDown, Check } from 'lucide-react-native';

export interface DropdownOption<T extends string = string> {
  /** Display text shown to the user */
  label: string;
  /** Stored value passed to onChange */
  value: T;
}

export interface DropdownProps<T extends string = string> {
  /** Field label rendered above the trigger */
  label?: string;
  /** Currently selected value */
  value: T | undefined;
  /** Called when the user confirms a selection */
  onChange: (value: T) => void;
  /** Options list */
  options: DropdownOption<T>[];
  /** Placeholder shown when value is undefined */
  placeholder?: string;
  /** Renders an error message below the trigger */
  error?: string;
  /** Disables interaction */
  disabled?: boolean;
  /** testID forwarded to the trigger Pressable */
  testID?: string;
}

function Dropdown<T extends string = string>({
  label,
  value,
  onChange,
  options,
  placeholder = 'Select an option',
  error,
  disabled,
  testID,
}: DropdownProps<T>): React.ReactElement {
  const [open, setOpen] = useState(false);

  const selectedOption = options.find((o) => o.value === value);

  const handleOpen = () => {
    if (!disabled) {
      setOpen(true);
    }
  };

  const handleSelect = (optionValue: T) => {
    onChange(optionValue);
    setOpen(false);
  };

  const handleDismiss = () => setOpen(false);

  return (
    <View>
      {label ? (
        <Text className="mb-1 font-semibold text-foreground">{label}</Text>
      ) : null}

      <Pressable
        accessibilityRole="combobox"
        accessibilityLabel={label}
        onPress={handleOpen}
        testID={testID}
        className="border border-border rounded-lg h-12 px-3 bg-background flex-row items-center justify-between"
      >
        <Text className={selectedOption ? 'text-foreground' : 'text-muted-foreground'}>
          {selectedOption?.label ?? placeholder}
        </Text>
        <ChevronDown size={18} className="text-muted-foreground" />
      </Pressable>

      {error ? (
        <Text className="text-destructive text-sm mt-1">{error}</Text>
      ) : null}

      <Modal
        visible={open}
        animationType="fade"
        transparent
        onRequestClose={handleDismiss}
      >
        <View className="flex-1 justify-end">
          {/* Backdrop — tapping dismisses without selecting */}
          <Pressable
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
            className="bg-black/50"
            onPress={handleDismiss}
            testID="dropdown-backdrop"
            accessibilityLabel="Close dropdown"
          />

          {/* Options sheet — rendered above the backdrop */}
          <View className="bg-card rounded-t-2xl">
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => {
                const isSelected = item.value === value;
                return (
                  <Pressable
                    accessibilityRole="menuitem"
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => handleSelect(item.value)}
                    className={`flex-row items-center justify-between px-4 py-3 border-b border-border${isSelected ? ' bg-primary/10' : ''}`}
                  >
                    <Text className={isSelected ? 'text-primary font-medium' : 'text-foreground'}>
                      {item.label}
                    </Text>
                    {isSelected ? (
                      <View testID={`check-${item.value}`}>
                        <Check size={18} className="text-primary" />
                      </View>
                    ) : null}
                  </Pressable>
                );
              }}
            />

            <Pressable
              onPress={handleDismiss}
              className="items-center py-4 border-t border-border"
            >
              <Text className="text-foreground font-semibold">Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default Dropdown;
