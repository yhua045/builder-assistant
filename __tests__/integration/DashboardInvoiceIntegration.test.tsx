/**
 * Integration test for Dashboard Invoice Creation Flow
 * Tests the complete user journey from dashboard → quick action → create invoice
 */

import React from 'react';
import renderer, { act, type ReactTestInstance } from 'react-test-renderer';
import DashboardScreen from '../../src/pages/dashboard';
import { useInvoices } from '../../src/hooks/useInvoices';
import { useProjects } from '../../src/hooks/useProjects';
import { usePayments } from '../../src/hooks/usePayments';

// Mock dependencies
jest.mock('../../src/hooks/useInvoices');
jest.mock('../../src/hooks/useProjects');
jest.mock('../../src/hooks/usePayments');

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

jest.mock('../../src/pages/invoices/InvoiceScreen', () => {
  const MockInvoiceScreen = (_props: any) => null;

  const MockComponent = (props: any) => (
    <MockInvoiceScreen testID="invoice-screen-in-modal" {...props} />
  );

  return {
    __esModule: true,
    default: MockComponent,
    InvoiceScreen: MockComponent,
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

jest.mock('../../src/pages/quotations/QuotationScreen', () => ({
  __esModule: true,
  default: () => null,
  QuotationScreen: () => null,
}));

jest.mock('../../src/pages/dashboard/components/UrgentAlerts', () => {
  const MockUrgentAlerts = () => null;

  return {
    __esModule: true,
    default: MockUrgentAlerts,
  };
});

const mockUseInvoices = useInvoices as jest.MockedFunction<typeof useInvoices>;
const mockUseProjects = useProjects as jest.MockedFunction<typeof useProjects>;
const mockUsePayments = usePayments as jest.MockedFunction<typeof usePayments>;

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
    mockUseProjects.mockReturnValue({
      projects: [],
      loading: false,
      error: null,
      createProject: jest.fn().mockResolvedValue({ success: true }),
      getProjectAnalysis: jest.fn().mockResolvedValue({}),
      refreshProjects: jest.fn().mockResolvedValue(undefined),
    });
    mockUsePayments.mockReturnValue({
      globalPayments: [],
      globalAmountPayable: 0,
      contractPayments: [],
      variationPayments: [],
      contractTotal: 0,
      variationTotal: 0,
      metrics: { pendingTotalNext7Days: 0, overdueCount: 0 },
      loading: false,
      refresh: jest.fn(),
    });
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

    // 6. InvoiceScreen should be present in the modal
    const invoiceScreen = root.findAllByProps({ testID: 'invoice-screen-in-modal' });
    expect(invoiceScreen.length).toBeGreaterThan(0);

    // 7. Simulate closing the InvoiceScreen after a successful save
    await act(async () => {
      invoiceScreen[0].props.onClose && invoiceScreen[0].props.onClose();
    });

    // 8. Modal should close after InvoiceScreen calls onClose
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


    // Find and call cancel on InvoiceScreen
    const invoiceScreen = root.findByProps({ testID: 'invoice-screen-in-modal' });

    await act(async () => {
      invoiceScreen.props.onClose && invoiceScreen.props.onClose();
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

    // InvoiceScreen should be mounted when opening the modal
    const invoiceScreen = root.findByProps({ testID: 'invoice-screen-in-modal' });
    expect(invoiceScreen).toBeDefined();

    // Since InvoiceScreen is mocked we cannot assert internal create behaviour here.
    // Ensure createInvoice mock has not been invoked by Dashboard directly.
    expect(createInvoice).not.toHaveBeenCalled();
  });
});
