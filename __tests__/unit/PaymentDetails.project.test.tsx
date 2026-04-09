/**
 * T-1 through T-10: PaymentDetails – Project field tests
 *
 * Tests project display, picker interaction, and project assignment logic.
 */
import React from 'react';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { container } from 'tsyringe';
import { wrapWithQuery } from '../utils/queryClientWrapper';

// ─── Navigation mocks ────────────────────────────────────────────────────────

const mockDispatch = jest.fn();
const mockGoBack = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    dispatch: mockDispatch,
    goBack: mockGoBack,
  }),
  CommonActions: {
    navigate: jest.fn((config: any) => config),
  },
  useRoute: () => ({
    params: { paymentId: 'pay-123' },
  }),
}));

// ─── UI mocks ────────────────────────────────────────────────────────────────

jest.mock('nativewind', () => ({
  cssInterop: jest.fn(),
  useColorScheme: () => ({ colorScheme: 'light' }),
}));

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: any) => children,
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

jest.mock('lucide-react-native', () => ({
  ChevronLeft: 'ChevronLeft',
  ChevronRight: 'ChevronRight',
  X: 'X',
  DollarSign: 'DollarSign',
  Search: 'Search',
  FolderOpen: 'FolderOpen',
  Check: 'Check',
}));

jest.mock('@tanstack/react-query', () => ({
  ...jest.requireActual('@tanstack/react-query'),
  useQueryClient: () => ({
    invalidateQueries: jest.fn(),
  }),
}));

jest.mock('../../src/infrastructure/di/registerServices', () => ({}));

// ─── Test data ────────────────────────────────────────────────────────────────

const PAYMENT_WITH_PROJECT = {
  id: 'pay-123',
  projectId: 'proj-1',
  amount: 1000,
  status: 'pending' as const,
  contractorName: 'Acme Builders',
  paymentCategory: 'contract' as const,
};

const PAYMENT_NO_PROJECT = {
  id: 'pay-456',
  amount: 500,
  status: 'pending' as const,
  contractorName: 'Solo Co',
};

const PROJECT = {
  id: 'proj-1',
  name: 'House Reno',
  status: 'in_progress' as const,
  materials: [],
  phases: [],
};

const PROJECT_2 = {
  id: 'proj-2',
  name: 'Granny Flat',
  status: 'planning' as const,
  materials: [],
  phases: [],
};

// ─── Mock repositories ────────────────────────────────────────────────────────

let mockPaymentRepo: any;
let mockInvoiceRepo: any;
let mockProjectRepo: any;

