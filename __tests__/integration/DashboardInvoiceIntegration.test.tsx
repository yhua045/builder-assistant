/**
 * Integration test for Dashboard Invoice Creation Flow
 * Tests the complete user journey from dashboard → quick action → create invoice
 */

import React from 'react';
import renderer, { act, type ReactTestInstance } from 'react-test-renderer';
import DashboardScreen from '../../src/pages/dashboard';
import { useInvoices } from '../../src/hooks/useInvoices';

// Mock dependencies
jest.mock('../../src/hooks/useInvoices');
jest.mock('../../src/hooks/useProjects');
jest.mock('../../src/hooks/usePayments');

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => children,
}));

jest.mock('lucide-react-native', () => ({
  DollarSign: 'DollarSign',
  Plus: 'Plus',
  Camera: 'Camera',
  FileText: 'FileText',
  Wrench: 'Wrench',
  Receipt: 'Receipt',
  X: 'X',
  ChevronRight: 'ChevronRight',
  AlertCircle: 'AlertCircle',
  Calendar: 'Calendar',
  Clock: 'Clock',
  Home: 'Home',
}));

jest.mock('nativewind', () => ({
  cssInterop: jest.fn(),
  useColorScheme: () => ({ colorScheme: 'light' }),
}));

jest.mock('../../src/components/ThemeToggle', () => ({
  ThemeToggle: () => 'ThemeToggle',
}));

jest.mock('../../src/pages/receipts/SnapReceiptScreen', () => {
  const MockSnapReceipt = (_props: any) => null;

  return {
    SnapReceiptScreen: (props: any) => <MockSnapReceipt {...props} />,
  };
});

jest.mock('../../src/components/invoices/InvoiceForm', () => {
  const MockInvoiceForm = (_props: any) => null;

  return {
    __esModule: true,
    default: ({ mode, onCreate, onCancel }: any) => (
      <MockInvoiceForm
        testID="invoice-form-in-modal"
        mode={mode}
        onCreate={onCreate}
        onCancel={onCancel}
      />
    ),
  };
});

// Mock the dashboard components to simplify testing
jest.mock('../../src/pages/dashboard/components/HeroSection', () => {
  const MockHeroSection = () => null;

  return {
    __esModule: true,
    default: MockHeroSection,
  };
});

jest.mock('../../src/pages/dashboard/components/CashOutflow', () => {
  const MockCashOutflow = () => null;

  return {
    __esModule: true,
    default: MockCashOutflow,
  };
});

jest.mock('../../src/pages/dashboard/components/ActiveTasks', () => {
  const MockActiveTasks = () => null;

  return {
    __esModule: true,
    default: MockActiveTasks,
  };
});

jest.mock('../../src/pages/dashboard/components/UrgentAlerts', () => {
  const MockUrgentAlerts = () => null;

  return {
    __esModule: true,
    default: MockUrgentAlerts,
  };
});

const mockUseInvoices = useInvoices as jest.MockedFunction<typeof useInvoices>;

