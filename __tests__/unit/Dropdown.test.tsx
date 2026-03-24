/**
 * Unit tests for the Dropdown component (Issue #175).
 *
 * Covers acceptance criteria U1–U10 from design/#175-ui-dropdowns.md.
 *
 * Run: npx jest __tests__/unit/Dropdown.test.tsx
 */
import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import Dropdown from '../../src/components/inputs/Dropdown';

jest.mock('lucide-react-native', () => ({
  ChevronDown: 'ChevronDown',
  Check: 'Check',
}));

// ── Shared fixture ────────────────────────────────────────────────────────────

const OPTIONS = [
  { label: 'Option One', value: 'one' },
  { label: 'Option Two', value: 'two' },
  { label: 'Option Three', value: 'three' },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Dropdown', () => {
  // U1 — placeholder when no value
  it('shows placeholder text when value is undefined', () => {
    const { getByText } = render(
      <Dropdown
        options={OPTIONS}
        value={undefined}
        onChange={jest.fn()}
        placeholder="Pick one"
      />,
    );
    expect(getByText('Pick one')).toBeTruthy();
  });

  // U2 — selected label when value is set
  it('shows the matching option label when value is set', () => {
    const { getByText } = render(
      <Dropdown options={OPTIONS} value="two" onChange={jest.fn()} />,
    );
    expect(getByText('Option Two')).toBeTruthy();
  });

  // U3 — pressing trigger opens modal
  it('pressing the trigger opens the options modal', () => {
    const { getByTestId, getByText } = render(
      <Dropdown
        options={OPTIONS}
        value={undefined}
        onChange={jest.fn()}
        testID="trigger"
      />,
    );
    fireEvent.press(getByTestId('trigger'));
    // Options are only rendered when the modal is open
    expect(getByText('Option One')).toBeTruthy();
    expect(getByText('Option Two')).toBeTruthy();
  });

  // U4 — selecting an option calls onChange with the correct value
  it('pressing an option calls onChange with the correct value', () => {
    const onChange = jest.fn();
    const { getByTestId, getByText } = render(
      <Dropdown
        options={OPTIONS}
        value={undefined}
        onChange={onChange}
        testID="trigger"
      />,
    );
    fireEvent.press(getByTestId('trigger'));
    fireEvent.press(getByText('Option Two'));
    expect(onChange).toHaveBeenCalledWith('two');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  // U5 — selecting an option closes the modal
  it('pressing an option closes the modal', () => {
    const { getByTestId, getByText, queryByText } = render(
      <Dropdown
        options={OPTIONS}
        value={undefined}
        onChange={jest.fn()}
        testID="trigger"
      />,
    );
    fireEvent.press(getByTestId('trigger'));
    expect(getByText('Option Three')).toBeTruthy(); // modal is open

    fireEvent.press(getByText('Option One'));
    // 'Option Three' was only inside the modal FlatList — now modal is closed
    expect(queryByText('Option Three')).toBeNull();
  });

  // U6 — selected option row shows a checkmark indicator
  it('the selected option row shows a checkmark', () => {
    const { getByTestId, queryByTestId } = render(
      <Dropdown options={OPTIONS} value="two" onChange={jest.fn()} testID="trigger" />,
    );
    fireEvent.press(getByTestId('trigger'));
    expect(getByTestId('check-two')).toBeTruthy();
    expect(queryByTestId('check-one')).toBeNull();
    expect(queryByTestId('check-three')).toBeNull();
  });

  // U7 — pressing Done closes the modal without calling onChange
  it('pressing Done closes the modal without calling onChange', () => {
    const onChange = jest.fn();
    const { getByTestId, getByText, queryByText } = render(
      <Dropdown
        options={OPTIONS}
        value={undefined}
        onChange={onChange}
        testID="trigger"
      />,
    );
    fireEvent.press(getByTestId('trigger'));
    expect(getByText('Option One')).toBeTruthy(); // modal is open

    fireEvent.press(getByText('Done'));
    expect(onChange).not.toHaveBeenCalled();
    expect(queryByText('Option One')).toBeNull(); // modal is closed
  });

  // U7b — pressing the backdrop closes the modal without calling onChange
  it('pressing the backdrop closes the modal without calling onChange', () => {
    const onChange = jest.fn();
    const { getByTestId, queryByText } = render(
      <Dropdown
        options={OPTIONS}
        value={undefined}
        onChange={onChange}
        testID="trigger"
      />,
    );
    fireEvent.press(getByTestId('trigger'));
    fireEvent.press(getByTestId('dropdown-backdrop'));
    expect(onChange).not.toHaveBeenCalled();
    expect(queryByText('Option One')).toBeNull();
  });

  // U8 — error text rendered below the trigger
  it('renders error text below the trigger when error prop is set', () => {
    const { getByText } = render(
      <Dropdown
        options={OPTIONS}
        value={undefined}
        onChange={jest.fn()}
        error="This field is required"
      />,
    );
    expect(getByText('This field is required')).toBeTruthy();
  });

  // U9 — disabled prop prevents modal from opening
  it('disabled prop prevents the modal from opening', () => {
    const { getByTestId, queryByText } = render(
      <Dropdown
        options={OPTIONS}
        value={undefined}
        onChange={jest.fn()}
        testID="trigger"
        disabled
      />,
    );
    fireEvent.press(getByTestId('trigger'));
    expect(queryByText('Option One')).toBeNull();
  });

  // U10 — testID forwarded to trigger
  it('testID prop is forwarded to the trigger Pressable', () => {
    const { getByTestId } = render(
      <Dropdown
        options={OPTIONS}
        value={undefined}
        onChange={jest.fn()}
        testID="dropdown-project-type"
      />,
    );
    expect(getByTestId('dropdown-project-type')).toBeTruthy();
  });
});
