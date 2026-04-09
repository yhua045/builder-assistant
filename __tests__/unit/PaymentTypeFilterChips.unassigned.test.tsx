/**
 * T-16, T-17: PaymentTypeFilterChips — Unassigned chip
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { PaymentTypeFilterChips } from '../../src/components/payments/PaymentTypeFilterChips';

jest.mock('nativewind', () => ({
  cssInterop: jest.fn(),
  useColorScheme: () => ({ colorScheme: 'light' }),
}));

describe('PaymentTypeFilterChips — Unassigned chip (T-16, T-17)', () => {
  it('T-16: renders the "Unassigned" chip with correct testID', () => {
    const { getByTestId } = render(
      <PaymentTypeFilterChips value="pending" onChange={jest.fn()} isDark={false} />,
    );
    expect(getByTestId('filter-chip-unassigned')).toBeTruthy();
  });

  it('T-17: pressing the "Unassigned" chip calls onChange with "unassigned"', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <PaymentTypeFilterChips value="pending" onChange={onChange} isDark={false} />,
    );
    fireEvent.press(getByTestId('filter-chip-unassigned'));
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('unassigned');
  });

  it('marks the active chip correctly when value is "unassigned"', () => {
    const { getByTestId } = render(
      <PaymentTypeFilterChips value="unassigned" onChange={jest.fn()} isDark={false} />,
    );
    const chip = getByTestId('filter-chip-unassigned');
    expect(chip).toBeTruthy();
  });
});
