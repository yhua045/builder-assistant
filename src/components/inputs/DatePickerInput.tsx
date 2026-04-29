import React, { useEffect, useMemo, useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';

import formatDate from '../../utils/formatDate';

interface Props {
  label?: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
  minDate?: Date;
  maxDate?: Date;
  required?: boolean;
  error?: string;
}

const DatePickerInput: React.FC<Props> = ({
  label,
  value,
  onChange,
  minDate,
  maxDate,
  required,
  error,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [draftDate, setDraftDate] = useState<Date>(value ?? new Date());

  useEffect(() => {
    if (!isOpen) {
      setDraftDate(value ?? new Date());
    }
  }, [isOpen, value]);

  const displayValue = useMemo(() => {
    return value ? formatDate(value) : 'Select a date';
  }, [value]);

  const handleOpen = () => {
    setDraftDate(value ?? new Date());
    setIsOpen(true);
  };

  const handleClose = () => {
    setDraftDate(value ?? new Date());
    setIsOpen(false);
  };

  const handleConfirm = () => {
    onChange(draftDate);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setIsOpen(false);
  };

  const handleNativeChange = (
    event: { type?: string },
    nextDate?: Date,
  ) => {
    if (Platform.OS === 'android') {
      setIsOpen(false);

      if (event.type === 'set' && nextDate) {
        onChange(nextDate);
      }

      return;
    }

    if (nextDate) {
      setDraftDate(nextDate);
    }
  };

  return (
    <View className="gap-2 w-full mb-4">
      {label ? (
        <Text className="mb-1 text-zinc-900 text-sm font-semibold">
          {label}
          {required ? ' *' : ''}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={handleOpen}
        testID="date-picker-input-button"
        className={`border rounded-xl min-h-[48px] justify-center px-3.5 py-3 bg-white ${
          error ? 'border-red-600' : 'border-zinc-300'
        }`}
      >
        <Text className={`text-base ${!value ? 'text-zinc-400' : 'text-zinc-900'}`}>
          {displayValue}
        </Text>
      </Pressable>

      {error ? <Text className="text-red-500 text-xs">{error}</Text> : null}

      {Platform.OS === 'ios' ? (
        <Modal
          animationType="slide"
          onRequestClose={handleClose}
          presentationStyle="overFullScreen"
          transparent
          visible={isOpen}
        >
          <Pressable onPress={handleClose} className="flex-1 bg-slate-900/40" />
          <View className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[20px] pb-8 px-4 pt-2">
            <View className="flex-row items-center justify-between py-2">
              <Pressable onPress={handleClear} className="rounded-lg px-3 py-2.5">
                <Text className="text-red-600 text-sm font-semibold">Clear</Text>
              </Pressable>
              <Text className="text-zinc-900 text-[15px] font-semibold">{label || 'Select date'}</Text>
              <View className="flex-row gap-2">
                <Pressable onPress={handleClose} className="rounded-lg px-3 py-2.5">
                  <Text className="text-zinc-700 text-sm font-semibold">Cancel</Text>
                </Pressable>
                <Pressable onPress={handleConfirm} className="bg-zinc-900 rounded-lg px-3.5 py-2.5">
                  <Text className="text-white text-sm font-bold">Done</Text>
                </Pressable>
              </View>
            </View>
            <DateTimePicker
              display="spinner"
              maximumDate={maxDate}
              minimumDate={minDate}
              mode="date"
              onChange={handleNativeChange}
              testID="date-picker-native"
              value={draftDate}
              className="h-[216px] w-full"
            />
          </View>
        </Modal>
      ) : null}

      {Platform.OS === 'android' && isOpen ? (
        <DateTimePicker
          display="default"
          maximumDate={maxDate}
          minimumDate={minDate}
          mode="date"
          onChange={handleNativeChange}
          testID="date-picker-native"
          value={draftDate}
        />
      ) : null}
    </View>
  );
};

export default DatePickerInput;