beforeEach(() => {
  jest.clearAllMocks();

  mockPaymentRepo = {
    findById: jest.fn().mockResolvedValue(PAYMENT_WITH_PROJECT),
    findByInvoice: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue(undefined),
    list: jest.fn().mockResolvedValue({ items: [], meta: { total: 0 } }),
    getMetrics: jest.fn(),
    getGlobalAmountPayable: jest.fn().mockResolvedValue(0),
    save: jest.fn(),
  };

  mockInvoiceRepo = {
    getInvoice: jest.fn().mockResolvedValue(null),
  };

  mockProjectRepo = {
    findById: jest.fn().mockResolvedValue(PROJECT),
    list: jest
      .fn()
      .mockResolvedValue({ items: [PROJECT, PROJECT_2], meta: { total: 2 } }),
  };

  jest.spyOn(container, 'resolve').mockImplementation((token: any) => {
    const t = String(token);
    if (t === 'PaymentRepository') return mockPaymentRepo;
    if (t === 'InvoiceRepository') return mockInvoiceRepo;
    if (t === 'ProjectRepository') return mockProjectRepo;
    return {};
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── Import component under test (AFTER mocks) ───────────────────────────────

import PaymentDetails from '../../src/pages/payments/PaymentDetails';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PaymentDetails — Project field (T-1 through T-10)', () => {
  it('T-1: renders project name when projectId is set and project found', async () => {
    const { findByText } = render(wrapWithQuery(<PaymentDetails />));
    expect(await findByText('House Reno')).toBeTruthy();
  });

  it('T-2: Project row is tappable (pressing opens modal without error)', async () => {
    const { findByTestId } = render(wrapWithQuery(<PaymentDetails />));
    const row = await findByTestId('project-row');
    // Pressing should open picker without throwing
    await act(async () => {
      fireEvent.press(row);
    });
    const modal = await findByTestId('project-picker-modal');
    expect(modal).toBeTruthy();
  });

  it('T-3: pressing project row opens ProjectPickerModal', async () => {
    const { findByTestId } = render(wrapWithQuery(<PaymentDetails />));

    const row = await findByTestId('project-row');
    await act(async () => {
      fireEvent.press(row);
    });

    const modal = await findByTestId('project-picker-modal');
    expect(modal).toBeTruthy();
  });

  it('T-4: selecting a project in the picker calls paymentRepo.update with correct projectId', async () => {
    const { findByTestId } = render(wrapWithQuery(<PaymentDetails />));

    // Open picker
    const row = await findByTestId('project-row');
    await act(async () => {
      fireEvent.press(row);
    });

    // Select proj-2
    const proj2Item = await findByTestId('project-item-proj-2');
    await act(async () => {
      fireEvent.press(proj2Item);
    });

    expect(mockPaymentRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: 'proj-2' }),
    );
  });

  it('T-5: clearing assignment calls paymentRepo.update with projectId undefined', async () => {
    const { findByTestId } = render(wrapWithQuery(<PaymentDetails />));

    const row = await findByTestId('project-row');
    await act(async () => {
      fireEvent.press(row);
    });

    const clearBtn = await findByTestId('project-picker-clear');
    await act(async () => {
      fireEvent.press(clearBtn);
    });

    expect(mockPaymentRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: undefined }),
    );
  });

  it('T-6: renders "Unassigned" when projectId is absent and row is still tappable', async () => {
    mockPaymentRepo.findById.mockResolvedValue(PAYMENT_NO_PROJECT);

    const { findByText, findByTestId } = render(wrapWithQuery(<PaymentDetails />));

    expect(await findByText('Unassigned')).toBeTruthy();
    // Row is present and pressable
    const row = await findByTestId('project-row');
    await act(async () => {
      fireEvent.press(row);
    });
    const modal = await findByTestId('project-picker-modal');
    expect(modal).toBeTruthy();
  });

  it('T-7: renders "Unassigned" when projectRepo.findById returns null', async () => {
    mockProjectRepo.findById.mockResolvedValue(null);

    const { findByText } = render(wrapWithQuery(<PaymentDetails />));
    expect(await findByText('Unassigned')).toBeTruthy();
  });

  it('T-8: tapping "Go to Project" in picker dispatches CommonActions.navigate cross-tab', async () => {
    const { findByTestId } = render(wrapWithQuery(<PaymentDetails />));

    const row = await findByTestId('project-row');
    await act(async () => {
      fireEvent.press(row);
    });

    const goToBtn = await findByTestId('project-picker-go-to-project');
    await act(async () => {
      fireEvent.press(goToBtn);
    });

    expect(mockDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Projects',
      }),
    );
  });

  it('T-9: after successful project assignment, loadData is re-called (projectRepo.findById called twice)', async () => {
    const { findByTestId } = render(wrapWithQuery(<PaymentDetails />));

    // Initial load calls findById once
    await waitFor(() => {
      expect(mockProjectRepo.findById).toHaveBeenCalledTimes(1);
    });

    // Open picker and select proj-2
    const row = await findByTestId('project-row');
    await act(async () => {
      fireEvent.press(row);
    });

    // After update, pick new project AND allow re-load
    mockProjectRepo.findById.mockResolvedValue(PROJECT_2);
    const proj2Item = await findByTestId('project-item-proj-2');
    await act(async () => {
      fireEvent.press(proj2Item);
    });

    await waitFor(() => {
      expect(mockProjectRepo.findById).toHaveBeenCalledTimes(2);
    });
  });

  it('T-10: assignment failure shows Alert without crashing', async () => {
    mockPaymentRepo.update.mockRejectedValue(new Error('DB error'));
    const alertSpy = jest.spyOn(Alert, 'alert');

    const { findByTestId } = render(wrapWithQuery(<PaymentDetails />));

    const row = await findByTestId('project-row');
    await act(async () => {
      fireEvent.press(row);
    });

    const proj2Item = await findByTestId('project-item-proj-2');
    await act(async () => {
      fireEvent.press(proj2Item);
    });

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalled();
    });
  });
});
