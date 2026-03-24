import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QuickAddContractorModal } from '../../src/components/inputs/QuickAddContractorModal';
import { Contact } from '../../src/domain/entities/Contact';

const makeContact = (name: string): Contact => ({
  id: `contact_${name}`,
  name,
  usageCount: 0,
});

const defaultProps = {
  visible: true,
  initialName: '',
  onSave: jest.fn(),
  onCancel: jest.fn(),
  onQuickAdd: jest.fn().mockResolvedValue(makeContact('Alice')),
};

describe('QuickAddContractorModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders all required fields', () => {
    let root: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(<QuickAddContractorModal {...defaultProps} />);
    });
    const instance = root!.root;
    expect(instance.findByProps({ testID: 'quick-add-name-input' })).toBeTruthy();
    expect(instance.findByProps({ testID: 'quick-add-trade-input' })).toBeTruthy();
    expect(instance.findByProps({ testID: 'quick-add-license-input' })).toBeTruthy();
    expect(instance.findByProps({ testID: 'quick-add-phone-input' })).toBeTruthy();
    expect(instance.findByProps({ testID: 'quick-add-save-btn' })).toBeTruthy();
    expect(instance.findByProps({ testID: 'quick-add-cancel-btn' })).toBeTruthy();
  });

  it('pre-fills name field with initialName', () => {
    let root: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <QuickAddContractorModal {...defaultProps} initialName="Alice Builder" />,
      );
    });
    const nameInput = root!.root.findByProps({ testID: 'quick-add-name-input' });
    expect(nameInput.props.value).toBe('Alice Builder');
  });

  it('shows name error when saving with empty name', async () => {
    let root: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(<QuickAddContractorModal {...defaultProps} initialName="" />);
    });
    const saveBtn = root!.root.findByProps({ testID: 'quick-add-save-btn' });
    await act(async () => {
      saveBtn.props.onPress();
    });
    const errorEl = root!.root.findByProps({ testID: 'quick-add-name-error' });
    expect(errorEl.props.children).toBeTruthy();
    expect(defaultProps.onQuickAdd).not.toHaveBeenCalled();
  });

  it('calls onQuickAdd with correct fields on save', async () => {
    let root: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <QuickAddContractorModal
          {...defaultProps}
          initialName="Alice"
        />,
      );
    });

    const tradeInput = root!.root.findByProps({ testID: 'quick-add-trade-input' });
    const phoneInput = root!.root.findByProps({ testID: 'quick-add-phone-input' });

    act(() => {
      tradeInput.props.onChangeText('Electrical');
      phoneInput.props.onChangeText('0400111111');
    });

    const saveBtn = root!.root.findByProps({ testID: 'quick-add-save-btn' });
    await act(async () => {
      saveBtn.props.onPress();
    });

    expect(defaultProps.onQuickAdd).toHaveBeenCalledWith({
      name: 'Alice',
      trade: 'Electrical',
      licenseNumber: undefined,
      phone: '0400111111',
    });
    expect(defaultProps.onSave).toHaveBeenCalledWith(makeContact('Alice'));
  });

  it('calls onCancel when Cancel is pressed', () => {
    let root: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(<QuickAddContractorModal {...defaultProps} />);
    });
    const cancelBtn = root!.root.findByProps({ testID: 'quick-add-cancel-btn' });
    act(() => {
      cancelBtn.props.onPress();
    });
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it('does NOT render lookup button when FeatureFlags.externalLookup is false', () => {
    // FeatureFlags.externalLookup defaults to false in the actual module
    let root: renderer.ReactTestRenderer;
    act(() => {
      root = renderer.create(
        <QuickAddContractorModal
          {...defaultProps}
          onLookupByLicense={jest.fn().mockResolvedValue([])}
        />,
      );
    });
    const lookupBtns = root!.root.findAllByProps({ testID: 'quick-add-lookup-btn' });
    expect(lookupBtns).toHaveLength(0);
  });
});
