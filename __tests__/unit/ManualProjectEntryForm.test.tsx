import React from 'react';
import renderer, { act } from 'react-test-renderer';
import ManualProjectEntryForm from '../../src/components/ManualProjectEntryForm';
import { TextInput, Button } from 'react-native';

describe('ManualProjectEntryForm', () => {
  it('renders form when visible', async () => {
    const onSave = jest.fn();
    const onCancel = jest.fn();

    let testRenderer: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      testRenderer = renderer.create(<ManualProjectEntryForm visible={true} onSave={onSave} onCancel={onCancel} />);
    });

    const tree = testRenderer!.toJSON();
    act(() => {
      testRenderer!.unmount();
    });
    expect(tree).toMatchSnapshot();
  });

  it('does not render when not visible', async () => {
    const onSave = jest.fn();
    const onCancel = jest.fn();

    let testRenderer: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      testRenderer = renderer.create(<ManualProjectEntryForm visible={false} onSave={onSave} onCancel={onCancel} />);
    });

    const tree = testRenderer!.toJSON();
    act(() => {
      testRenderer!.unmount();
    });
    expect(tree).toBeNull();
  });

  it('validates required fields', async () => {
    const onSave = jest.fn();
    const onCancel = jest.fn();

    let testRenderer: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      testRenderer = renderer.create(<ManualProjectEntryForm visible={true} onSave={onSave} onCancel={onCancel} />);
    });

    const root = testRenderer!.root;

    // Find save button and verify it's disabled initially (no name/address)
    const buttons = root.findAllByType(Button);
    const saveButton = buttons.find(b => b.props.title === 'Save');
    expect(saveButton?.props.disabled).toBe(true);
  });

  it('calls onCancel when cancel button pressed', async () => {
    const onSave = jest.fn();
    const onCancel = jest.fn();

    let testRenderer: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      testRenderer = renderer.create(<ManualProjectEntryForm visible={true} onSave={onSave} onCancel={onCancel} />);
    });

    const root = testRenderer!.root;

    const buttons = root.findAllByType(Button);
    const cancelButton = buttons.find(b => b.props.title === 'Cancel');

    act(() => {
      cancelButton?.props.onPress();
    });

    expect(onCancel).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });
});
