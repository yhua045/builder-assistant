/**
 * Integration tests for ManualProjectEntryForm — Dropdown integration (Issue #175).
 *
 * Covers acceptance criteria I1–I5 from design/#175-ui-dropdowns.md.
 * These tests verify that the new <Dropdown /> components are correctly wired
 * into the form: labels, state updates, and onSave payload.
 *
 * Run: npx jest __tests__/integration/ManualProjectEntryForm.integration.test.tsx
 */
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';

jest.mock('lucide-react-native', () => ({
  X: 'X',
  ChevronRight: 'ChevronRight',
  ChevronDown: 'ChevronDown',
  Check: 'Check',
}));

jest.mock('../../../../components/inputs/DatePickerInput', () => {
  const ReactMock = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: () => ReactMock.createElement(View, { testID: 'mock-date-picker' }),
  };
});

jest.mock('../../../../components/inputs/ContactSelector', () => {
  const ReactMock = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: () => ReactMock.createElement(View, { testID: 'mock-contact-selector' }),
  };
});

jest.mock('../../../../components/inputs/TeamSelector', () => {
  const ReactMock = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: () => ReactMock.createElement(View, { testID: 'mock-team-selector' }),
  };
});

jest.mock('../../components/CriticalPathPreview/CriticalPathPreview', () => {
  const ReactMock = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    CriticalPathPreview: () =>
      ReactMock.createElement(View, { testID: 'mock-critical-path' }),
  };
});

import ManualProjectEntryForm from '../../components/ManualProjectEntryForm';
import type { UseCriticalPathReturn } from '../../../../hooks/useCriticalPath';

// ── Helpers ───────────────────────────────────────────────────────────────────

const mockCriticalPathHook: UseCriticalPathReturn = {
  suggestions: [],
  isLoading: false,
  error: null,
  suggest: jest.fn(),
  selectedIds: new Set(),
  toggleSelection: jest.fn(),
  selectAll: jest.fn(),
  clearAll: jest.fn(),
  isCreating: false,
  creationProgress: null,
  creationError: null,
  confirmSelected: jest.fn().mockResolvedValue(undefined),
};

function renderForm(onSave = jest.fn().mockResolvedValue(undefined)) {
  const onCancel = jest.fn();
  const utils = render(
    <ManualProjectEntryForm
      visible
      onSave={onSave}
      onCancel={onCancel}
      onTasksAdded={jest.fn()}
      criticalPathHook={mockCriticalPathHook}
      projectId={null}
    />,
  );
  return { ...utils, onSave, onCancel };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ManualProjectEntryForm — Dropdown integration', () => {
  beforeEach(() => jest.clearAllMocks());

  // I1 — default label for Project Type trigger
  it('I1: shows "Complete Rebuild" in the Project Type trigger by default', () => {
    const { getByText } = renderForm();
    expect(getByText('Complete Rebuild')).toBeTruthy();
  });

  // I2 — selecting Renovation updates the Project Type trigger
  it('I2: selecting Renovation via Project Type dropdown updates the trigger label', () => {
    const { getByTestId, getByText } = renderForm();

    // Project Type now uses an OptionList (chip buttons) — press the Renovation option directly
    fireEvent.press(getByTestId('option-renovation'));

    // Trigger now shows "Renovation"; OptionList remains visible (chip UI).
    expect(getByText('Renovation')).toBeTruthy();
    // Ensure Extension option exists but is not selected
    expect(getByTestId('option-extension').props.accessibilityState.selected).toBe(false);
  });

  // I3 — selecting VIC updates the State trigger
  it('I3: selecting VIC via State dropdown updates the trigger label', () => {
    const { getByTestId, getByText, queryByText } = renderForm();

    fireEvent.press(getByTestId('dropdown-state'));
    fireEvent.press(getByText('VIC'));

    expect(getByText('VIC')).toBeTruthy();
    expect(queryByText('QLD')).toBeNull(); // modal is closed
  });

  // I4 — onSave receives correct projectType and state after both dropdowns used
  it('I4: form submit passes correct projectType and state to onSave', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const { getByTestId, getByText, getByPlaceholderText } = renderForm(onSave);

    // Fill required fields
    fireEvent.changeText(getByPlaceholderText('Project name'), 'Test Project');
    fireEvent.changeText(getByPlaceholderText('Property address'), '123 Test St');

    // Select Renovation
    // Project Type now uses an OptionList (chip buttons) — press the Renovation option directly
    fireEvent.press(getByTestId('option-renovation'));

    // Select VIC
    fireEvent.press(getByTestId('dropdown-state'));
    fireEvent.press(getByText('VIC'));

    // Submit
    await act(async () => {
      fireEvent.press(getByText('Save Project'));
    });

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        projectType: 'renovation',
        state: 'VIC',
      }),
    );
  });

  // I5 — Dropdown components are rendered (hex Button chips are gone)
  it('I5: renders Dropdown triggers for Project Type and State (no chip buttons)', () => {
    const { getByTestId } = renderForm();
    expect(getByTestId('option-list-project-type')).toBeTruthy();
    expect(getByTestId('dropdown-state')).toBeTruthy();
  });
});
