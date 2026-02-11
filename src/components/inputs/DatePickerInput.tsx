import React from 'react';
import { View, Text, TextInput } from 'react-native';

interface Props {
  label: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
  minDate?: Date;
  maxDate?: Date;
  required?: boolean;
  error?: string;
}

const DatePickerInput: React.FC<Props> = ({ label, value, onChange, error }) => {
  const display = value ? value.toISOString().slice(0, 10) : '';

  return (
    <View>
      <Text>{label}</Text>
      <TextInput
        value={display}
        onChangeText={(text) => onChange(text ? new Date(text) : null)}
        placeholder="YYYY-MM-DD"
      />
      {error ? <Text style={{ color: 'red' }}>{error}</Text> : null}
    </View>
  );
};

export default DatePickerInput;
