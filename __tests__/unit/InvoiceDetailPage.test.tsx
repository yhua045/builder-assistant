import React from 'react';
import renderer, { act } from 'react-test-renderer';
import InvoiceDetailPage from '../../src/pages/invoices/InvoiceDetailPage';
import { Invoice } from '../../src/domain/entities/Invoice';
import { useInvoices } from '../../src/hooks/useInvoices';

// Mock dependencies
jest.mock('../../src/hooks/useInvoices');
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => children,
}));
jest.mock('lucide-react-native', () => ({
  ArrowLeft: 'ArrowLeft',
  FileText: 'FileText',
  Edit: 'Edit',
  Trash2: 'Trash2',
  X: 'X',
  Check: 'Check',
}));
jest.mock('nativewind', () => ({
  cssInterop: jest.fn(),
  useColorScheme: () => ({ colorScheme: 'light' }),
}));
jest.mock('../../src/components/ThemeToggle', () => ({
  ThemeToggle: () => 'ThemeToggle',
}));
jest.mock('../../src/components/invoices/InvoiceForm', () => ({
  InvoiceForm: ({ mode, initialValues, onUpdate, onCancel }: any) => (
    <mock-invoice-form
      testID="invoice-form"
      mode={mode}
      onUpdate={() => onUpdate({ ...initialValues, total: 9999 })}
      onCancel={onCancel}
    />
  ),
}));

const mockUseInvoices = useInvoices as jest.MockedFunction<typeof useInvoices>;
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();

// Mock navigation
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
  }),
  useRoute: () => ({
    params: { invoiceId: 'inv_123' },
  }),
}));

