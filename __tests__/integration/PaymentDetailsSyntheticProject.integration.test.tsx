/**
 * Integration tests for PaymentDetails — synthetic row project support (#196)
 *
 * Verifies that:
 * ✓ Project row is visible for a synthetic invoice-payable row
 * ✓ Project name from invoice.projectId is rendered in the project row
 * ✓ Project row is interactive (tappable) for a pending synthetic row
 * ✓ For a settled real payment, project row is read-only (no onPress)
 * ✓ Edit icon (pencil) is shown only for pending non-synthetic rows
 * ✓ Edit icon is NOT shown for synthetic rows (even when pending)
 *
 * Strategy: mock tsyringe repos + navigation + QueryClient; wait for
 * async loadData() to complete; then assert on rendered testIDs.
 */
import React from 'react';
import { render, waitFor, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PaymentDetails from '../../src/pages/payments/PaymentDetails';

// ── DI / infra mocks ──────────────────────────────────────────────────────────

const mockPaymentFindById = jest.fn();
const mockPaymentFindByInvoice = jest.fn().mockResolvedValue([]);
const mockPaymentRepo = {
  save: jest.fn(),
  findById: mockPaymentFindById,
  findAll: jest.fn(),
  findByInvoice: mockPaymentFindByInvoice,
  findByProjectId: jest.fn(),
  findPendingByProject: jest.fn(),
  update: jest.fn().mockResolvedValue(undefined),
  delete: jest.fn(),
  list: jest.fn(),
  getMetrics: jest.fn(),
  getGlobalAmountPayable: jest.fn(),
};

const mockInvoiceGetInvoice = jest.fn();
const mockInvoiceRepo = {
  createInvoice: jest.fn(),
  getInvoice: mockInvoiceGetInvoice,
  updateInvoice: jest.fn().mockResolvedValue(undefined),
  deleteInvoice: jest.fn(),
  findByExternalKey: jest.fn(),
  listInvoices: jest.fn(),
  assignProject: jest.fn().mockResolvedValue(undefined),
};

const mockProjectFindById = jest.fn();
const mockProjectRepo = {
  findById: mockProjectFindById,
  save: jest.fn(),
  findAll: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

jest.mock('tsyringe', () => ({
  container: {
    resolve: (token: string) => {
      if (token === 'PaymentRepository') return mockPaymentRepo;
      if (token === 'InvoiceRepository') return mockInvoiceRepo;
      if (token === 'ProjectRepository') return mockProjectRepo;
      return {};
    },
  },
  injectable: () => () => {},
  inject: () => () => {},
}));

jest.mock('../../src/infrastructure/di/registerServices', () => ({}));

// ── Navigation mocks ──────────────────────────────────────────────────────────

const mockGoBack = jest.fn();
const mockNavigate = jest.fn();
const mockDispatch = jest.fn();

// useRoute params are set per test via the factory below
let mockRouteParams: any = {};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ goBack: mockGoBack, navigate: mockNavigate, dispatch: mockDispatch }),
  useRoute: () => ({ params: mockRouteParams }),
  CommonActions: {
    navigate: jest.fn((params: any) => params),
  },
}));

// ── NativeWind / icon stubs ───────────────────────────────────────────────────

jest.mock('nativewind', () => ({
  cssInterop: jest.fn(),
  useColorScheme: () => ({ colorScheme: 'light' }),
}));

jest.mock('lucide-react-native', () => ({
  ChevronLeft: 'ChevronLeft',
  ChevronRight: 'ChevronRight',
  Pencil: 'Pencil',
  X: 'X',
  DollarSign: 'DollarSign',
}));

// ── Safe area stub ────────────────────────────────────────────────────────────

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => children,
}));

// ── Stubbed sub-components ────────────────────────────────────────────────────

jest.mock('../../src/components/shared/ProjectPickerModal', () => ({
  ProjectPickerModal: () => null,
}));

jest.mock('../../src/components/payments/PendingPaymentForm', () => ({
  PendingPaymentForm: () => null,
}));

