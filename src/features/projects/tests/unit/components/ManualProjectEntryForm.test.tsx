/**
 * Unit tests for ManualProjectEntryForm — projectType and state pickers.
 * Phase 1 (RED): These tests verify the new fields added in Issue #169.
 */

import React from 'react';
import renderer, { act } from 'react-test-renderer';

jest.mock('../../../../../infrastructure/di/registerServices', () => ({}));

jest.mock('../../../../../hooks/useContacts', () => ({
  __esModule: true,
  default: () => ({ contacts: [], loading: false, search: jest.fn(), refresh: jest.fn() }),
  useContacts: () => ({ contacts: [], loading: false, search: jest.fn(), refresh: jest.fn() }),
}));

jest.mock('../../../../../components/inputs/ContactSelector', () => { return function ContactSelector() { const { View } = require('react-native'); const React = require('react'); return <View testID="contact-selector" />; }; });

jest.mock('../../../../../components/inputs/TeamSelector', () => { return function TeamSelector() { const { View } = require('react-native'); const React = require('react'); return <View testID="team-selector" />; }; });

jest.mock('../../../../../components/inputs/DatePickerInput', () => { return function DatePickerInput() { const { View } = require('react-native'); const React = require('react'); return <View testID="date-picker" />; }; });

jest.mock('../../../components/CriticalPathPreview/CriticalPathPreview', () => { return { CriticalPathPreview: function CriticalPathPreview() { const { View } = require('react-native'); const React = require('react'); return <View testID="critical-path-preview" />; } }; });

import ManualProjectEntryForm from '../../../components/ManualProjectEntryForm';
import type { UseCriticalPathReturn } from '../../../../../hooks/useCriticalPath';

// ── Helpers ───────────────────────────────────────────────────────────────────

function createMockCriticalPathHook(): UseCriticalPathReturn {
  return {
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
    confirmSelected: jest.fn(),
  };
}

function fillRequiredFields(root: renderer.ReactTestInstance) {
  const nameInput = root.findByProps({ placeholder: 'Project name' });
  act(() => { nameInput.props.onChangeText('My Project'); });

  const addressInput = root.findByProps({ placeholder: 'Property address' });
  act(() => { addressInput.props.onChangeText('123 Main St'); });
}

function tapSave(root: renderer.ReactTestInstance) {
  const { Text } = require('react-native');
  const allTexts = root.findAllByType(Text);
  const saveText = allTexts.find((node) => node.props.children === 'Save Project');
  if (saveText) {
    let node = saveText;
    while (node && !node.props.onPress) {
      if (!node.parent) break;
      node = node.parent;
    }
    act(() => { node.props.onPress(); });
  } else {
    // fallback if somehow Button with title="Save" is there
    const saveButton = root.findByProps({ title: 'Save' });
    act(() => { saveButton.props.onPress(); });
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ManualProjectEntryForm — projectType picker', () => {
  it('renders project type buttons for all 3 project types', () => {
    const onSave = jest.fn();
    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <ManualProjectEntryForm 
          visible={true} 
          onSave={onSave} 
          onCancel={jest.fn()}
          criticalPathHook={createMockCriticalPathHook()}
        />,
      );
    });
    const root = tree!.root;

    const completeRebuildBtn = root.findByProps({ testID: 'option-complete_rebuild' });
    const extensionBtn = root.findByProps({ testID: 'option-extension' });
    const renovationBtn = root.findByProps({ testID: 'option-renovation' });

    expect(completeRebuildBtn).toBeTruthy();
    expect(extensionBtn).toBeTruthy();
    expect(renovationBtn).toBeTruthy();
  });

  it('submitting without selecting projectType uses default complete_rebuild', () => {
    const onSave = jest.fn();
    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <ManualProjectEntryForm 
          visible={true} 
          onSave={onSave} 
          onCancel={jest.fn()}
          criticalPathHook={createMockCriticalPathHook()}
        />,
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
        <ManualProjectEntryForm 
          visible={true} 
          onSave={onSave} 
          onCancel={jest.fn()}
          criticalPathHook={createMockCriticalPathHook()}
        />,
      );
    });
    const root = tree!.root;

    const extensionBtn = root.findByProps({ testID: 'option-extension' });
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
        <ManualProjectEntryForm 
          visible={true} 
          onSave={onSave} 
          onCancel={jest.fn()}
          criticalPathHook={createMockCriticalPathHook()}
        />,
      );
    });
    const root = tree!.root;

    const renovationBtn = root.findByProps({ testID: 'option-renovation' });
    act(() => { renovationBtn.props.onPress(); });

    fillRequiredFields(root);
    tapSave(root);

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ projectType: 'renovation' }),
    );
  });

  it('state defaults to NSW and submitting passes state: NSW', () => {
    const onSave = jest.fn();
    let tree: renderer.ReactTestRenderer;
    act(() => {
      tree = renderer.create(
        <ManualProjectEntryForm 
          visible={true} 
          onSave={onSave} 
          onCancel={jest.fn()}
          criticalPathHook={createMockCriticalPathHook()}
        />,
      );
    });
    const root = tree!.root;

    const stateTrigger = root.findByProps({ testID: 'dropdown-state' });
    expect(stateTrigger).toBeTruthy();

    fillRequiredFields(root);
    tapSave(root);

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ state: 'NSW' }),
    );
  });
});
