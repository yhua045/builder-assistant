import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import DatePickerInput from '../../src/components/inputs/DatePickerInput';

describe('DatePickerInput', () => {
  it('opens the picker and calls onChange when a date is confirmed', () => {
    const onChange = jest.fn();
    const selectedDate = new Date('2026-03-12T00:00:00.000Z');

    const screen = render(
      <DatePickerInput label="Start Date" value={null} onChange={onChange} />
    );

    fireEvent.press(screen.getByTestId('date-picker-input-button'));
    fireEvent(screen.getByTestId('date-picker-native'), 'onChange', { type: 'set' }, selectedDate);
    fireEvent.press(screen.getByText('Done'));

    expect(onChange).toHaveBeenCalledWith(selectedDate);
  });

  it('clears an existing date', () => {
    const onChange = jest.fn();

    const screen = render(
      <DatePickerInput
        label="Start Date"
        value={new Date('2026-03-10T00:00:00.000Z')}
        onChange={onChange}
      />
    );

    fireEvent.press(screen.getByTestId('date-picker-input-button'));
    fireEvent.press(screen.getByText('Clear'));

    expect(onChange).toHaveBeenCalledWith(null);
  });
});