jest.mock('../../src/components/inputs/DatePickerInput', () => {
  const React2 = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: () => React2.createElement(View, null),
  };
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderPaymentDetails() {
  return render(
    <QueryClientProvider client={createQueryClient()}>
      <PaymentDetails />
    </QueryClientProvider>,
  );
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SYNTHETIC_PAYMENT = {
  id: 'invoice-payable:inv_001',
  invoiceId: 'inv_001',
  amount: 5000,
  status: 'pending' as const,
  contractorName: 'Smith Constructions',
};

const MOCK_INVOICE = {
  id: 'inv_001',
  projectId: 'proj_001',
  total: 5000,
  currency: 'AUD',
  status: 'issued' as const,
  paymentStatus: 'unpaid' as const,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const MOCK_PROJECT = {
  id: 'proj_001',
  name: 'Smith Reno',
  status: 'in_progress',
  phases: [],
  materials: [],
};

const SETTLED_PAYMENT = {
  id: 'pay_settled_001',
  amount: 2000,
  status: 'settled' as const,
  projectId: 'proj_001',
  contractorName: 'Ajax Builders',
};

// ── Tests ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
});

describe('PaymentDetails — synthetic row project support', () => {
  it('renders project row for a synthetic invoice-payable row', async () => {
    mockRouteParams = { syntheticRow: SYNTHETIC_PAYMENT };
    mockInvoiceGetInvoice.mockResolvedValue(MOCK_INVOICE);
    mockProjectFindById.mockResolvedValue(MOCK_PROJECT);
    mockPaymentFindByInvoice.mockResolvedValue([]);

    const { findByTestId } = renderPaymentDetails();

    await findByTestId('project-row');
  });

  it('shows the project name from the invoice for synthetic rows', async () => {
    mockRouteParams = { syntheticRow: SYNTHETIC_PAYMENT };
    mockInvoiceGetInvoice.mockResolvedValue(MOCK_INVOICE);
    mockProjectFindById.mockResolvedValue(MOCK_PROJECT);
    mockPaymentFindByInvoice.mockResolvedValue([]);

    const { findByText } = renderPaymentDetails();

    await findByText('Smith Reno');
  });

  it('shows "Unassigned" for synthetic row when invoice has no project', async () => {
    mockRouteParams = {
      syntheticRow: { ...SYNTHETIC_PAYMENT, invoiceId: 'inv_noproject' },
    };
    mockInvoiceGetInvoice.mockResolvedValue({ ...MOCK_INVOICE, id: 'inv_noproject', projectId: undefined });
    mockPaymentFindByInvoice.mockResolvedValue([]);

    const { findByText } = renderPaymentDetails();

    await findByText('Unassigned');
  });

  it('project row for a pending synthetic row is interactive (tappable)', async () => {
    mockRouteParams = { syntheticRow: SYNTHETIC_PAYMENT };
    mockInvoiceGetInvoice.mockResolvedValue(MOCK_INVOICE);
    mockProjectFindById.mockResolvedValue(MOCK_PROJECT);
    mockPaymentFindByInvoice.mockResolvedValue([]);

    const { findByTestId } = renderPaymentDetails();
    const projectRow = await findByTestId('project-row');

    // Interactive row has an onPress handler
    expect(typeof projectRow.props.onPress).toBe('function');
  });

  it('project row for a settled real payment is read-only (no onPress)', async () => {
    mockRouteParams = { paymentId: SETTLED_PAYMENT.id };
    mockPaymentFindById.mockResolvedValue(SETTLED_PAYMENT);
    mockInvoiceGetInvoice.mockResolvedValue(null);
    mockProjectFindById.mockResolvedValue(MOCK_PROJECT);
    mockPaymentFindByInvoice.mockResolvedValue([]);

    const { findByTestId } = renderPaymentDetails();
    const projectRow = await findByTestId('project-row');

    // Read-only row is a plain View — no onPress
    expect(projectRow.props.onPress).toBeUndefined();
  });

  it('edit icon is NOT shown for synthetic (invoice-payable) rows', async () => {
    mockRouteParams = { syntheticRow: SYNTHETIC_PAYMENT };
    mockInvoiceGetInvoice.mockResolvedValue(MOCK_INVOICE);
    mockProjectFindById.mockResolvedValue(MOCK_PROJECT);
    mockPaymentFindByInvoice.mockResolvedValue([]);

    const { queryByTestId, findByTestId } = renderPaymentDetails();

    // Wait for load to complete
    await findByTestId('project-row');

    expect(queryByTestId('edit-payment-btn')).toBeNull();
  });

  it('edit icon IS shown for pending non-synthetic real payment rows', async () => {
    const pendingPayment = {
      id: 'pay_pending_001',
      amount: 3000,
      status: 'pending' as const,
      projectId: undefined,
      contractorName: 'Ace Builders',
    };
    mockRouteParams = { paymentId: pendingPayment.id };
    mockPaymentFindById.mockResolvedValue(pendingPayment);
    mockInvoiceGetInvoice.mockResolvedValue(null);
    mockPaymentFindByInvoice.mockResolvedValue([]);

    const { findByTestId } = renderPaymentDetails();

    await findByTestId('edit-payment-btn');
  });
});
