/**
 * T-1 through T-10: PaymentDetails – Project field tests (migrated to MVVM pattern)
 *
 * Design: design/issue-210-payment-details-refactor.md §9
 *
 * Tests project display, picker interaction, and project assignment logic,
 * now driven entirely by a mocked `usePaymentDetails()` hook (no DI container access).
 *
 * Migration notes:
 * - OLD pattern: container.resolve mocked; four use cases mocked directly in component.
 * - NEW pattern: `usePaymentDetails` hook mocked; component is pure presentation.
 */
import React from 'react';
import { Alert } from 'react-native';
import { render, fireEvent, act, waitFor } from '@testing-library/react-native';
import { container } from 'tsyringe';
import { wrapWithQuery } from '../../../../../../__tests__/utils/queryClientWrapper';
import { usePaymentDetails } from '../../../hooks/usePaymentDetails';
import type { PaymentDetailsViewModel } from '../../../hooks/usePaymentDetails';

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
  Pencil: 'Pencil',
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

jest.mock('../../../../../infrastructure/di/registerServices', () => ({}));

// ─── Mock usePaymentDetails (MVVM — component is pure presentation) ───────────
jest.mock('../../../hooks/usePaymentDetails');
const mockedUsePaymentDetails = usePaymentDetails as jest.MockedFunction<typeof usePaymentDetails>;

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

// ─── VM factory ──────────────────────────────────────────────────────────────

function makeVm(overrides: Partial<PaymentDetailsViewModel> = {}): PaymentDetailsViewModel {
  return {
    payment: PAYMENT_WITH_PROJECT as any,
    invoice: null,
    linkedPayments: [],
    project: PROJECT as any,
    loading: false,
    marking: false,
    submitting: false,
    isSyntheticRow: false,
    resolvedProjectId: 'proj-1',
    dueStatus: null,
    totalSettled: 0,
    remainingBalance: 0,
    canRecordPayment: true,
    showMarkAsPaidFallback: false,
    isPending: true,
    projectRowInteractive: true,
    showEditIcon: false,
    projectPickerVisible: false,
    pendingFormVisible: false,
    partialModalVisible: false,
    partialAmount: '',
    partialAmountError: '',
    handleMarkAsPaid: jest.fn(),
    handlePartialPaymentSubmit: jest.fn().mockResolvedValue(undefined),
    handleSelectProject: jest.fn().mockResolvedValue(undefined),
    handleNavigateToProject: jest.fn(),
    openPartialModal: jest.fn(),
    closePartialModal: jest.fn(),
    setPartialAmount: jest.fn(),
    setProjectPickerVisible: jest.fn(),
    setPendingFormVisible: jest.fn(),
    goBack: jest.fn(),
    reload: jest.fn(),
    ...overrides,
  };
}

// ─── Mock repository (ProjectPickerModal uses container internally) ───────────

let mockProjectRepo: any;