describe('Dashboard Invoice Integration', () => {
  const defaultInvoiceHookReturn = {
    invoices: [],
    loading: false,
    error: null,
    createInvoice: jest.fn().mockResolvedValue({ success: true }),
    updateInvoice: jest.fn(),
    deleteInvoice: jest.fn(),
    getInvoiceById: jest.fn(),
    refreshInvoices: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseInvoices.mockReturnValue(defaultInvoiceHookReturn);
  });

  it('completes full invoice creation flow from dashboard', async () => {
    let tree: any;
    
    // 1. Render dashboard
    act(() => {
      tree = renderer.create(<DashboardScreen />);
    });
    const root = tree.root;

    // 2. Find and click the FAB (floating action button)
    const fab = root.findAll((node: ReactTestInstance) => 
      node.props.onPress && 
      node.props.className && 
      node.props.className.includes('bg-primary') &&
      node.props.className.includes('rounded-full')
    );
    
    expect(fab.length).toBeGreaterThan(0);

    act(() => {
      fab[0].props.onPress();
    });

    // 3. Quick Actions modal should be visible
    const quickActionsTitle = root.findAllByProps({ children: 'Quick Actions' });
    expect(quickActionsTitle.length).toBeGreaterThan(0);

    // 4. Find and click "Add Invoice" action
    const addInvoiceAction = root.findAll((node: ReactTestInstance) =>
      node.props.children === 'Add Invoice'
    );

    expect(addInvoiceAction.length).toBeGreaterThan(0);
    
    // Find the pressable parent of the "Add Invoice" text
    let addInvoiceButton = addInvoiceAction[0];
    while (addInvoiceButton && !addInvoiceButton.props.onPress) {
      addInvoiceButton = addInvoiceButton.parent;
    }

    await act(async () => {
      addInvoiceButton.props.onPress();
    });

    // 5. Invoice modal should be visible
    const invoiceModal = root.findAllByProps({ testID: 'add-invoice-modal' });
    expect(invoiceModal.length).toBeGreaterThan(0);
    expect(invoiceModal[0].props.visible).toBe(true);

    // 6. Invoice form should be present with correct mode
    const invoiceForm = root.findAllByProps({ testID: 'invoice-form-in-modal' });
    expect(invoiceForm.length).toBeGreaterThan(0);
    expect(invoiceForm[0].props.mode).toBe('create');

    // 7. Submit the form
    await act(async () => {
      invoiceForm[0].props.onCreate({
        vendor: 'Test Vendor',
        total: 1000,
        currency: 'USD',
        status: 'draft',
        paymentStatus: 'unpaid',
      });
      await new Promise<void>(resolve => setTimeout(() => resolve(), 10));
    });

    // 8. Verify createInvoice was called
    expect(defaultInvoiceHookReturn.createInvoice).toHaveBeenCalledWith({
      vendor: 'Test Vendor',
      total: 1000,
      currency: 'USD',
      status: 'draft',
      paymentStatus: 'unpaid',
    });

    // 9. Modal should close after successful creation
    const modalsAfterCreate = root.findAllByProps({ testID: 'add-invoice-modal' });
    expect(modalsAfterCreate[0].props.visible).toBe(false);
  });

  it('shows Add Invoice in quick actions menu', () => {
    let tree: any;
    
    act(() => {
      tree = renderer.create(<DashboardScreen />);
    });
    const root = tree.root;

    // Click FAB to open quick actions
    const fab = root.findAll((node: ReactTestInstance) => 
      node.props.onPress && 
      node.props.className && 
      node.props.className.includes('bg-primary') &&
      node.props.className.includes('rounded-full')
    );

    act(() => {
      fab[0].props.onPress();
    });

    // Verify "Add Invoice" is in the quick actions
    const addInvoiceText = root.findAll((node: ReactTestInstance) => 
      node.props.children === 'Add Invoice'
    );

    expect(addInvoiceText.length).toBeGreaterThan(0);
  });

  it('cancels invoice creation when cancel button pressed', async () => {
    let tree: any;
    
    act(() => {
      tree = renderer.create(<DashboardScreen />);
    });
    const root = tree.root;

    // Open quick actions and click "Add Invoice"
    const fab = root.findAll((node: ReactTestInstance) => 
      node.props.onPress && 
      node.props.className && 
      node.props.className.includes('bg-primary') &&
      node.props.className.includes('rounded-full')
    );

    act(() => {
      fab[0].props.onPress();
    });

    const addInvoiceAction = root.findAll((node: ReactTestInstance) =>
      node.props.children === 'Add Invoice'
    );
    
    let addInvoiceButton = addInvoiceAction[0];
    while (addInvoiceButton && !addInvoiceButton.props.onPress) {
      addInvoiceButton = addInvoiceButton.parent;
    }

    await act(async () => {
      addInvoiceButton.props.onPress();
    });

    // Find and click cancel on form
    const invoiceForm = root.findByProps({ testID: 'invoice-form-in-modal' });

    await act(async () => {
      invoiceForm.props.onCancel();
    });

    // Modal should close
    const modalsAfterCancel = root.findAllByProps({ testID: 'add-invoice-modal' });
    expect(modalsAfterCancel[0].props.visible).toBe(false);

    // createInvoice should not have been called
    expect(defaultInvoiceHookReturn.createInvoice).not.toHaveBeenCalled();
  });

  it('handles invoice creation error gracefully', async () => {
    const createInvoice = jest.fn().mockResolvedValue({ 
      success: false, 
      error: 'Database error' 
    });
    
    mockUseInvoices.mockReturnValue({
      ...defaultInvoiceHookReturn,
      createInvoice,
    });

    let tree: any;
    
    act(() => {
      tree = renderer.create(<DashboardScreen />);
    });
    const root = tree.root;

    // Navigate to invoice form
    const fab = root.findAll((node: ReactTestInstance) => 
      node.props.onPress && 
      node.props.className && 
      node.props.className.includes('bg-primary') &&
      node.props.className.includes('rounded-full')
    );

    act(() => {
      fab[0].props.onPress();
    });

    const addInvoiceAction = root.findAll((node: ReactTestInstance) =>
      node.props.children === 'Add Invoice'
    );
    
    let addInvoiceButton = addInvoiceAction[0];
    while (addInvoiceButton && !addInvoiceButton.props.onPress) {
      addInvoiceButton = addInvoiceButton.parent;
    }

    await act(async () => {
      addInvoiceButton.props.onPress();
    });

    const invoiceForm = root.findByProps({ testID: 'invoice-form-in-modal' });

    // Submit form
    await act(async () => {
      invoiceForm.props.onCreate({
        vendor: 'Test Vendor',
        total: 1000,
        currency: 'USD',
      });
      await new Promise<void>(resolve => setTimeout(() => resolve(), 10));
    });

    // createInvoice was called
    expect(createInvoice).toHaveBeenCalled();

    // Modal should stay open on error
    const modalsAfterError = root.findAllByProps({ testID: 'add-invoice-modal' });
    expect(modalsAfterError[0].props.visible).toBe(true);
  });
});
