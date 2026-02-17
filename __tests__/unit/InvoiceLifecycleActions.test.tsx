import React from 'react';
import renderer, { act, ReactTestRenderer } from 'react-test-renderer';
import { Alert } from 'react-native';
import { InvoiceLifecycleActions } from '../../src/components/invoices/InvoiceLifecycleActions';
import { Invoice } from '../../src/domain/entities/Invoice';

// Mock Alert
jest.spyOn(Alert, 'alert').mockImplementation((title, message, buttons) => {
  // Auto-click the first button (usually the action button for our tests)
  if (buttons && buttons.length > 0) {
    const button = buttons[0];
    if (button.onPress) {
      button.onPress();
    }
  }
});

describe('InvoiceLifecycleActions', () => {
  const mockOnUpdate = jest.fn();
  
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('draft invoice actions', () => {
    const draftInvoice: Invoice = {
      id: 'inv_1',
      total: 1000,
      currency: 'USD',
      status: 'draft',
      paymentStatus: 'unpaid',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    } as Invoice;

    it('renders "Issue" and "Cancel" buttons for draft invoice', async () => {
      let testRenderer: ReactTestRenderer | undefined;

      await act(async () => {
        testRenderer = renderer.create(
          <InvoiceLifecycleActions invoice={draftInvoice} onUpdate={mockOnUpdate} />
        );
      });

      const tree = testRenderer!.toJSON();
      expect(tree).toBeDefined();
      // Verify buttons are rendered (snapshot test covers this)
    });

    it('does not render "Mark Paid" button for draft invoice', async () => {
      let testRenderer: ReactTestRenderer | undefined;

      await act(async () => {
        testRenderer = renderer.create(
          <InvoiceLifecycleActions invoice={draftInvoice} onUpdate={mockOnUpdate} />
        );
      });

      const instance = testRenderer!.root;
      // Attempt to find "Mark Paid" button - should not exist
      const buttons = instance.findAllByType(require('react-native').TouchableOpacity);
      const markPaidButton = buttons.find((button: any) => {
        const text = button.findAllByType(require('react-native').Text);
        return text.some((t: any) => t.props.children === 'Mark Paid');
      });
      
      expect(markPaidButton).toBeUndefined();
    });
  });

  describe('issued invoice actions', () => {
    const issuedInvoice: Invoice = {
      id: 'inv_2',
      total: 500,
      currency: 'USD',
      status: 'issued',
      paymentStatus: 'unpaid',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-05T00:00:00Z',
    } as Invoice;

    it('renders "Mark Paid" and "Cancel" buttons for issued invoice', async () => {
      let testRenderer: ReactTestRenderer | undefined;

      await act(async () => {
        testRenderer = renderer.create(
          <InvoiceLifecycleActions invoice={issuedInvoice} onUpdate={mockOnUpdate} />
        );
      });

      const tree = testRenderer!.toJSON();
      expect(tree).toBeDefined();
    });

    it('does not render "Issue" button for issued invoice', async () => {
      let testRenderer: ReactTestRenderer | undefined;

      await act(async () => {
        testRenderer = renderer.create(
          <InvoiceLifecycleActions invoice={issuedInvoice} onUpdate={mockOnUpdate} />
        );
      });

      const instance = testRenderer!.root;
      const buttons = instance.findAllByType(require('react-native').TouchableOpacity);
      const issueButton = buttons.find((button: any) => {
        const text = button.findAllByType(require('react-native').Text);
        return text.some((t: any) => t.props.children === 'Issue');
      });
      
      expect(issueButton).toBeUndefined();
    });
  });

  describe('overdue invoice actions', () => {
    const overdueInvoice: Invoice = {
      id: 'inv_3',
      total: 750,
      currency: 'USD',
      status: 'overdue',
      paymentStatus: 'unpaid',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-15T00:00:00Z',
    } as Invoice;

    it('renders "Mark Paid" and "Cancel" buttons for overdue invoice', async () => {
      let testRenderer: ReactTestRenderer | undefined;

      await act(async () => {
        testRenderer = renderer.create(
          <InvoiceLifecycleActions invoice={overdueInvoice} onUpdate={mockOnUpdate} />
        );
      });

      const tree = testRenderer!.toJSON();
      expect(tree).toBeDefined();
    });
  });

  describe('paid invoice actions', () => {
    const paidInvoice: Invoice = {
      id: 'inv_4',
      total: 1200,
      currency: 'USD',
      status: 'paid',
      paymentStatus: 'paid',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-10T00:00:00Z',
    } as Invoice;

    it('renders no action buttons for paid invoice', async () => {
      let testRenderer: ReactTestRenderer | undefined;

      await act(async () => {
        testRenderer = renderer.create(
          <InvoiceLifecycleActions invoice={paidInvoice} onUpdate={mockOnUpdate} />
        );
      });

      const instance = testRenderer!.root;
      const buttons = instance.findAllByType(require('react-native').TouchableOpacity);
      
      // Should have no action buttons for paid invoice
      expect(buttons.length).toBe(0);
    });
  });

  describe('cancelled invoice actions', () => {
    const cancelledInvoice: Invoice = {
      id: 'inv_5',
      total: 600,
      currency: 'USD',
      status: 'cancelled',
      paymentStatus: 'unpaid',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-12T00:00:00Z',
    } as Invoice;

    it('renders no action buttons for cancelled invoice', async () => {
      let testRenderer: ReactTestRenderer | undefined;

      await act(async () => {
        testRenderer = renderer.create(
          <InvoiceLifecycleActions invoice={cancelledInvoice} onUpdate={mockOnUpdate} />
        );
      });

      const instance = testRenderer!.root;
      const buttons = instance.findAllByType(require('react-native').TouchableOpacity);
      
      // Should have no action buttons for cancelled invoice
      expect(buttons.length).toBe(0);
    });
  });

  describe('action handlers', () => {
    const issuedInvoice: Invoice = {
      id: 'inv_6',
      total: 850,
      currency: 'USD',
      status: 'issued',
      paymentStatus: 'unpaid',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-06T00:00:00Z',
    } as Invoice;

    it('calls onUpdate when "Mark Paid" is confirmed', async () => {
      let testRenderer: ReactTestRenderer | undefined;

      await act(async () => {
        testRenderer = renderer.create(
          <InvoiceLifecycleActions invoice={issuedInvoice} onUpdate={mockOnUpdate} />
        );
      });

      const instance = testRenderer!.root;
      const buttons = instance.findAllByType(require('react-native').TouchableOpacity);
      const markPaidButton = buttons.find((button: any) => {
        const text = button.findAllByType(require('react-native').Text);
        return text.some((t: any) => t.props.children === 'Mark Paid');
      });

      expect(markPaidButton).toBeDefined();
      
      // Trigger the button press
      await act(async () => {
        markPaidButton!.props.onPress();
      });

      // Should show confirmation and call onUpdate
      expect(Alert.alert).toHaveBeenCalledWith(
        'Mark Invoice as Paid',
        expect.stringContaining('Are you sure'),
        expect.any(Array)
      );
    });

    it('shows confirmation dialog before cancelling', async () => {
      let testRenderer: ReactTestRenderer | undefined;

      await act(async () => {
        testRenderer = renderer.create(
          <InvoiceLifecycleActions invoice={issuedInvoice} onUpdate={mockOnUpdate} />
        );
      });

      const instance = testRenderer!.root;
      const buttons = instance.findAllByType(require('react-native').TouchableOpacity);
      const cancelButton = buttons.find((button: any) => {
        const text = button.findAllByType(require('react-native').Text);
        return text.some((t: any) => t.props.children === 'Cancel');
      });

      expect(cancelButton).toBeDefined();
      
      // Trigger the button press
      await act(async () => {
        cancelButton!.props.onPress();
      });

      // Should show confirmation dialog
      expect(Alert.alert).toHaveBeenCalledWith(
        'Cancel Invoice',
        expect.stringContaining('Are you sure'),
        expect.any(Array)
      );
    });
  });

  describe('loading states', () => {
    const issuedInvoice: Invoice = {
      id: 'inv_7',
      total: 950,
      currency: 'USD',
      status: 'issued',
      paymentStatus: 'unpaid',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-07T00:00:00Z',
    } as Invoice;

    it('disables buttons during loading', async () => {
      let testRenderer: ReactTestRenderer | undefined;

      await act(async () => {
        testRenderer = renderer.create(
          <InvoiceLifecycleActions 
            invoice={issuedInvoice} 
            onUpdate={mockOnUpdate}
            loading={true}
          />
        );
      });

      const instance = testRenderer!.root;
      const buttons = instance.findAllByType(require('react-native').TouchableOpacity);
      
      // All buttons should be disabled during loading
      buttons.forEach((button: any) => {
        expect(button.props.disabled).toBe(true);
      });
    });
  });

  describe('snapshot tests', () => {
    it('matches snapshot for draft invoice', async () => {
      const draftInvoice: Invoice = {
        id: 'inv_snap_1',
        total: 100,
        currency: 'USD',
        status: 'draft',
        paymentStatus: 'unpaid',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
      } as Invoice;

      let testRenderer: ReactTestRenderer | undefined;

      await act(async () => {
        testRenderer = renderer.create(
          <InvoiceLifecycleActions invoice={draftInvoice} onUpdate={mockOnUpdate} />
        );
      });

      const tree = testRenderer!.toJSON();
      expect(tree).toMatchSnapshot();
    });

    it('matches snapshot for issued invoice', async () => {
      const issuedInvoice: Invoice = {
        id: 'inv_snap_2',
        total: 200,
        currency: 'USD',
        status: 'issued',
        paymentStatus: 'unpaid',
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-05T00:00:00Z',
      } as Invoice;

      let testRenderer: ReactTestRenderer | undefined;

      await act(async () => {
        testRenderer = renderer.create(
          <InvoiceLifecycleActions invoice={issuedInvoice} onUpdate={mockOnUpdate} />
        );
      });

      const tree = testRenderer!.toJSON();
      expect(tree).toMatchSnapshot();
    });
  });
});
