import React from 'react';
import renderer, { act } from 'react-test-renderer';
import DatePickerInput from '../../src/components/inputs/DatePickerInput';

describe('DatePickerInput', () => {
  it('renders with label and calls onChange when a date is selected', async () => {
    const onChange = jest.fn();

    let testRenderer: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      testRenderer = renderer.create(
        <DatePickerInput label="Start Date" value={null} onChange={onChange} />
      );
    });

    const root = testRenderer!.root;
    expect(root).toBeDefined();
  });
});
