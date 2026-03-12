import React, { useEffect, useMemo, useState } from 'react';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
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
    <View style={styles.container}>
      {label ? (
        <Text style={styles.label}>
          {label}
          {required ? ' *' : ''}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        onPress={handleOpen}
        testID="date-picker-input-button"
        style={[styles.inputButton, error ? styles.inputButtonError : null]}
      >
        <Text style={[styles.inputText, !value ? styles.placeholderText : null]}>
          {displayValue}
        </Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {Platform.OS === 'ios' ? (
        <Modal
          animationType="slide"
          onRequestClose={handleClose}
          presentationStyle="overFullScreen"
          transparent
          visible={isOpen}
        >
          <Pressable onPress={handleClose} style={styles.backdrop} />
          <View style={styles.sheet}>
            <View style={styles.sheetHeader}>
              <Pressable onPress={handleClear} style={styles.actionButton}>
                <Text style={styles.clearText}>Clear</Text>
              </Pressable>
              <Text style={styles.sheetTitle}>{label || 'Select date'}</Text>
              <View style={styles.trailingActions}>
                <Pressable onPress={handleClose} style={styles.actionButton}>
                  <Text style={styles.secondaryText}>Cancel</Text>
                </Pressable>
                <Pressable onPress={handleConfirm} style={styles.primaryActionButton}>
                  <Text style={styles.primaryText}>Done</Text>
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
              style={styles.spinner}
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

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  label: {
    marginBottom: 4,
    color: '#111827',
    fontSize: 14,
    fontWeight: '600',
  },
  inputButton: {
    borderColor: '#d1d5db',
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputButtonError: {
    borderColor: '#dc2626',
  },
  inputText: {
    color: '#111827',
    fontSize: 16,
  },
  placeholderText: {
    color: '#9ca3af',
  },
  error: {
    color: 'red',
    fontSize: 12,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 32,
    paddingHorizontal: 16,
    paddingTop: 8,
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  sheetHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  sheetTitle: {
    color: '#111827',
    fontSize: 15,
    fontWeight: '600',
  },
  spinner: {
    height: 216,
    width: '100%',
  },
  actionsRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  trailingActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  primaryActionButton: {
    backgroundColor: '#111827',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  clearText: {
    color: '#dc2626',
    fontSize: 14,
    fontWeight: '600',
  },
  secondaryText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  primaryText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
