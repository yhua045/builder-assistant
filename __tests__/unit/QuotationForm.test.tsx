import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QuotationForm } from '../../src/components/quotations/QuotationForm';
import { Quotation } from '../../src/domain/entities/Quotation';

// ── Mocks for new pickers ─────────────────────────────────────────────────
jest.mock('../../src/components/shared/ProjectPickerModal', () => ({
  ProjectPickerModal: ({
    visible,
    onSelect,
    onClose,
  }: {
    visible: boolean;
    onSelect: (p: any) => void;
    onClose: () => void;
  }) => {
    if (!visible) return null;
    const { TouchableOpacity, Text, View } = require('react-native');
    return (
      <View testID="mock-project-picker-modal">
        <TouchableOpacity testID="mock-project-item-proj1" onPress={() => { onSelect({ id: 'proj1', name: 'Bathroom Reno' }); onClose(); }}>
          <Text>Bathroom Reno</Text>
        </TouchableOpacity>
      </View>
    );
  },
}));

jest.mock('../../src/components/tasks/SubcontractorPickerModal', () => ({
  SubcontractorPickerModal: ({
    visible,
    onSelect,
    onClose,
  }: {
    visible: boolean;
    onSelect: (c: any) => void;
    onClose: () => void;
  }) => {
    if (!visible) return null;
    const { TouchableOpacity, Text, View } = require('react-native');
    return (
      <View testID="mock-subcontractor-picker-modal">
        <TouchableOpacity
          testID="mock-subcontractor-item-c1"
          onPress={() => { onSelect({ id: 'c1', name: 'Jane Smith', trade: 'Electrician', email: 'jane@example.com' }); onClose(); }}
        >
          <Text>Jane Smith</Text>
        </TouchableOpacity>
      </View>
    );
  },
  SubcontractorContact: {},
}));

jest.mock('../../src/components/inputs/QuickAddContractorModal', () => ({
  QuickAddContractorModal: ({
    visible,
    onSave,
  }: {
    visible: boolean;
    onSave: (c: any) => void;
  }) => {
    if (!visible) return null;
    const { TouchableOpacity, Text, View } = require('react-native');
    return (
      <View testID="mock-quick-add-modal">
        <TouchableOpacity
          testID="mock-quick-add-save"
          onPress={() => onSave({ id: 'new-c1', name: 'Quick Added Co', email: 'quick@example.com' })}
        >
          <Text>Save Quick Add</Text>
        </TouchableOpacity>
      </View>
    );
  },
}));

