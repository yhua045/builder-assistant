/**
 * Unit tests for OptionList component (Issue #179).
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import OptionList from '../../src/components/inputs/OptionList';

const OPTIONS = [
  { label: 'Renovation',  value: 'renovation'  },
  { label: 'Extension',   value: 'extension'   },
  { label: 'Rebuild',     value: 'rebuild'      },
];

describe('OptionList', () => {
  it('renders all option labels as visible chip elements', () => {
    const { getByText } = render(
      <OptionList options={OPTIONS} value={undefined} onChange={jest.fn()} />,
    );
    expect(getByText('Renovation')).toBeTruthy();
    expect(getByText('Extension')).toBeTruthy();
    expect(getByText('Rebuild')).toBeTruthy();
  });

  it('renders the label prop above the chips when provided', () => {
    const { getByText } = render(
      <OptionList label="Project Type" options={OPTIONS} value={undefined} onChange={jest.fn()} />,
    );
    expect(getByText('Project Type')).toBeTruthy();
  });

  it('does not render a label element when the label prop is omitted', () => {
    const { queryByText } = render(
      <OptionList options={OPTIONS} value={undefined} onChange={jest.fn()} />,
    );
    expect(queryByText('Project Type')).toBeNull();
  });

  it('renders an error message below the chips when error prop is set', () => {
    const { getByText } = render(
      <OptionList options={OPTIONS} value={undefined} onChange={jest.fn()} error="Selection required" />,
    );
    expect(getByText('Selection required')).toBeTruthy();
  });

  it('does not render an error element when error is omitted', () => {
    const { queryByText } = render(
      <OptionList options={OPTIONS} value={undefined} onChange={jest.fn()} />,
    );
    expect(queryByText('Selection required')).toBeNull();
  });

  it('marks the chip matching value as selected', () => {
    const { getByTestId } = render(
      <OptionList options={OPTIONS} value="extension" onChange={jest.fn()} />,
    );
    expect(getByTestId('option-extension').props.accessibilityState.selected).toBe(true);
  });

  it('marks all other chips as unselected when one value is set', () => {
    const { getByTestId } = render(
      <OptionList options={OPTIONS} value="extension" onChange={jest.fn()} />,
    );
    expect(getByTestId('option-renovation').props.accessibilityState.selected).toBe(false);
    expect(getByTestId('option-rebuild').props.accessibilityState.selected).toBe(false);
  });

  it('marks all chips unselected when value is undefined', () => {
    const { getByTestId } = render(
      <OptionList options={OPTIONS} value={undefined} onChange={jest.fn()} />,
    );
    OPTIONS.forEach((opt) => {
      expect(getByTestId(`option-${opt.value}`).props.accessibilityState.selected).toBe(false);
    });
  });

  it('calls onChange with the option value when an unselected chip is pressed', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <OptionList options={OPTIONS} value={undefined} onChange={onChange} />,
    );
    fireEvent.press(getByTestId('option-renovation'));
    expect(onChange).toHaveBeenCalledWith('renovation');
  });
});
