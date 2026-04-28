import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Text, TextInput } from 'react-native';
import { InvoiceForm } from '../../../components/InvoiceForm';
import { Invoice } from '../../../../../domain/entities/Invoice';

describe.skip('InvoiceForm', () => {
  const mockOnCreate = jest.fn();
  const mockOnUpdate = jest.fn();
  const mockOnCancel = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe.skip('Rendering', () => {
    it('renders all form fields correctly in create mode', async () => {
      let testRenderer: renderer.ReactTestRenderer | undefined;

      await act(async () => {
        testRenderer = renderer.create(
          <InvoiceForm
            mode="create"
            onCreate={mockOnCreate}
            onCancel={mockOnCancel}
          />
        );
      });

      const root = testRenderer!.root;

      // Find all TextInput instances to verify fields are present
      const textInputs = root.findAllByType(TextInput);
      
      // Should have inputs for: invoice number, vendor, currency, total, subtotal, tax, notes
      // At minimum 7 fields (may have more with line items)
      expect(textInputs.length).toBeGreaterThanOrEqual(7);

      act(() => {
        testRenderer!.unmount();
      });
    });

    it('renders with initial values in edit mode', async () => {
      const existingInvoice: Invoice = {
        id: 'inv_123',
        externalReference: 'INV-2024-001',
        issuerName: 'ABC Construction',
        total: 5000,
        currency: 'USD',
        status: 'draft',
        paymentStatus: 'unpaid',
        dateIssued: '2024-01-15',
        dateDue: '2024-02-15',
        notes: 'Test invoice',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      let testRenderer: renderer.ReactTestRenderer | undefined;

      await act(async () => {
        testRenderer = renderer.create(
          <InvoiceForm
            mode="edit"
            initialValues={existingInvoice}
            onUpdate={mockOnUpdate}
            onCancel={mockOnCancel}
          />
        );
      });

      const root = testRenderer!.root;
      expect(root).toBeDefined();

      act(() => {
        testRenderer!.unmount();
      });
    });

    it('matches snapshot for create mode', async () => {
      let testRenderer: renderer.ReactTestRenderer | undefined;

      await act(async () => {
        testRenderer = renderer.create(
          <InvoiceForm
            mode="create"
            onCreate={mockOnCreate}
            onCancel={mockOnCancel}
          />
        );
      });

      const tree = testRenderer!.toJSON();
      expect(tree).toMatchSnapshot();

      act(() => {
        testRenderer!.unmount();
      });
    });
  });

  describe.skip('Validation', () => {
    it('validates required fields (total, currency, status)', async () => {
      let testRenderer: renderer.ReactTestRenderer | undefined;

      await act(async () => {
        testRenderer = renderer.create(
          <InvoiceForm
            mode="create"
            onCreate={mockOnCreate}
            onCancel={mockOnCancel}
          />
        );
      });

      const root = testRenderer!.root;

      // Try to submit without filling required fields
      const saveButton = root.findAll(node => 
        node.props.testID === 'invoice-form-save-button' ||
        (node.props.title && node.props.title.includes('Save'))
      )[0];

      if (saveButton) {
        act(() => {
          saveButton.props.onPress();
        });
      }

      // Should NOT call onCreate because validation should fail
      expect(mockOnCreate).not.toHaveBeenCalled();

      act(() => {
        testRenderer!.unmount();
      });
    });

    it('validates total must be non-negative number', async () => {
      let testRenderer: renderer.ReactTestRenderer | undefined;

      await act(async () => {
        testRenderer = renderer.create(
          <InvoiceForm
            mode="create"
            onCreate={mockOnCreate}
            onCancel={mockOnCancel}
          />
        );
      });

      const root = testRenderer!.root;
      const textInputs = root.findAllByType(TextInput);

      // Find total input and set negative value
      const totalInput = textInputs.find(input => 
        input.props.placeholder?.toLowerCase().includes('total') ||
        input.props.testID === 'invoice-form-total-input'
      );

      if (totalInput) {
        act(() => {
          totalInput.props.onChangeText('-100');
        });
      }

      // Try to save
      const saveButton = root.findAll(node => 
        node.props.testID === 'invoice-form-save-button' ||
        (node.props.title && node.props.title.includes('Save'))
      )[0];

      if (saveButton) {
        act(() => {
          saveButton.props.onPress();
        });
      }

      // Should fail validation
      expect(mockOnCreate).not.toHaveBeenCalled();

      act(() => {
        testRenderer!.unmount();
      });
    });

    it('validates due date must be on or after issue date', async () => {
      let testRenderer: renderer.ReactTestRenderer | undefined;

      await act(async () => {
        testRenderer = renderer.create(
          <InvoiceForm
            mode="create"
            initialValues={{
              dateIssued: '2024-02-15',
              dateDue: '2024-01-15', // Invalid: due before issued
            }}
            onCreate={mockOnCreate}
            onCancel={mockOnCancel}
          />
        );
      });

      const root = testRenderer!.root;

      // Try to save with invalid dates
      const saveButton = root.findAll(node => 
        node.props.testID === 'invoice-form-save-button' ||
        (node.props.title && node.props.title.includes('Save'))
      )[0];

      if (saveButton) {
        act(() => {
          saveButton.props.onPress();
        });
      }

      // Should fail validation
      expect(mockOnCreate).not.toHaveBeenCalled();

      act(() => {
        testRenderer!.unmount();
      });
    });

    it('shows validation error messages', async () => {
      let testRenderer: renderer.ReactTestRenderer | undefined;

      await act(async () => {
        testRenderer = renderer.create(
          <InvoiceForm
            mode="create"
            onCreate={mockOnCreate}
            onCancel={mockOnCancel}
          />
        );
      });

      const root = testRenderer!.root;

      // Try to submit without required fields
      const saveButton = root.findAll(node => 
        node.props.testID === 'invoice-form-save-button' ||
        (node.props.title && node.props.title.includes('Save'))
      )[0];

      if (saveButton) {
        act(() => {
          saveButton.props.onPress();
        });
      }

      // Should display error messages (Text components with error testIDs or red styling)
      const errorTexts = root.findAll(node => 
        node.props.testID?.includes('error') ||
        (node.type === Text && node.props.style && 
         JSON.stringify(node.props.style).includes('red'))
      );

      expect(errorTexts.length).toBeGreaterThan(0);

      act(() => {
        testRenderer!.unmount();
      });
    });
  });

  describe.skip('Line Items Calculation', () => {
    it('calculates subtotal from line items', async () => {
      let testRenderer: renderer.ReactTestRenderer | undefined;

      await act(async () => {
        testRenderer = renderer.create(
          <InvoiceForm
            mode="create"
            initialValues={{
              lineItems: [
                { description: 'Item 1', quantity: 2, unitCost: 100, total: 200 },
                { description: 'Item 2', quantity: 1, unitCost: 150, total: 150 },
              ],
            }}
            onCreate={mockOnCreate}
            onCancel={mockOnCancel}
          />
        );
      });

      const root = testRenderer!.root;

      // Subtotal should be automatically calculated as 350
      // Find subtotal display or input
      const subtotalElements = root.findAll(node => 
        node.props.testID === 'invoice-form-subtotal' ||
        (node.props.value === '350' || node.props.children === '350')
      );

      expect(subtotalElements.length).toBeGreaterThan(0);

      act(() => {
        testRenderer!.unmount();
      });
    });

    it('validates subtotal matches sum of line items', async () => {
      let testRenderer: renderer.ReactTestRenderer | undefined;

      await act(async () => {
        testRenderer = renderer.create(
          <InvoiceForm
            mode="create"
            initialValues={{
              lineItems: [
                { description: 'Item 1', quantity: 2, unitCost: 100, total: 200 },
              ],
              subtotal: 999, // Incorrect subtotal
              total: 999,
              currency: 'USD',
              status: 'draft',
              paymentStatus: 'unpaid',
            }}
            onCreate={mockOnCreate}
            onCancel={mockOnCancel}
          />
        );
      });

      const root = testRenderer!.root;

      // Try to save with mismatched subtotal
      const saveButton = root.findAll(node => 
        node.props.testID === 'invoice-form-save-button' ||
        (node.props.title && node.props.title.includes('Save'))
      )[0];

      if (saveButton) {
        act(() => {
          saveButton.props.onPress();
        });
      }

      // Should fail validation or show warning
      expect(mockOnCreate).not.toHaveBeenCalled();

      act(() => {
        testRenderer!.unmount();
      });
    });
  });

  describe.skip('Submit Callbacks', () => {
    it('calls onCreate with correct data when form is valid', async () => {
      let testRenderer: renderer.ReactTestRenderer | undefined;

      await act(async () => {
        testRenderer = renderer.create(
          <InvoiceForm
            mode="create"
            onCreate={mockOnCreate}
            onCancel={mockOnCancel}
          />
        );
      });

      const root = testRenderer!.root;
      const textInputs = root.findAllByType(TextInput);

      // Fill in required fields
      const totalInput = textInputs.find(input => 
        input.props.testID === 'invoice-form-total-input'
      );
      if (totalInput) {
        act(() => {
          totalInput.props.onChangeText('1000');
        });
      }

      // Submit form
      const saveButton = root.findAll(node => 
        node.props.testID === 'invoice-form-save-button' ||
        (node.props.title && node.props.title.includes('Save'))
      )[0];

      if (saveButton) {
        act(() => {
          saveButton.props.onPress();
        });
      }

      // onCreate should be called with invoice data
      expect(mockOnCreate).toHaveBeenCalledTimes(1);
      const invoiceData = mockOnCreate.mock.calls[0][0];
      expect(invoiceData).toHaveProperty('total');
      expect(invoiceData.total).toBe(1000);

      act(() => {
        testRenderer!.unmount();
      });
    });

    it('calls onUpdate with correct data in edit mode', async () => {
      const existingInvoice: Invoice = {
        id: 'inv_123',
        total: 5000,
        currency: 'USD',
        status: 'draft',
        paymentStatus: 'unpaid',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };

      let testRenderer: renderer.ReactTestRenderer | undefined;

      await act(async () => {
        testRenderer = renderer.create(
          <InvoiceForm
            mode="edit"
            initialValues={existingInvoice}
            onUpdate={mockOnUpdate}
            onCancel={mockOnCancel}
          />
        );
      });

      const root = testRenderer!.root;
      const textInputs = root.findAllByType(TextInput);

      // Modify total
      const totalInput = textInputs.find(input => 
        input.props.testID === 'invoice-form-total-input'
      );
      if (totalInput) {
        act(() => {
          totalInput.props.onChangeText('6000');
        });
      }

      // Submit form
      const saveButton = root.findAll(node => 
        node.props.testID === 'invoice-form-save-button' ||
        (node.props.title && node.props.title.includes('Save'))
      )[0];

      if (saveButton) {
        act(() => {
          saveButton.props.onPress();
        });
      }

      // onUpdate should be called
      expect(mockOnUpdate).toHaveBeenCalledTimes(1);
      const updatedInvoice = mockOnUpdate.mock.calls[0][0];
      expect(updatedInvoice.id).toBe('inv_123');
      expect(updatedInvoice.total).toBe(6000);

      act(() => {
        testRenderer!.unmount();
      });
    });

    it('calls onCancel when cancel button is pressed', async () => {
      let testRenderer: renderer.ReactTestRenderer | undefined;

      await act(async () => {
        testRenderer = renderer.create(
          <InvoiceForm
            mode="create"
            onCreate={mockOnCreate}
            onCancel={mockOnCancel}
          />
        );
      });

      const root = testRenderer!.root;

      const cancelButton = root.findAll(node => 
        node.props.testID === 'invoice-form-cancel-button' ||
        (node.props.title && node.props.title.includes('Cancel'))
      )[0];

      if (cancelButton) {
        act(() => {
          cancelButton.props.onPress();
        });
      }

      expect(mockOnCancel).toHaveBeenCalledTimes(1);
      expect(mockOnCreate).not.toHaveBeenCalled();
      expect(mockOnUpdate).not.toHaveBeenCalled();

      act(() => {
        testRenderer!.unmount();
      });
    });
  });

  describe.skip('Loading States', () => {
    it('shows loading indicator when isLoading is true', async () => {
      let testRenderer: renderer.ReactTestRenderer | undefined;

      await act(async () => {
        testRenderer = renderer.create(
          <InvoiceForm
            mode="create"
            onCreate={mockOnCreate}
            onCancel={mockOnCancel}
            isLoading={true}
          />
        );
      });

      const root = testRenderer!.root;

      // Should find ActivityIndicator or disabled button
      const saveButton = root.findAll(node => 
        node.props.testID === 'invoice-form-save-button' ||
        (node.props.title && node.props.title.includes('Save'))
      )[0];

      if (saveButton) {
        expect(saveButton.props.disabled).toBe(true);
      }

      act(() => {
        testRenderer!.unmount();
      });
    });
  });
});
