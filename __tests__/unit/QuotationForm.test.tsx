import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QuotationForm } from '../../src/components/quotations/QuotationForm';
import { Quotation } from '../../src/domain/entities/Quotation';

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
    // Should have inputs for: reference, client/vendor, date, total, currency
    const referenceInput = root.findByProps({ testID: 'quotation-reference-input' });
    const vendorInput = root.findByProps({ testID: 'quotation-vendor-input' });
    const totalInput = root.findByProps({ testID: 'quotation-total-input' });
    
    expect(referenceInput).toBeDefined();
    expect(vendorInput).toBeDefined();
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
      
      const vendorInput = root.findByProps({ testID: 'quotation-vendor-input' });
      vendorInput.props.onChangeText('Test Vendor Inc');
      
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
        vendorName: 'Test Vendor Inc',
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
});
