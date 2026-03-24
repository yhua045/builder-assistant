/**
 * Unit tests for AddProgressLogModal (Issue #133).
 *
 * Run: npx jest __tests__/unit/AddProgressLogModal.test.tsx
 */
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { AddProgressLogModal } from '../../src/components/tasks/AddProgressLogModal';

// ── Stubs ──────────────────────────────────────────────────────────────────────

jest.mock('nativewind', () => ({
  cssInterop: jest.fn(),
  useColorScheme: () => ({ colorScheme: 'light' }),
}));

jest.mock('lucide-react-native', () => ({
  X: 'X',
  Camera: 'Camera',
  Trash2: 'Trash2',
  ChevronDown: 'ChevronDown',
  Check: 'Check',
}));

jest.mock('react-native-image-picker', () => ({
  launchImageLibrary: jest.fn().mockResolvedValue({ assets: [] }),
}));

// ─────────────────────────────────────────────────────────────────────────────

describe('AddProgressLogModal — create mode', () => {
  const baseProps = {
    visible: true,
    onSubmit: jest.fn(),
    onClose: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders without crashing', () => {
    const { getByText } = render(<AddProgressLogModal {...baseProps} />);
    expect(getByText('Add Progress Log')).toBeTruthy();
  });

  it('submit button is disabled when no logType selected', () => {
    const { getByLabelText } = render(<AddProgressLogModal {...baseProps} />);
    const btn = getByLabelText('Add Log');
    fireEvent.press(btn);
    expect(baseProps.onSubmit).not.toHaveBeenCalled();
  });

  it('submit button is enabled after logType selected', async () => {
    const { getByLabelText, getByTestId, getByText } = render(<AddProgressLogModal {...baseProps} />);
    // Open Dropdown and select — each fireEvent wraps its own act flush
    fireEvent.press(getByTestId('log-type-dropdown'));
    fireEvent.press(getByText('Inspection'));
    fireEvent.press(getByLabelText('Add Log'));
    expect(baseProps.onSubmit).toHaveBeenCalledTimes(1);
  });

  it('onSubmit called with correct data including notes and actor', async () => {
    const { getByLabelText, getByPlaceholderText, getByTestId, getByText } = render(
      <AddProgressLogModal {...baseProps} />,
    );
    // Open Dropdown and select
    fireEvent.press(getByTestId('log-type-dropdown'));
    fireEvent.press(getByText('Inspection'));
    // Fill text fields
    fireEvent.changeText(getByPlaceholderText('Add any details here…'), 'Foundation checked');
    fireEvent.changeText(getByPlaceholderText('e.g. Mike Johnson'), 'Mike');
    fireEvent.press(getByLabelText('Add Log'));
    expect(baseProps.onSubmit).toHaveBeenCalledWith({
      logType: 'inspection',
      notes: 'Foundation checked',
      actor: 'Mike',
      photos: undefined,
    });
  });

  it('onClose called when × is pressed', () => {
    const { getByLabelText } = render(<AddProgressLogModal {...baseProps} />);
    fireEvent.press(getByLabelText('Close modal'));
    expect(baseProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('form state resets after modal is closed and reopened', async () => {
    const { getByPlaceholderText, getByTestId, getByText, rerender } = render(
      <AddProgressLogModal {...baseProps} />,
    );
    // Open Dropdown and select
    fireEvent.press(getByTestId('log-type-dropdown'));
    fireEvent.press(getByText('Delay'));
    fireEvent.changeText(getByPlaceholderText('Add any details here…'), 'some notes');
    // Close
    rerender(<AddProgressLogModal {...baseProps} visible={false} />);
    // Reopen
    rerender(<AddProgressLogModal {...baseProps} visible={true} />);
    // Notes should be empty again
    expect(getByPlaceholderText('Add any details here…').props.value).toBe('');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('AddProgressLogModal — edit mode', () => {
  const editProps = {
    visible: true,
    initialValues: {
      id: 'log-1',
      logType: 'inspection' as const,
      notes: 'Old notes',
      actor: 'Bob',
      photos: undefined,
    },
    onSubmit: jest.fn(),
    onClose: jest.fn(),
  };

  beforeEach(() => jest.clearAllMocks());

  it('title shows "Edit Progress Log"', () => {
    const { getByText } = render(<AddProgressLogModal {...editProps} />);
    expect(getByText('Edit Progress Log')).toBeTruthy();
  });

  it('form is pre-populated from initialValues', () => {
    const { getByPlaceholderText } = render(<AddProgressLogModal {...editProps} />);
    expect(getByPlaceholderText('Add any details here…').props.value).toBe('Old notes');
    expect(getByPlaceholderText('e.g. Mike Johnson').props.value).toBe('Bob');
  });

  it('onSubmit called with updated data on save', async () => {
    const { getByLabelText, getByPlaceholderText } = render(
      <AddProgressLogModal {...editProps} />,
    );
    await act(async () => {
      fireEvent.changeText(getByPlaceholderText('Add any details here…'), 'Updated notes');
    });
    fireEvent.press(getByLabelText('Save Changes'));
    expect(editProps.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ logType: 'inspection', notes: 'Updated notes', actor: 'Bob' }),
    );
  });
});