beforeEach(() => {
  jest.clearAllMocks();

  mockProjectRepo = {
    findById: jest.fn().mockResolvedValue(PROJECT),
    list: jest.fn().mockResolvedValue({ items: [PROJECT, PROJECT_2], meta: { total: 2 } }),
  };

  // ProjectPickerModal resolves ProjectRepository from the DI container internally.
  jest.spyOn(container, 'resolve').mockImplementation((token: any) => {
    if (String(token) === 'ProjectRepository') return mockProjectRepo;
    return {};
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ─── Import component under test (AFTER mocks) ───────────────────────────────

import PaymentDetails from '../../../screens/PaymentDetails';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('PaymentDetails — Project field (T-1 through T-10)', () => {
  it('T-1: renders project name when projectId is set and project found', async () => {
    mockedUsePaymentDetails.mockReturnValue(makeVm());
    const { findByText } = render(wrapWithQuery(<PaymentDetails />));
    expect(await findByText('House Reno')).toBeTruthy();
  });

  it('T-2: Project row is tappable (pressing opens modal without error)', async () => {
    mockedUsePaymentDetails.mockImplementation(() => {
      const [projectPickerVisible, setProjectPickerVisible] = React.useState(false);
      return makeVm({ projectPickerVisible, setProjectPickerVisible });
    });

    const { findByTestId } = render(wrapWithQuery(<PaymentDetails />));
    const row = await findByTestId('project-row');
    await act(async () => {
      fireEvent.press(row);
    });
    const modal = await findByTestId('project-picker-modal');
    expect(modal).toBeTruthy();
  });

  it('T-3: pressing project row opens ProjectPickerModal', async () => {
    mockedUsePaymentDetails.mockImplementation(() => {
      const [projectPickerVisible, setProjectPickerVisible] = React.useState(false);
      return makeVm({ projectPickerVisible, setProjectPickerVisible });
    });

    const { findByTestId } = render(wrapWithQuery(<PaymentDetails />));
    const row = await findByTestId('project-row');
    await act(async () => {
      fireEvent.press(row);
    });
    const modal = await findByTestId('project-picker-modal');
    expect(modal).toBeTruthy();
  });

  it('T-4: selecting a project in the picker calls handleSelectProject with correct project', async () => {
    const handleSelectProject = jest.fn().mockResolvedValue(undefined);
    mockedUsePaymentDetails.mockImplementation(() => {
      const [projectPickerVisible, setProjectPickerVisible] = React.useState(false);
      return makeVm({ projectPickerVisible, setProjectPickerVisible, handleSelectProject });
    });

    const { findByTestId } = render(wrapWithQuery(<PaymentDetails />));
    const row = await findByTestId('project-row');
    await act(async () => {
      fireEvent.press(row);
    });

    const proj2Item = await findByTestId('project-item-proj-2');
    await act(async () => {
      fireEvent.press(proj2Item);
    });

    expect(handleSelectProject).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'proj-2' }),
    );
  });

  it('T-5: clearing assignment calls handleSelectProject with undefined', async () => {
    const handleSelectProject = jest.fn().mockResolvedValue(undefined);
    mockedUsePaymentDetails.mockImplementation(() => {
      const [projectPickerVisible, setProjectPickerVisible] = React.useState(false);
      return makeVm({ projectPickerVisible, setProjectPickerVisible, handleSelectProject });
    });

    const { findByTestId } = render(wrapWithQuery(<PaymentDetails />));
    const row = await findByTestId('project-row');
    await act(async () => {
      fireEvent.press(row);
    });

    const clearBtn = await findByTestId('project-picker-clear');
    await act(async () => {
      fireEvent.press(clearBtn);
    });

    expect(handleSelectProject).toHaveBeenCalledWith(undefined);
  });

  it('T-6: renders "Unassigned" when projectId is absent and row is still tappable', async () => {
    mockedUsePaymentDetails.mockImplementation(() => {
      const [projectPickerVisible, setProjectPickerVisible] = React.useState(false);
      return makeVm({
        payment: PAYMENT_NO_PROJECT as any,
        project: null,
        resolvedProjectId: undefined,
        projectPickerVisible,
        setProjectPickerVisible,
      });
    });

    const { findByText, findByTestId } = render(wrapWithQuery(<PaymentDetails />));
    expect(await findByText('Unassigned')).toBeTruthy();
    const row = await findByTestId('project-row');
    await act(async () => {
      fireEvent.press(row);
    });
    const modal = await findByTestId('project-picker-modal');
    expect(modal).toBeTruthy();
  });

  it('T-7: renders "Unassigned" when project is null', async () => {
    mockedUsePaymentDetails.mockReturnValue(makeVm({ project: null }));
    const { findByText } = render(wrapWithQuery(<PaymentDetails />));
    expect(await findByText('Unassigned')).toBeTruthy();
  });

  it('T-8: tapping "Go to Project" in picker calls handleNavigateToProject', async () => {
    const handleNavigateToProject = jest.fn();
    mockedUsePaymentDetails.mockImplementation(() => {
      const [projectPickerVisible, setProjectPickerVisible] = React.useState(false);
      return makeVm({ projectPickerVisible, setProjectPickerVisible, handleNavigateToProject });
    });

    const { findByTestId } = render(wrapWithQuery(<PaymentDetails />));
    const row = await findByTestId('project-row');
    await act(async () => {
      fireEvent.press(row);
    });

    const goToBtn = await findByTestId('project-picker-go-to-project');
    await act(async () => {
      fireEvent.press(goToBtn);
    });

    expect(handleNavigateToProject).toHaveBeenCalled();
  });

  it('T-9: selecting a project triggers handleSelectProject once', async () => {
    const handleSelectProject = jest.fn().mockResolvedValue(undefined);
    mockedUsePaymentDetails.mockImplementation(() => {
      const [projectPickerVisible, setProjectPickerVisible] = React.useState(false);
      return makeVm({ projectPickerVisible, setProjectPickerVisible, handleSelectProject });
    });

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
      expect(handleSelectProject).toHaveBeenCalledTimes(1);
    });
  });

  it('T-10: assignment failure triggers Alert without crashing the component', async () => {
    // The real hook catches errors internally and calls Alert.alert.
    // We simulate that behaviour here: the mock catches the error and calls Alert.
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const handleSelectProject = jest.fn().mockImplementation(async () => {
      try {
        throw new Error('DB error');
      } catch {
        Alert.alert('Error', 'Failed to assign project');
      }
    });
    mockedUsePaymentDetails.mockImplementation(() => {
      const [projectPickerVisible, setProjectPickerVisible] = React.useState(false);
      return makeVm({ projectPickerVisible, setProjectPickerVisible, handleSelectProject });
    });

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