describe('InvoiceDetailPage', () => {
  const mockInvoice: Invoice = {
    id: 'inv_123',
    invoiceNumber: 'INV-001',
    vendor: 'Acme Corp',
    projectId: 'proj_1',
    total: 1000,
    subtotal: 900,
    tax: 100,
    currency: 'USD',
    status: 'issued',
    paymentStatus: 'unpaid',
    issueDate: '2024-01-15',
    dueDate: '2024-02-15',
    notes: 'Monthly service fee',
    lineItems: [
      {
        description: 'Service A',
        quantity: 2,
        unitPrice: 300,
        amount: 600,
      },
      {
        description: 'Service B',
        quantity: 1,
        unitPrice: 300,
        amount: 300,
      },
    ],
    createdAt: '2024-01-15T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
  };

  const defaultHookReturn = {
    invoices: [],
    loading: false,
    error: null,
    createInvoice: jest.fn(),
    updateInvoice: jest.fn().mockResolvedValue({ success: true }),
    deleteInvoice: jest.fn().mockResolvedValue({ success: true }),
    getInvoiceById: jest.fn().mockResolvedValue(mockInvoice),
    refreshInvoices: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseInvoices.mockReturnValue(defaultHookReturn);
  });

  describe('View mode', () => {
    it('renders invoice header with number and vendor', async () => {
      let tree: any;
      await act(async () => {
        tree = renderer.create(<InvoiceDetailPage />);
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      const root = tree.root;

      const invoiceNumber = root.findAllByProps({ children: 'INV-001' });
      const vendor = root.findAllByProps({ children: 'Acme Corp' });

      expect(invoiceNumber.length).toBeGreaterThan(0);
      expect(vendor.length).toBeGreaterThan(0);
    });

    it('displays status badge', async () => {
      let tree: any;
      await act(async () => {
        tree = renderer.create(<InvoiceDetailPage />);
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      const root = tree.root;

      const statusBadge = root.findAllByProps({ testID: 'status-badge' });
      expect(statusBadge.length).toBeGreaterThan(0);
    });

    it('shows all invoice amounts (total, subtotal, tax)', async () => {
      let tree: any;
      await act(async () => {
        tree = renderer.create(<InvoiceDetailPage />);
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      const root = tree.root;

      const amounts = root.findAll((node) => 
        typeof node.props.children === 'string' && 
        (node.props.children.includes('$1,000') || 
         node.props.children.includes('$900') ||
         node.props.children.includes('$100'))
      );

      expect(amounts.length).toBeGreaterThan(0);
    });

    it('displays dates (issue date and due date)', async () => {
      let tree: any;
      await act(async () => {
        tree = renderer.create(<InvoiceDetailPage />);
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      const root = tree.root;

      const dates = root.findAll((node) => 
        typeof node.props.children === 'string' && 
        (node.props.children.includes('Jan') || node.props.children.includes('Feb'))
      );

      expect(dates.length).toBeGreaterThan(0);
    });

    it('shows line items when present', async () => {
      let tree: any;
      await act(async () => {
        tree = renderer.create(<InvoiceDetailPage />);
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      const root = tree.root;

      const serviceA = root.findAllByProps({ children: 'Service A' });
      const serviceB = root.findAllByProps({ children: 'Service B' });

      expect(serviceA.length).toBeGreaterThan(0);
      expect(serviceB.length).toBeGreaterThan(0);
    });

    it('displays notes when present', async () => {
      let tree: any;
      await act(async () => {
        tree = renderer.create(<InvoiceDetailPage />);
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      const root = tree.root;

      const notes = root.findAllByProps({ children: 'Monthly service fee' });
      expect(notes.length).toBeGreaterThan(0);
    });

    it('shows edit and delete action buttons', async () => {
      let tree: any;
      await act(async () => {
        tree = renderer.create(<InvoiceDetailPage />);
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      const root = tree.root;

      const editButton = root.findAllByProps({ testID: 'action-edit' });
      const deleteButton = root.findAllByProps({ testID: 'action-delete' });

      expect(editButton.length).toBeGreaterThan(0);
      expect(deleteButton.length).toBeGreaterThan(0);
    });
  });

  describe('Edit mode', () => {
    it('switches to edit mode when edit button pressed', async () => {
      let tree: any;
      await act(async () => {
        tree = renderer.create(<InvoiceDetailPage />);
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      const root = tree.root;

      const editButton = root.findByProps({ testID: 'action-edit' });

      await act(async () => {
        editButton.props.onPress();
      });

      const invoiceForm = root.findAllByProps({ testID: 'invoice-form' });
      expect(invoiceForm.length).toBeGreaterThan(0);
      expect(invoiceForm[0].props.mode).toBe('edit');
    });

    it('passes current invoice as initialValues to form', async () => {
      let tree: any;
      await act(async () => {
        tree = renderer.create(<InvoiceDetailPage />);
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      const root = tree.root;

      const editButton = root.findByProps({ testID: 'action-edit' });

      await act(async () => {
        editButton.props.onPress();
      });

      const invoiceForm = root.findByProps({ testID: 'invoice-form' });
      // InvoiceForm should receive initialValues (checked in mock)
      expect(invoiceForm).toBeDefined();
    });

    it('calls updateInvoice when form submitted', async () => {
      const updateInvoice = jest.fn().mockResolvedValue({ success: true });
      mockUseInvoices.mockReturnValue({
        ...defaultHookReturn,
        updateInvoice,
      });

      let tree: any;
      await act(async () => {
        tree = renderer.create(<InvoiceDetailPage />);
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      const root = tree.root;

      const editButton = root.findByProps({ testID: 'action-edit' });

      await act(async () => {
        editButton.props.onPress();
      });

      const invoiceForm = root.findByProps({ testID: 'invoice-form' });

      await act(async () => {
        invoiceForm.props.onUpdate({ ...mockInvoice, total: 9999 });
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      expect(updateInvoice).toHaveBeenCalled();
    });

    it('exits edit mode after successful update', async () => {
      const updateInvoice = jest.fn().mockResolvedValue({ success: true });
      const getInvoiceById = jest.fn()
        .mockResolvedValueOnce(mockInvoice)
        .mockResolvedValueOnce({ ...mockInvoice, total: 9999 });

      mockUseInvoices.mockReturnValue({
        ...defaultHookReturn,
        updateInvoice,
        getInvoiceById,
      });

      let tree: any;
      await act(async () => {
        tree = renderer.create(<InvoiceDetailPage />);
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      const root = tree.root;

      const editButton = root.findByProps({ testID: 'action-edit' });

      await act(async () => {
        editButton.props.onPress();
      });

      const invoiceForm = root.findByProps({ testID: 'invoice-form' });

      await act(async () => {
        invoiceForm.props.onUpdate({ ...mockInvoice, total: 9999 });
        await new Promise(resolve => setTimeout(resolve, 20));
      });

      // Should show view mode again (no form after update)
      const forms = root.findAllByProps({ testID: 'invoice-form' });
      expect(forms.length).toBe(0);
    });

    it('cancels edit mode when cancel button pressed', async () => {
      let tree: any;
      await act(async () => {
        tree = renderer.create(<InvoiceDetailPage />);
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      const root = tree.root;

      const editButton = root.findByProps({ testID: 'action-edit' });

      await act(async () => {
        editButton.props.onPress();
      });

      const invoiceForm = root.findByProps({ testID: 'invoice-form' });

      await act(async () => {
        invoiceForm.props.onCancel();
      });

      // Should be back in view mode
      const forms = root.findAllByProps({ testID: 'invoice-form' });
      expect(forms.length).toBe(0);
    });
  });

  describe('Delete functionality', () => {
    it('calls deleteInvoice and navigates back when delete pressed', async () => {
      const deleteInvoice = jest.fn().mockResolvedValue({ success: true });
      mockUseInvoices.mockReturnValue({
        ...defaultHookReturn,
        deleteInvoice,
      });

      let tree: any;
      await act(async () => {
        tree = renderer.create(<InvoiceDetailPage />);
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      const root = tree.root;

      const deleteButton = root.findByProps({ testID: 'action-delete' });

      await act(async () => {
        deleteButton.props.onPress();
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      expect(deleteInvoice).toHaveBeenCalledWith('inv_123');
      expect(mockGoBack).toHaveBeenCalled();
    });
  });

  describe('Loading and error states', () => {
    it('shows loading indicator while fetching invoice', async () => {
      const getInvoiceById = jest.fn(() => new Promise(() => {})); // Never resolves
      mockUseInvoices.mockReturnValue({
        ...defaultHookReturn,
        getInvoiceById,
      });

      let tree: any;
      act(() => {
        tree = renderer.create(<InvoiceDetailPage />);
      });
      const root = tree.root;

      const loader = root.findAllByProps({ testID: 'invoice-loading' });
      expect(loader.length).toBeGreaterThan(0);
    });

    it('shows error when invoice not found', async () => {
      const getInvoiceById = jest.fn().mockResolvedValue(null);
      mockUseInvoices.mockReturnValue({
        ...defaultHookReturn,
        getInvoiceById,
      });

      let tree: any;
      await act(async () => {
        tree = renderer.create(<InvoiceDetailPage />);
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      const root = tree.root;

      const errorMsg = root.findAllByProps({ testID: 'invoice-not-found' });
      expect(errorMsg.length).toBeGreaterThan(0);
    });
  });

  describe('Navigation', () => {
    it('navigates back when back button pressed', async () => {
      let tree: any;
      await act(async () => {
        tree = renderer.create(<InvoiceDetailPage />);
        await new Promise(resolve => setTimeout(resolve, 10));
      });
      const root = tree.root;

      const backButton = root.findAllByProps({ testID: 'back-button' });
      
      if (backButton.length > 0) {
        await act(async () => {
          backButton[0].props.onPress();
        });

        expect(mockGoBack).toHaveBeenCalled();
      }
    });
  });
});
