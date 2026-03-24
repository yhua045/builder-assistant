/**
 * Unit tests for ManualProjectEntryForm — projectType and state pickers.
 * Phase 1 (RED): These tests verify the new fields added in Issue #169.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';

jest.mock('../../src/infrastructure/di/registerServices', () => ({}));

jest.mock('../../src/hooks/useContacts', () => ({
  __esModule: true,
  default: () => ({ contacts: [], loading: false, search: jest.fn(), refresh: jest.fn() }),
  useContacts: () => ({ contacts: [], loading: false, search: jest.fn(), refresh: jest.fn() }),
}));

jest.mock('../../src/components/inputs/ContactSelector', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function ContactSelector() { return React.createElement(View, { testID: 'contact-selector' }); };
});

jest.mock('../../src/components/inputs/TeamSelector', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function TeamSelector() { return React.createElement(View, { testID: 'team-selector' }); };
});

jest.mock('../../src/components/inputs/DatePickerInput', () => {
  const React = require('react');
  const { View } = require('react-native');
  return function DatePickerInput() { return React.createElement(View, { testID: 'date-picker' }); };
});

import ManualProjectEntryForm from '../../src/components/ManualProjectEntryForm';

// ── Helpers ───────────────────────────────────────────────────────────────────

function fillRequiredFields(root: renderer.ReactTestInstance) {
  const nameInput = root.findByProps({ placeholder: 'Project name' });
  act(() => { nameInput.props.onChangeText('My Project'); });

  const addressInput = root.findByProps({ placeholder: 'Property address' });
  act(() => { addressInput.props.onChangeText('123 Main St'); });
}

function tapSave(root: renderer.ReactTestInstance) {
  const saveButton = root.findByProps({ title: 'Save' });
  act(() => { saveButton.props.onPress(); });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ManualProjectEntryForm — projectType picker', () => {
  it('renders project type buttons for all 3 project types', () => {
    const onSave = jest.fn();
    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <ManualProjectEntryForm visible={true} onSave={onSave} onCancel={jest.fn()} criticalPathHook={{ criticalPath: [], isLoading: false, error: null, hasConflicts: false } as any} />,
      );
    });
    const root = tree!.root;

    const completeRebuildBtn = root.findByProps({ testID: 'project-type-complete_rebuild' });
    const extensionBtn = root.findByProps({ testID: 'project-type-extension' });
    const renovationBtn = root.findByProps({ testID: 'project-type-renovation' });

    expect(completeRebuildBtn).toBeTruthy();
    expect(extensionBtn).toBeTruthy();
    expect(renovationBtn).toBeTruthy();
  });

  it('submitting without selecting projectType uses default complete_rebuild', () => {
    const onSave = jest.fn();
    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <ManualProjectEntryForm visible={true} onSave={onSave} onCancel={jest.fn()} criticalPathHook={{ criticalPath: [], isLoading: false, error: null, hasConflicts: false } as any} />,
      );
    });
    const root = tree!.root;

    fillRequiredFields(root);
    tapSave(root);

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ projectType: 'complete_rebuild' }),
    );
  });

  it('selecting extension and submitting passes projectType: extension', () => {
    const onSave = jest.fn();
    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <ManualProjectEntryForm visible={true} onSave={onSave} onCancel={jest.fn()} criticalPathHook={{ criticalPath: [], isLoading: false, error: null, hasConflicts: false } as any} />,
      );
    });
    const root = tree!.root;

    const extensionBtn = root.findByProps({ testID: 'project-type-extension' });
    act(() => { extensionBtn.props.onPress(); });

    fillRequiredFields(root);
    tapSave(root);

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ projectType: 'extension' }),
    );
  });

  it('selecting renovation and submitting passes projectType: renovation', () => {
    const onSave = jest.fn();
    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <ManualProjectEntryForm visible={true} onSave={onSave} onCancel={jest.fn()} criticalPathHook={{ criticalPath: [], isLoading: false, error: null, hasConflicts: false } as any} />,
      );
    });
    const root = tree!.root;

    const renovationBtn = root.findByProps({ testID: 'project-type-renovation' });
    act(() => { renovationBtn.props.onPress(); });

    fillRequiredFields(root);
    tapSave(root);

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ projectType: 'renovation' }),
    );
  });

  it('selecting NSW state and submitting passes state: NSW', () => {
    const onSave = jest.fn();
    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <ManualProjectEntryForm visible={true} onSave={onSave} onCancel={jest.fn()} criticalPathHook={{ criticalPath: [], isLoading: false, error: null, hasConflicts: false } as any} />,
      );
    });
    const root = tree!.root;

    const nswBtn = root.findByProps({ testID: 'state-NSW' });
    act(() => { nswBtn.props.onPress(); });

    fillRequiredFields(root);
    tapSave(root);

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'NSW' }),
    );
  });
});
