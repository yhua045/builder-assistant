import React from 'react';
import renderer, { act } from 'react-test-renderer';
import InvoiceListPage from '../../src/pages/invoices/InvoiceListPage';
import { useInvoices } from '../../src/hooks/useInvoices';
import { Invoice } from '../../src/domain/entities/Invoice';

// Mock dependencies
jest.mock('../../src/hooks/useInvoices');
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => children,
}));
jest.mock('lucide-react-native', () => ({
  FileText: 'FileText',
  Filter: 'Filter',
  Eye: 'Eye',
  Edit: 'Edit',
  Trash2: 'Trash2',
  DollarSign: 'DollarSign',
  AlertCircle: 'AlertCircle',
  CheckCircle: 'CheckCircle',
  Clock: 'Clock',
}));
jest.mock('nativewind', () => ({
  cssInterop: jest.fn(),
  useColorScheme: () => ({ colorScheme: 'light' }),
}));
jest.mock('../../src/components/ThemeToggle', () => ({
  ThemeToggle: () => 'ThemeToggle',
}));

const mockUseInvoices = useInvoices as jest.MockedFunction<typeof useInvoices>;

describe('InvoiceListPage', () => {
  const mockInvoices: Invoice[] = [
    {
      id: 'inv_1',
      invoiceNumber: 'INV-001',
      vendor: 'Acme Corp',
      total: 1000,
      currency: 'USD',
      status: 'draft',
      paymentStatus: 'unpaid',
      issueDate: '2024-01-01',
      dueDate: '2024-02-01',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 'inv_2',
      invoiceNumber: 'INV-002',
      vendor: 'BuildCo',
      total: 2500,
      currency: 'USD',
      status: 'issued',
      paymentStatus: 'unpaid',
      issueDate: '2024-01-05',
      dueDate: '2024-02-05',
      createdAt: '2024-01-05T00:00:00Z',
      updatedAt: '2024-01-05T00:00:00Z',
    },
    {
      id: 'inv_3',
      invoiceNumber: 'INV-003',
      vendor: 'Suppliers Inc',
      total: 500,
      currency: 'USD',
      status: 'paid',
      paymentStatus: 'paid',
      issueDate: '2024-01-10',
      dueDate: '2024-02-10',
      createdAt: '2024-01-10T00:00:00Z',
      updatedAt: '2024-01-10T00:00:00Z',
    },
  ];

  const defaultHookReturn = {
    invoices: mockInvoices,
    loading: false,
    error: null,
    createInvoice: jest.fn(),
    updateInvoice: jest.fn(),
    deleteInvoice: jest.fn(),
    getInvoiceById: jest.fn(),
    refreshInvoices: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseInvoices.mockReturnValue(defaultHookReturn);
  });

  describe('Rendering', () => {
    it('renders header with title', () => {
      let tree: any;
      act(() => {
        tree = renderer.create(<InvoiceListPage />);
      });
      const root = tree.root;

      const header = root.findAllByProps({ children: 'Invoices' });
      expect(header.length).toBeGreaterThan(0);
    });

    it('renders invoice list when invoices exist', () => {
      let tree: any;
      act(() => {
        tree = renderer.create(<InvoiceListPage />);
      });
      const root = tree.root;

      // Find invoice items by invoice number
      const inv1 = root.findAllByProps({ children: 'INV-001' });
      const inv2 = root.findAllByProps({ children: 'INV-002' });
      const inv3 = root.findAllByProps({ children: 'INV-003' });

      expect(inv1.length).toBeGreaterThan(0);
      expect(inv2.length).toBeGreaterThan(0);
      expect(inv3.length).toBeGreaterThan(0);
    });

    it('displays vendor names', () => {
      let tree: any;
      act(() => {
        tree = renderer.create(<InvoiceListPage />);
      });
      const root = tree.root;

      const vendor1 = root.findAllByProps({ children: 'Acme Corp' });
      const vendor2 = root.findAllByProps({ children: 'BuildCo' });

      expect(vendor1.length).toBeGreaterThan(0);
      expect(vendor2.length).toBeGreaterThan(0);
    });

    it('displays formatted currency amounts', () => {
      let tree: any;
      act(() => {
        tree = renderer.create(<InvoiceListPage />);
      });
      const root = tree.root;

      // Should format as currency
      const amounts = root.findAll((node) => {
        return (
          typeof node.props.children === 'string' &&
          (node.props.children.includes('$1,000') || 
           node.props.children.includes('$2,500') ||
           node.props.children.includes('$500'))
        );
      });

      expect(amounts.length).toBeGreaterThan(0);
    });

    it('shows empty state when no invoices', () => {
      mockUseInvoices.mockReturnValue({
        ...defaultHookReturn,
        invoices: [],
      });

      let tree: any;
      act(() => {
        tree = renderer.create(<InvoiceListPage />);
      });
      const root = tree.root;

      const emptyMessage = root.findAllByProps({ testID: 'invoices-empty' });
      expect(emptyMessage.length).toBeGreaterThan(0);
    });
  });

  describe('Loading and error states', () => {
    it('shows loading indicator when loading', () => {
      mockUseInvoices.mockReturnValue({
        ...defaultHookReturn,
        loading: true,
        invoices: [],
      });

      let tree: any;
      act(() => {
        tree = renderer.create(<InvoiceListPage />);
      });
      const root = tree.root;

      const loader = root.findAllByProps({ testID: 'invoices-loading' });
      expect(loader.length).toBeGreaterThan(0);
    });

    it('shows error message when error exists', () => {
      mockUseInvoices.mockReturnValue({
        ...defaultHookReturn,
        error: 'Failed to load invoices',
      });

      let tree: any;
      act(() => {
        tree = renderer.create(<InvoiceListPage />);
      });
      const root = tree.root;

      const errorEl = root.findAllByProps({ testID: 'invoices-error' });
      expect(errorEl.length).toBeGreaterThan(0);
      expect(errorEl[0].props.children).toContain('Failed to load invoices');
    });

    it('does not show invoice list when loading', () => {
      mockUseInvoices.mockReturnValue({
        ...defaultHookReturn,
        loading: true,
        invoices: mockInvoices,
      });

      let tree: any;
      act(() => {
        tree = renderer.create(<InvoiceListPage />);
      });
      const root = tree.root;

      const invoiceItems = root.findAll((node) => 
        node.props.testID && node.props.testID.startsWith('invoice-item-')
      );
      expect(invoiceItems.length).toBe(0);
    });
  });

  describe('Status badges', () => {
    it('displays status badges for each invoice', () => {
      let tree: any;
      act(() => {
        tree = renderer.create(<InvoiceListPage />);
      });
      const root = tree.root;

      // Check for status badge elements
      const draftBadge = root.findAll((node) => 
        node.props.testID === 'status-badge-draft'
      );
      const issuedBadge = root.findAll((node) => 
        node.props.testID === 'status-badge-issued'
      );
      const paidBadge = root.findAll((node) => 
        node.props.testID === 'status-badge-paid'
      );

      expect(draftBadge.length).toBeGreaterThan(0);
      expect(issuedBadge.length).toBeGreaterThan(0);
      expect(paidBadge.length).toBeGreaterThan(0);
    });

    it('applies correct styling for draft status', () => {
      let tree: any;
      act(() => {
        tree = renderer.create(<InvoiceListPage />);
      });
      const root = tree.root;

      const draftBadges = root.findAll((node) => 
        node.props.testID === 'status-badge-draft'
      );

      expect(draftBadges.length).toBeGreaterThan(0);
      const badge = draftBadges[0];
      expect(badge.props.className).toContain('bg-gray');
    });

    it('applies correct styling for issued status', () => {
      let tree: any;
      act(() => {
        tree = renderer.create(<InvoiceListPage />);
      });
      const root = tree.root;

      const issuedBadges = root.findAll((node) => 
        node.props.testID === 'status-badge-issued'
      );

      expect(issuedBadges.length).toBeGreaterThan(0);
      const badge = issuedBadges[0];
      expect(badge.props.className).toContain('bg-blue');
    });

    it('applies correct styling for paid status', () => {
      let tree: any;
      act(() => {
        tree = renderer.create(<InvoiceListPage />);
      });
      const root = tree.root;

      const paidBadges = root.findAll((node) => 
        node.props.testID === 'status-badge-paid'
      );

      expect(paidBadges.length).toBeGreaterThan(0);
      const badge = paidBadges[0];
      expect(badge.props.className).toContain('bg-green');
    });
  });

  describe('Quick actions', () => {
    it('shows action buttons for each invoice', () => {
      let tree: any;
      act(() => {
        tree = renderer.create(<InvoiceListPage />);
      });
      const root = tree.root;

      // Check that each invoice has action buttons (by checking specific testIDs)
      const viewBtn1 = root.findAllByProps({ testID: 'action-view-inv_1' });
      const editBtn1 = root.findAllByProps({ testID: 'action-edit-inv_1' });
      const deleteBtn1 = root.findAllByProps({ testID: 'action-delete-inv_1' });

      expect(viewBtn1.length).toBeGreaterThan(0);
      expect(editBtn1.length).toBeGreaterThan(0);
      expect(deleteBtn1.length).toBeGreaterThan(0);
    });

    it('calls deleteInvoice when delete button pressed', async () => {
      const deleteInvoice = jest.fn().mockResolvedValue({ success: true });
      mockUseInvoices.mockReturnValue({
        ...defaultHookReturn,
        deleteInvoice,
      });

      let tree: any;
      act(() => {
        tree = renderer.create(<InvoiceListPage />);
      });
      const root = tree.root;

      const deleteButton = root.findByProps({ testID: 'action-delete-inv_1' });

      await act(async () => {
        deleteButton.props.onPress();
      });

      expect(deleteInvoice).toHaveBeenCalledWith('inv_1');
    });
  });

  describe('Filtering', () => {
    it('renders filter tabs for all statuses', () => {
      let tree: any;
      act(() => {
        tree = renderer.create(<InvoiceListPage />);
      });
      const root = tree.root;

      const allTab = root.findAllByProps({ testID: 'filter-all' });
      const draftTab = root.findAllByProps({ testID: 'filter-draft' });
      const issuedTab = root.findAllByProps({ testID: 'filter-issued' });
      const paidTab = root.findAllByProps({ testID: 'filter-paid' });

      expect(allTab.length).toBeGreaterThan(0);
      expect(draftTab.length).toBeGreaterThan(0);
      expect(issuedTab.length).toBeGreaterThan(0);
      expect(paidTab.length).toBeGreaterThan(0);
    });

    it('filters invoices by status when filter selected', () => {
      let tree: any;
      act(() => {
        tree = renderer.create(<InvoiceListPage />);
      });
      const root = tree.root;

      // Click on "paid" filter
      const paidTab = root.findByProps({ testID: 'filter-paid' });
      
      act(() => {
        paidTab.props.onPress();
      });

      // Should only show paid invoice (inv_3)
      const inv3 = root.findAllByProps({ testID: 'invoice-item-inv_3' });
      const inv1 = root.findAllByProps({ testID: 'invoice-item-inv_1' });
      const inv2 = root.findAllByProps({ testID: 'invoice-item-inv_2' });
      
      expect(inv3.length).toBeGreaterThan(0);
      expect(inv1.length).toBe(0);
      expect(inv2.length).toBe(0);
    });

    it('shows all invoices when "all" filter selected', () => {
      let tree: any;
      act(() => {
        tree = renderer.create(<InvoiceListPage />);
      });
      const root = tree.root;

      // Click on "all" filter
      const allTab = root.findByProps({ testID: 'filter-all' });
      
      act(() => {
        allTab.props.onPress();
      });

      // Should show all three invoices
      const inv1 = root.findAllByProps({ testID: 'invoice-item-inv_1' });
      const inv2 = root.findAllByProps({ testID: 'invoice-item-inv_2' });
      const inv3 = root.findAllByProps({ testID: 'invoice-item-inv_3' });
      
      expect(inv1.length).toBeGreaterThan(0);
      expect(inv2.length).toBeGreaterThan(0);
      expect(inv3.length).toBeGreaterThan(0);
    });
  });

  describe('Summary metrics', () => {
    it('displays total invoice count', () => {
      let tree: any;
      act(() => {
        tree = renderer.create(<InvoiceListPage />);
      });
      const root = tree.root;

      // Should show count of 3
      const countElements = root.findAll((node) => 
        node.props.children === 3 || node.props.children === '3'
      );

      expect(countElements.length).toBeGreaterThan(0);
    });

    it('displays total unpaid amount', () => {
      let tree: any;
      act(() => {
        tree = renderer.create(<InvoiceListPage />);
      });
      const root = tree.root;

      // Total unpaid = 1000 + 2500 = 3500
      const amountElements = root.findAll((node) => 
        typeof node.props.children === 'string' && 
        node.props.children.includes('$3,500')
      );

      expect(amountElements.length).toBeGreaterThan(0);
    });
  });

  describe('Refresh functionality', () => {
    it('calls refreshInvoices on pull to refresh', async () => {
      const refreshInvoices = jest.fn().mockResolvedValue(undefined);
      mockUseInvoices.mockReturnValue({
        ...defaultHookReturn,
        refreshInvoices,
      });

      let tree: any;
      act(() => {
        tree = renderer.create(<InvoiceListPage />);
      });
      const root = tree.root;

      // Find the component with refreshControl prop
      const scrollView = root.findAll((node) => node.props.refreshControl);
      expect(scrollView.length).toBeGreaterThan(0);
      
      const refreshControl = scrollView[0].props.refreshControl;

      await act(async () => {
        refreshControl.props.onRefresh();
        // Wait a bit for async operation
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      expect(refreshInvoices).toHaveBeenCalled();
    });
  });
});