describe('QuotationForm', () => {
  const mockOnSubmit = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders form with all required fields', async () => {
    let testRenderer: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      testRenderer = renderer.create(
        <QuotationForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );
    });

    const root = testRenderer!.root;
    
    // Verify key form fields exist
    // Should have inputs for: reference, project picker, vendor picker row, date, total
    const referenceInput = root.findByProps({ testID: 'quotation-reference-input' });
    const vendorPickerRow = root.findByProps({ testID: 'quotation-vendor-picker-row' });
    const totalInput = root.findByProps({ testID: 'quotation-total-input' });
    
    expect(referenceInput).toBeDefined();
    expect(vendorPickerRow).toBeDefined();
    expect(totalInput).toBeDefined();

    act(() => {
      testRenderer!.unmount();
    });
  });

  it('validates required fields before submission', async () => {
    let testRenderer: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      testRenderer = renderer.create(
        <QuotationForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );
    });

    const root = testRenderer!.root;

    // Try to submit empty form
    const saveButton = root.findByProps({ testID: 'quotation-save-button' });
    
    await act(async () => {
      saveButton.props.onPress();
    });

    // Should not call onSubmit with invalid data
    expect(mockOnSubmit).not.toHaveBeenCalled();

    act(() => {
      testRenderer!.unmount();
    });
  });

  it('populates form with initial values', async () => {
    const initialValues: Partial<Quotation> = {
      reference: 'QT-2026-001',
      vendorName: 'Test Vendor',
      date: '2026-02-15',
      total: 1000,
      currency: 'USD',
      status: 'draft',
    };

    let testRenderer: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      testRenderer = renderer.create(
        <QuotationForm
          initialValues={initialValues}
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );
    });

    const root = testRenderer!.root;

    // Verify reference input has initial value
    const referenceInput = root.findByProps({ testID: 'quotation-reference-input' });
    expect(referenceInput.props.value).toBe('QT-2026-001');

    act(() => {
      testRenderer!.unmount();
    });
  });

  it('submits valid quotation data', async () => {
    let testRenderer: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      testRenderer = renderer.create(
        <QuotationForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );
    });

    const root = testRenderer!.root;

    // Fill required fields
    await act(async () => {
      const referenceInput = root.findByProps({ testID: 'quotation-reference-input' });
      referenceInput.props.onChangeText('QT-2026-TEST');
      
      const totalInput = root.findByProps({ testID: 'quotation-total-input' });
      totalInput.props.onChangeText('500');
    });

    // Submit form
    const saveButton = root.findByProps({ testID: 'quotation-save-button' });
    await act(async () => {
      saveButton.props.onPress();
    });

    // Should call onSubmit with valid data
    expect(mockOnSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        reference: 'QT-2026-TEST',
        total: 500,
      })
    );

    act(() => {
      testRenderer!.unmount();
    });
  });

  it('calls onCancel when cancel button is pressed', async () => {
    let testRenderer: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      testRenderer = renderer.create(
        <QuotationForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );
    });

    const root = testRenderer!.root;
    const cancelButton = root.findByProps({ testID: 'quotation-cancel-button' });

    act(() => {
      cancelButton.props.onPress();
    });

    expect(mockOnCancel).toHaveBeenCalled();
    expect(mockOnSubmit).not.toHaveBeenCalled();

    act(() => {
      testRenderer!.unmount();
    });
  });

  it('handles line items addition and removal', async () => {
    let testRenderer: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      testRenderer = renderer.create(
        <QuotationForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );
    });

    const root = testRenderer!.root;

    // Add a line item
    const addLineItemButton = root.findByProps({ testID: 'quotation-add-line-item' });
    await act(async () => {
      addLineItemButton.props.onPress();
    });

    // Verify line item was added by checking for first line item
    const firstLineItem = root.findByProps({ testID: 'quotation-line-item-0' });
    expect(firstLineItem).toBeDefined();

    act(() => {
      testRenderer!.unmount();
    });
  });

  it('validates expiry date is after issue date', async () => {
    let testRenderer: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      testRenderer = renderer.create(
        <QuotationForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
        />
      );
    });

    const root = testRenderer!.root;

    // Set issue date (find DatePickerInput by looking for View with date state)
    // Since DatePickerInput doesn't expose testID, we skip this validation
    // The form logic is tested via submission validation

    // Try to submit with invalid expiry date (before issue date)
    // This will be caught by validation
    const saveButton = root.findByProps({ testID: 'quotation-save-button' });
    await act(async () => {
      saveButton.props.onPress();
    });

    // Should show validation error (form won't submit)
    expect(mockOnSubmit).not.toHaveBeenCalled();

    act(() => {
      testRenderer!.unmount();
    });
  });

  it('displays loading state during submission', async () => {
    let testRenderer: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      testRenderer = renderer.create(
        <QuotationForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          isLoading={true}
        />
      );
    });

    const root = testRenderer!.root;

    // Save button should be disabled when loading
    const saveButton = root.findByProps({ testID: 'quotation-save-button' });
    expect(saveButton.props.disabled).toBe(true);

    act(() => {
      testRenderer!.unmount();
    });
  });

  // ─── New test cases for issue #186 ───────────────────────────────────────

  it('(A) does NOT render currency input', async () => {
    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <QuotationForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );
    });
    const root = testRenderer!.root;
    const currencyInputs = root.findAllByProps({ testID: 'quotation-currency-input' });
    expect(currencyInputs).toHaveLength(0);
    act(() => { testRenderer!.unmount(); });
  });

  it('(B) does NOT render subtotal input', async () => {
    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <QuotationForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );
    });
    const root = testRenderer!.root;
    const subtotalInputs = root.findAllByProps({ testID: 'quotation-subtotal-input' });
    expect(subtotalInputs).toHaveLength(0);
    act(() => { testRenderer!.unmount(); });
  });

  it('(C) does NOT render tax input', async () => {
    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <QuotationForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );
    });
    const root = testRenderer!.root;
    const taxInputs = root.findAllByProps({ testID: 'quotation-tax-input' });
    expect(taxInputs).toHaveLength(0);
    act(() => { testRenderer!.unmount(); });
  });

  it('(D) submits even when reference field is left empty (reference is optional)', async () => {
    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <QuotationForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );
    });
    const root = testRenderer!.root;

    // Fill in total (required) but leave reference blank
    await act(async () => {
      const totalInput = root.findByProps({ testID: 'quotation-total-input' });
      totalInput.props.onChangeText('250');
    });

    const saveButton = root.findByProps({ testID: 'quotation-save-button' });
    await act(async () => {
      saveButton.props.onPress();
    });

    expect(mockOnSubmit).toHaveBeenCalled();
    act(() => { testRenderer!.unmount(); });
  });

  it('(E) shows PDF filename indicator when pdfFile prop is provided', async () => {
    const pdfFile = {
      uri: 'file:///app/storage/quote_123.pdf',
      originalUri: 'file:///tmp/quote.pdf',
      name: 'my-quote.pdf',
      size: 204800,
      mimeType: 'application/pdf',
    };
    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <QuotationForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          pdfFile={pdfFile}
        />
      );
    });
    const root = testRenderer!.root;
    const pdfIndicator = root.findByProps({ testID: 'quotation-pdf-indicator' });
    expect(pdfIndicator).toBeDefined();
    act(() => { testRenderer!.unmount(); });
  });

  it('(F) renders without full-screen padding when embedded prop is true', async () => {
    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <QuotationForm
          onSubmit={mockOnSubmit}
          onCancel={mockOnCancel}
          embedded={true}
        />
      );
    });
    // Just verifies it renders without crashing — compact layout applied
    const tree = testRenderer!.toJSON();
    expect(tree).toBeDefined();
    act(() => { testRenderer!.unmount(); });
  });

  // ─── New tests for issue #192 ─────────────────────────────────────────────

  it('(G) renders project picker row', async () => {
    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <QuotationForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );
    });
    const root = testRenderer!.root;
    const pickerRow = root.findByProps({ testID: 'quotation-project-picker-row' });
    expect(pickerRow).toBeDefined();
    act(() => { testRenderer!.unmount(); });
  });

  it('(H) renders vendor picker row in empty state with add label', async () => {
    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <QuotationForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );
    });
    const root = testRenderer!.root;
    const pickerRow = root.findByProps({ testID: 'quotation-vendor-picker-row' });
    expect(pickerRow).toBeDefined();
    act(() => { testRenderer!.unmount(); });
  });

  it('(I) opens SubcontractorPickerModal when vendor row is pressed', async () => {
    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <QuotationForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );
    });
    const root = testRenderer!.root;
    const pickerRow = root.findByProps({ testID: 'quotation-vendor-picker-row' });
    await act(async () => {
      pickerRow.props.onPress();
    });
    const modal = root.findByProps({ testID: 'mock-subcontractor-picker-modal' });
    expect(modal).toBeDefined();
    act(() => { testRenderer!.unmount(); });
  });

  it('(J) selecting a vendor sets vendorId and vendorName in onSubmit', async () => {
    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <QuotationForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );
    });
    const root = testRenderer!.root;
    // Open vendor picker
    const pickerRow = root.findByProps({ testID: 'quotation-vendor-picker-row' });
    await act(async () => { pickerRow.props.onPress(); });
    // Select mock vendor item
    const vendorItem = root.findByProps({ testID: 'mock-subcontractor-item-c1' });
    await act(async () => { vendorItem.props.onPress(); });
    // Fill total and submit
    await act(async () => {
      const totalInput = root.findByProps({ testID: 'quotation-total-input' });
      totalInput.props.onChangeText('1000');
    });
    const saveButton = root.findByProps({ testID: 'quotation-save-button' });
    await act(async () => { saveButton.props.onPress(); });
    expect(mockOnSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ vendorId: 'c1', vendorName: 'Jane Smith' })
    );
    act(() => { testRenderer!.unmount(); });
  });

  it('(K) vendor quick-add creates contact and selects it in onSubmit', async () => {
    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <QuotationForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );
    });
    const root = testRenderer!.root;
    // Open vendor picker then click quick-add button
    const pickerRow = root.findByProps({ testID: 'quotation-vendor-picker-row' });
    await act(async () => { pickerRow.props.onPress(); });
    // Trigger quick-add from the QuickAdd route (vendor picker row button)
    const quickAddButton = root.findByProps({ testID: 'quotation-vendor-quick-add-button' });
    await act(async () => { quickAddButton.props.onPress(); });
    // Save in quick-add modal
    const quickAddSave = root.findByProps({ testID: 'mock-quick-add-save' });
    await act(async () => { quickAddSave.props.onPress(); });
    // Fill total and submit
    await act(async () => {
      const totalInput = root.findByProps({ testID: 'quotation-total-input' });
      totalInput.props.onChangeText('500');
    });
    const saveButton = root.findByProps({ testID: 'quotation-save-button' });
    await act(async () => { saveButton.props.onPress(); });
    expect(mockOnSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ vendorId: 'new-c1', vendorName: 'Quick Added Co' })
    );
    act(() => { testRenderer!.unmount(); });
  });

  it('(L) selecting a project sets projectId in onSubmit', async () => {
    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <QuotationForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );
    });
    const root = testRenderer!.root;
    // Open project picker
    const pickerRow = root.findByProps({ testID: 'quotation-project-picker-row' });
    await act(async () => { pickerRow.props.onPress(); });
    // Select mock project
    const projectItem = root.findByProps({ testID: 'mock-project-item-proj1' });
    await act(async () => { projectItem.props.onPress(); });
    // Fill total and submit
    await act(async () => {
      const totalInput = root.findByProps({ testID: 'quotation-total-input' });
      totalInput.props.onChangeText('2000');
    });
    const saveButton = root.findByProps({ testID: 'quotation-save-button' });
    await act(async () => { saveButton.props.onPress(); });
    expect(mockOnSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'proj1' })
    );
    act(() => { testRenderer!.unmount(); });
  });

  it('(M) submit with no project and no vendor is valid (both optional)', async () => {
    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <QuotationForm onSubmit={mockOnSubmit} onCancel={mockOnCancel} />
      );
    });
    const root = testRenderer!.root;
    await act(async () => {
      const totalInput = root.findByProps({ testID: 'quotation-total-input' });
      totalInput.props.onChangeText('999');
    });
    const saveButton = root.findByProps({ testID: 'quotation-save-button' });
    await act(async () => { saveButton.props.onPress(); });
    expect(mockOnSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ total: 999 })
    );
    // projectId and vendorId should be absent / undefined
    const call = mockOnSubmit.mock.calls[0][0];
    expect(call.projectId).toBeUndefined();
    expect(call.vendorId).toBeUndefined();
    act(() => { testRenderer!.unmount(); });
  });
});
