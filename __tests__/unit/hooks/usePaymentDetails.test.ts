/**
 * Unit tests for usePaymentDetails View-Model hook
 * Design: design/issue-210-payment-details-refactor.md §8.1
 *
 * Acceptance criteria covered:
 * - Loading state: Returns loading: true before loadData resolves (paymentId, no syntheticRow)
 * - Synthetic row pre-population: When syntheticRow is in route params, payment = syntheticRow, loading: false
 * - Standalone payment load: paymentRepo.findById called; data populates vm.payment
 * - Invoice-only path: invoiceRepo + paymentRepo called; synthetic Payment constructed
 * - isSyntheticRow: true when payment.id starts with 'invoice-payable:'
 * - canRecordPayment: true/false based on invoice state and balance
 * - showMarkAsPaidFallback: true only for non-synthetic pending payments with no invoice
 * - showEditIcon: true only for isPending && !isSyntheticRow
 * - totalSettled: sum of settled linkedPayments
 * - remainingBalance: invoice.total - totalSettled
 * - handleMarkAsPaid (invoice path): calls recordPaymentUc.execute with correct args
 * - handleMarkAsPaid (standalone path): calls markPaidUc.execute({ paymentId })
 * - handlePartialPaymentSubmit (valid): calls recordPaymentUc.execute, clears modal state
 * - handlePartialPaymentSubmit (invalid amount = 0): sets partialAmountError; does NOT call execute
 * - handlePartialPaymentSubmit (amount > balance): sets partialAmountError; does NOT call execute
 * - handleSelectProject (real payment): calls linkPaymentUc.execute
 * - handleSelectProject (synthetic row): calls linkInvoiceUc.execute
 * - goBack: calls navigation.goBack()
 * - handleNavigateToProject: dispatches CommonActions.navigate to 'Projects' → 'ProjectDetail'
 * - setPartialAmount: clears partialAmountError to ''
 */

import { renderHook, act, waitFor } from '@testing-library/react-native';

// ── Module mocks (must be hoisted before imports) ────────────────────────────

jest.mock('@react-navigation/native', () => ({
  useRoute: jest.fn(),
  useNavigation: jest.fn(),
  CommonActions: {
    navigate: jest.fn((params: unknown) => ({ type: 'NAVIGATE', payload: params })),
  },
}));

jest.mock('@tanstack/react-query', () => ({
  useQueryClient: jest.fn(),
}));

jest.mock('tsyringe', () => ({
  container: {
    resolve: jest.fn(),
  },
  injectable: jest.fn(),
  inject: jest.fn(),
  singleton: jest.fn(),
  registry: jest.fn(),
}));

jest.mock('../../../src/infrastructure/di/registerServices', () => ({}));

const mockMarkPaidExecute = jest.fn().mockResolvedValue({ payment: {} });
jest.mock('../../../src/application/usecases/payment/MarkPaymentAsPaidUseCase', () => ({
  MarkPaymentAsPaidUseCase: jest.fn().mockImplementation(() => ({
    execute: mockMarkPaidExecute,
  })),
}));

const mockRecordPaymentExecute = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../src/application/usecases/payment/RecordPaymentUseCase', () => ({
  RecordPaymentUseCase: jest.fn().mockImplementation(() => ({
    execute: mockRecordPaymentExecute,
  })),
}));

const mockAssignProjectExecute = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../src/application/usecases/payment/AssignProjectToPaymentRecordUseCase', () => ({
  AssignProjectToPaymentRecordUseCase: jest.fn().mockImplementation(() => ({
    execute: mockAssignProjectExecute,
  })),
}));

// ── Imports (after mocks) ────────────────────────────────────────────────────

import { useRoute, useNavigation, CommonActions } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { container } from 'tsyringe';
import { Alert } from 'react-native';
import { usePaymentDetails } from '../../../src/hooks/usePaymentDetails';
import { GetPaymentDetailsUseCase } from '../../../src/application/usecases/payment/GetPaymentDetailsUseCase';
import { MarkPaymentAsPaidUseCase } from '../../../src/application/usecases/payment/MarkPaymentAsPaidUseCase';
import { RecordPaymentUseCase } from '../../../src/application/usecases/payment/RecordPaymentUseCase';
import { AssignProjectToPaymentRecordUseCase } from '../../../src/application/usecases/payment/AssignProjectToPaymentRecordUseCase';

// ── Typed mock helpers ───────────────────────────────────────────────────────

const mockUseRoute = useRoute as jest.MockedFunction<typeof useRoute>;
const mockUseNavigation = useNavigation as jest.MockedFunction<typeof useNavigation>;
const mockUseQueryClient = useQueryClient as jest.MockedFunction<typeof useQueryClient>;
const mockContainerResolve = container.resolve as jest.Mock;

const mockGoBack = jest.fn();
const mockDispatch = jest.fn();
const mockInvalidateQueries = jest.fn().mockResolvedValue(undefined);

// ── Test data ────────────────────────────────────────────────────────────────

const PAYMENT_FIXTURE = {
  id: 'pay-123',
  invoiceId: 'inv-1',
  projectId: 'proj-1',
  amount: 500,
  status: 'pending' as const,
  contractorName: 'Acme Builders',
};

const STANDALONE_PAYMENT = {
  id: 'pay-456',
  amount: 750,
  status: 'pending' as const,
  contractorName: 'Solo Co',
};

const SYNTHETIC_PAYMENT = {
  id: 'invoice-payable:inv-1',
  invoiceId: 'inv-1',
  projectId: 'proj-1',
  amount: 1000,
  status: 'pending' as const,
  contractorName: 'Invoice Payable',
};

const INVOICE_FIXTURE = {
  id: 'inv-1',
  projectId: 'proj-1',
  total: 1000,
  status: 'issued' as const,
  paymentStatus: 'unpaid' as const,
  currency: 'AUD',
  dateIssued: '2026-01-01',
  dateDue: '2026-02-01',
  issuerName: 'Acme Builders',
};

const PROJECT_FIXTURE = {
  id: 'proj-1',
  name: 'House Reno',
  status: 'in_progress' as const,
  materials: [],
  phases: [],
};

// ── Mock repositories ────────────────────────────────────────────────────────

let mockPaymentRepo: any;
let mockInvoiceRepo: any;
let mockProjectRepo: any;

// ── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();

  mockPaymentRepo = {
    findById: jest.fn().mockResolvedValue(PAYMENT_FIXTURE),
    findByInvoice: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    list: jest.fn().mockResolvedValue({ items: [], meta: { total: 0 } }),
    getMetrics: jest.fn(),
    getGlobalAmountPayable: jest.fn().mockResolvedValue(0),
  };

  mockInvoiceRepo = {
    getInvoice: jest.fn().mockResolvedValue(INVOICE_FIXTURE),
    updateInvoice: jest.fn().mockResolvedValue(INVOICE_FIXTURE),
    createInvoice: jest.fn(),
    deleteInvoice: jest.fn(),
    findByExternalKey: jest.fn(),
    listInvoices: jest.fn(),
    assignProject: jest.fn(),
  };

  mockProjectRepo = {
    findById: jest.fn().mockResolvedValue(PROJECT_FIXTURE),
    list: jest.fn().mockResolvedValue({ items: [PROJECT_FIXTURE], meta: { total: 1 } }),
    save: jest.fn(),
    count: jest.fn(),
    findByStatus: jest.fn(),
    findByPropertyId: jest.fn(),
    findByOwnerId: jest.fn(),
    findByPhaseDateRange: jest.fn(),
    findWithUpcomingPhases: jest.fn(),
    delete: jest.fn(),
    findDetailsById: jest.fn(),
    listDetails: jest.fn(),
    withTransaction: jest.fn(),
    findByExternalId: jest.fn(),
  };

  mockContainerResolve.mockImplementation((token: any) => {
    if (token === GetPaymentDetailsUseCase) {
      return new GetPaymentDetailsUseCase(mockPaymentRepo, mockInvoiceRepo, mockProjectRepo);
    }
    if (token === MarkPaymentAsPaidUseCase) {
      return new (MarkPaymentAsPaidUseCase as any)(mockPaymentRepo, mockInvoiceRepo);
    }
    if (token === RecordPaymentUseCase) {
      return new (RecordPaymentUseCase as any)(mockPaymentRepo, mockInvoiceRepo);
    }
    if (token === AssignProjectToPaymentRecordUseCase) {
      return new (AssignProjectToPaymentRecordUseCase as any)(mockPaymentRepo, mockInvoiceRepo);
    }
    return {};
  });

  mockUseNavigation.mockReturnValue({
    goBack: mockGoBack,
    dispatch: mockDispatch,
  } as any);

  mockUseQueryClient.mockReturnValue({
    invalidateQueries: mockInvalidateQueries,
  } as any);
});

/** Helper: sets up useRoute with paymentId param (most common case). */
function withPaymentId(paymentId: string = 'pay-123') {
  mockUseRoute.mockReturnValue({ params: { paymentId } } as any);
}

/** Helper: sets up useRoute with a syntheticRow param (no loading). */
function withSyntheticRow(row = SYNTHETIC_PAYMENT) {
  mockUseRoute.mockReturnValue({ params: { syntheticRow: row } } as any);
}

/** Helper: sets up useRoute with invoiceId param (invoice-only path). */
function withInvoiceId(invoiceId: string = 'inv-1') {
  mockUseRoute.mockReturnValue({ params: { invoiceId } } as any);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('usePaymentDetails', () => {
  // ── Loading state ───────────────────────────────────────────────────────────

  it('returns loading: true before loadData resolves when paymentId is provided without syntheticRow', () => {
    withPaymentId();
    // Make findById never resolve
    mockPaymentRepo.findById.mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => usePaymentDetails());

    expect(result.current.loading).toBe(true);
    expect(result.current.payment).toBeNull();
  });

  // ── Synthetic row pre-population ────────────────────────────────────────────

  it('when syntheticRow is in route params, vm.payment equals that row and loading: false immediately', async () => {
    withSyntheticRow(SYNTHETIC_PAYMENT);

    const { result } = renderHook(() => usePaymentDetails());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.payment).toEqual(SYNTHETIC_PAYMENT);
  });

  // ── Standalone payment load ─────────────────────────────────────────────────

  it('paymentRepo.findById is called with paymentId; returned data populates vm.payment', async () => {
    withPaymentId('pay-123');
    mockPaymentRepo.findById.mockResolvedValue(STANDALONE_PAYMENT);
    mockInvoiceRepo.getInvoice.mockResolvedValue(null);
    mockPaymentRepo.findByInvoice.mockResolvedValue([]);

    const { result } = renderHook(() => usePaymentDetails());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockPaymentRepo.findById).toHaveBeenCalledWith('pay-123');
    expect(result.current.payment).toEqual(STANDALONE_PAYMENT);
  });

  // ── Invoice-only path ───────────────────────────────────────────────────────

  it('invoice-only path: invoiceRepo.getInvoice and paymentRepo.findByInvoice are called; synthetic Payment constructed', async () => {
    withInvoiceId('inv-1');
    mockInvoiceRepo.getInvoice.mockResolvedValue(INVOICE_FIXTURE);
    mockPaymentRepo.findByInvoice.mockResolvedValue([]);
    mockProjectRepo.findById.mockResolvedValue(PROJECT_FIXTURE);

    const { result } = renderHook(() => usePaymentDetails());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockInvoiceRepo.getInvoice).toHaveBeenCalledWith('inv-1');
    expect(mockPaymentRepo.findByInvoice).toHaveBeenCalledWith('inv-1');
    expect(result.current.payment).not.toBeNull();
    expect(result.current.payment?.id).toBe('invoice-payable:inv-1');
  });

  // ── isSyntheticRow ──────────────────────────────────────────────────────────

  it('isSyntheticRow is true when payment.id starts with "invoice-payable:"', async () => {
    withSyntheticRow(SYNTHETIC_PAYMENT);

    const { result } = renderHook(() => usePaymentDetails());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isSyntheticRow).toBe(true);
  });

  it('isSyntheticRow is false for a regular payment id', async () => {
    withPaymentId('pay-123');
    mockPaymentRepo.findById.mockResolvedValue(STANDALONE_PAYMENT);
    mockInvoiceRepo.getInvoice.mockResolvedValue(null);

    const { result } = renderHook(() => usePaymentDetails());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isSyntheticRow).toBe(false);
  });

  // ── canRecordPayment ────────────────────────────────────────────────────────

  it('canRecordPayment is true when invoice is non-null, not cancelled, paymentStatus is unpaid, and remainingBalance > 0', async () => {
    withPaymentId('pay-123');
    mockPaymentRepo.findById.mockResolvedValue(PAYMENT_FIXTURE);
    mockInvoiceRepo.getInvoice.mockResolvedValue(INVOICE_FIXTURE);
    mockPaymentRepo.findByInvoice.mockResolvedValue([]);

    const { result } = renderHook(() => usePaymentDetails());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.canRecordPayment).toBe(true);
  });

  it('canRecordPayment is false when invoice is null', async () => {
    withPaymentId('pay-123');
    mockPaymentRepo.findById.mockResolvedValue(STANDALONE_PAYMENT);
    mockInvoiceRepo.getInvoice.mockResolvedValue(null);

    const { result } = renderHook(() => usePaymentDetails());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.canRecordPayment).toBe(false);
  });

  it('canRecordPayment is false when invoice.status is "cancelled"', async () => {
    withPaymentId('pay-123');
    mockPaymentRepo.findById.mockResolvedValue(PAYMENT_FIXTURE);
    mockInvoiceRepo.getInvoice.mockResolvedValue({
      ...INVOICE_FIXTURE,
      status: 'cancelled',
    });
    mockPaymentRepo.findByInvoice.mockResolvedValue([]);

    const { result } = renderHook(() => usePaymentDetails());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.canRecordPayment).toBe(false);
  });

  // ── showMarkAsPaidFallback ──────────────────────────────────────────────────

  it('showMarkAsPaidFallback is true for non-synthetic pending payment with no linked invoice', async () => {
    withPaymentId('pay-456');
    mockPaymentRepo.findById.mockResolvedValue(STANDALONE_PAYMENT);
    mockInvoiceRepo.getInvoice.mockResolvedValue(null);

    const { result } = renderHook(() => usePaymentDetails());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.showMarkAsPaidFallback).toBe(true);
  });

  it('showMarkAsPaidFallback is false when invoice is linked', async () => {
    withPaymentId('pay-123');
    mockPaymentRepo.findById.mockResolvedValue(PAYMENT_FIXTURE);
    mockInvoiceRepo.getInvoice.mockResolvedValue(INVOICE_FIXTURE);
    mockPaymentRepo.findByInvoice.mockResolvedValue([]);

    const { result } = renderHook(() => usePaymentDetails());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.showMarkAsPaidFallback).toBe(false);
  });

  // ── showEditIcon ────────────────────────────────────────────────────────────

  it('showEditIcon is true only for isPending && !isSyntheticRow', async () => {
    withPaymentId('pay-456');
    mockPaymentRepo.findById.mockResolvedValue(STANDALONE_PAYMENT);
    mockInvoiceRepo.getInvoice.mockResolvedValue(null);

    const { result } = renderHook(() => usePaymentDetails());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.isPending).toBe(true);
    expect(result.current.isSyntheticRow).toBe(false);
    expect(result.current.showEditIcon).toBe(true);
  });

  it('showEditIcon is false for a synthetic row even when isPending', async () => {
    withSyntheticRow(SYNTHETIC_PAYMENT);

    const { result } = renderHook(() => usePaymentDetails());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isSyntheticRow).toBe(true);
    expect(result.current.showEditIcon).toBe(false);
  });

  // ── totalSettled / remainingBalance ─────────────────────────────────────────

  it('totalSettled is sum of linkedPayments with status=settled', async () => {
    withPaymentId('pay-123');
    mockPaymentRepo.findById.mockResolvedValue(PAYMENT_FIXTURE);
    mockInvoiceRepo.getInvoice.mockResolvedValue(INVOICE_FIXTURE);
    mockPaymentRepo.findByInvoice.mockResolvedValue([
      { id: 'pay-99', status: 'settled', amount: 300 },
      { id: 'pay-98', status: 'pending', amount: 100 },
    ]);

    const { result } = renderHook(() => usePaymentDetails());
    await waitFor(() => expect(result.current.loading).toBe(false));

    // linkedPayments filters out the main payment (pay-123)
    // Both pay-99 and pay-98 remain (not pay-123)
    expect(result.current.totalSettled).toBe(300);
  });

  it('remainingBalance is invoice.total - totalSettled when invoice is non-null', async () => {
    withPaymentId('pay-123');
    mockPaymentRepo.findById.mockResolvedValue(PAYMENT_FIXTURE);
    mockInvoiceRepo.getInvoice.mockResolvedValue(INVOICE_FIXTURE); // total: 1000
    mockPaymentRepo.findByInvoice.mockResolvedValue([
      { id: 'pay-99', status: 'settled', amount: 200 },
    ]);

    const { result } = renderHook(() => usePaymentDetails());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.remainingBalance).toBe(800);
  });

  it('remainingBalance is 0 when invoice is null', async () => {
    withPaymentId('pay-456');
    mockPaymentRepo.findById.mockResolvedValue(STANDALONE_PAYMENT);
    mockInvoiceRepo.getInvoice.mockResolvedValue(null);

    const { result } = renderHook(() => usePaymentDetails());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.remainingBalance).toBe(0);
  });

  // ── handleMarkAsPaid (invoice path) ────────────────────────────────────────

  it('handleMarkAsPaid (invoice path): calls recordPaymentUc.execute with invoiceId, full remaining balance, status: settled', async () => {
    // Synthetic rows (isSyntheticRow=true) own the invoice-record path under the new design.
    withSyntheticRow(SYNTHETIC_PAYMENT);
    mockInvoiceRepo.getInvoice.mockResolvedValue(INVOICE_FIXTURE); // total: 1000
    mockPaymentRepo.findByInvoice.mockResolvedValue([]); // no prior settled payments

    const { result } = renderHook(() => usePaymentDetails());
    // Wait for loadData to populate derivedData (canRecordPayment, remainingBalance).
    await waitFor(() => expect(result.current.canRecordPayment).toBe(true));

    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

    act(() => { result.current.handleMarkAsPaid(); });

    expect(alertSpy).toHaveBeenCalled();
    const buttons = (alertSpy.mock.calls[0] as any)[2];
    const confirmBtn = buttons.find((b: any) => b.text === 'Confirm');
    expect(confirmBtn).toBeDefined();

    await act(async () => { await confirmBtn.onPress(); });

    expect(mockRecordPaymentExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceId: 'inv-1',
        amount: 1000, // full balance (no prior settled payments)
      }),
    );
    alertSpy.mockRestore();
  });

  // ── handleMarkAsPaid (standalone path) ─────────────────────────────────────

  it('handleMarkAsPaid (standalone path): calls markPaidUc.execute({ paymentId }) for non-synthetic pending payment with no invoice', async () => {
    withPaymentId('pay-456');
    mockPaymentRepo.findById.mockResolvedValue(STANDALONE_PAYMENT);
    mockInvoiceRepo.getInvoice.mockResolvedValue(null);

    const { result } = renderHook(() => usePaymentDetails());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(jest.fn());

    act(() => { result.current.handleMarkAsPaid(); });

    expect(alertSpy).toHaveBeenCalled();
    const buttons = (alertSpy.mock.calls[0] as any)[2];
    const confirmBtn = buttons.find((b: any) => b.text === 'Confirm');
    expect(confirmBtn).toBeDefined();

    await act(async () => { await confirmBtn.onPress(); });

    expect(mockMarkPaidExecute).toHaveBeenCalledWith(
      expect.objectContaining({ paymentId: 'pay-456' }),
    );
    expect(mockRecordPaymentExecute).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  // ── handlePartialPaymentSubmit ──────────────────────────────────────────────

  it('handlePartialPaymentSubmit (valid amount): calls recordPaymentUc.execute and clears modal state', async () => {
    withPaymentId('pay-123');
    mockPaymentRepo.findById.mockResolvedValue(PAYMENT_FIXTURE);
    mockInvoiceRepo.getInvoice.mockResolvedValue(INVOICE_FIXTURE); // total: 1000
    mockPaymentRepo.findByInvoice.mockResolvedValue([]);

    const { result } = renderHook(() => usePaymentDetails());
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Open partial modal and set amount
    act(() => { result.current.openPartialModal(); });
    act(() => { result.current.setPartialAmount('500'); });

    await act(async () => { await result.current.handlePartialPaymentSubmit(); });

    expect(mockRecordPaymentExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        invoiceId: 'inv-1',
        amount: 500,
      }),
    );
    expect(result.current.partialModalVisible).toBe(false);
    expect(result.current.partialAmount).toBe('');
    expect(result.current.partialAmountError).toBe('');
  });

  it('handlePartialPaymentSubmit (invalid amount = 0): sets partialAmountError; does NOT call execute', async () => {
    withPaymentId('pay-123');
    mockPaymentRepo.findById.mockResolvedValue(PAYMENT_FIXTURE);
    mockInvoiceRepo.getInvoice.mockResolvedValue(INVOICE_FIXTURE);
    mockPaymentRepo.findByInvoice.mockResolvedValue([]);

    const { result } = renderHook(() => usePaymentDetails());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => { result.current.setPartialAmount('0'); });

    await act(async () => { await result.current.handlePartialPaymentSubmit(); });

    expect(result.current.partialAmountError).toBeTruthy();
    expect(mockRecordPaymentExecute).not.toHaveBeenCalled();
  });

  it('handlePartialPaymentSubmit (amount > balance): sets partialAmountError; does NOT call execute', async () => {
    withPaymentId('pay-123');
    mockPaymentRepo.findById.mockResolvedValue(PAYMENT_FIXTURE);
    mockInvoiceRepo.getInvoice.mockResolvedValue(INVOICE_FIXTURE); // total: 1000
    mockPaymentRepo.findByInvoice.mockResolvedValue([]);

    const { result } = renderHook(() => usePaymentDetails());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => { result.current.setPartialAmount('1500'); }); // > 1000 balance

    await act(async () => { await result.current.handlePartialPaymentSubmit(); });

    expect(result.current.partialAmountError).toBeTruthy();
    expect(mockRecordPaymentExecute).not.toHaveBeenCalled();
  });

  // ── handleSelectProject (standalone payment) ──────────────────────────────

  it('handleSelectProject (standalone payment): calls assignProjectUc.execute with recordContext standalone-payment and paymentId', async () => {
    withPaymentId('pay-456');
    mockPaymentRepo.findById.mockResolvedValue(STANDALONE_PAYMENT);
    mockInvoiceRepo.getInvoice.mockResolvedValue(null);

    const { result } = renderHook(() => usePaymentDetails());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.handleSelectProject({ id: 'proj-2', name: 'Granny Flat' } as any);
    });

    expect(mockAssignProjectExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        recordContext: 'standalone-payment',
        targetId: 'pay-456',
        projectId: 'proj-2',
      }),
    );
  });

  // ── handleSelectProject (synthetic row) ────────────────────────────────────

  it('handleSelectProject (synthetic row): calls assignProjectUc.execute with recordContext synthetic-invoice and invoiceId', async () => {
    withSyntheticRow(SYNTHETIC_PAYMENT);
    mockPaymentRepo.findByInvoice.mockResolvedValue([]);
    mockInvoiceRepo.getInvoice.mockResolvedValue(INVOICE_FIXTURE);

    const { result } = renderHook(() => usePaymentDetails());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.handleSelectProject({ id: 'proj-2', name: 'Granny Flat' } as any);
    });

    expect(mockAssignProjectExecute).toHaveBeenCalledWith(
      expect.objectContaining({
        recordContext: 'synthetic-invoice',
        targetId: 'inv-1',
        projectId: 'proj-2',
      }),
    );
  });

  // ── goBack ──────────────────────────────────────────────────────────────────

  it('goBack calls navigation.goBack()', async () => {
    withPaymentId('pay-123');

    const { result } = renderHook(() => usePaymentDetails());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => { result.current.goBack(); });

    expect(mockGoBack).toHaveBeenCalled();
  });

  // ── handleNavigateToProject ─────────────────────────────────────────────────

  it('handleNavigateToProject dispatches CommonActions.navigate to Projects → ProjectDetail with resolvedProjectId', async () => {
    withPaymentId('pay-123');
    mockPaymentRepo.findById.mockResolvedValue(PAYMENT_FIXTURE); // projectId: 'proj-1'
    mockInvoiceRepo.getInvoice.mockResolvedValue(null);

    const { result } = renderHook(() => usePaymentDetails());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => { result.current.handleNavigateToProject(); });

    expect(mockDispatch).toHaveBeenCalled();
    const dispatchArg = mockDispatch.mock.calls[0][0];
    expect(dispatchArg).toEqual(
      expect.objectContaining({
        payload: expect.objectContaining({
          name: 'Projects',
          params: expect.objectContaining({
            screen: 'ProjectDetail',
            params: expect.objectContaining({ projectId: 'proj-1' }),
          }),
        }),
      }),
    );
  });

  // ── setPartialAmount ────────────────────────────────────────────────────────

  it('setPartialAmount clears partialAmountError to empty string', async () => {
    withPaymentId('pay-123');
    mockPaymentRepo.findById.mockResolvedValue(PAYMENT_FIXTURE);
    mockInvoiceRepo.getInvoice.mockResolvedValue(INVOICE_FIXTURE);
    mockPaymentRepo.findByInvoice.mockResolvedValue([]);

    const { result } = renderHook(() => usePaymentDetails());
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Trigger validation error by submitting 0 amount
    act(() => { result.current.setPartialAmount('0'); });
    await act(async () => { await result.current.handlePartialPaymentSubmit(); });
    expect(result.current.partialAmountError).toBeTruthy();

    // Now call setPartialAmount — should clear error
    act(() => { result.current.setPartialAmount('500'); });
    expect(result.current.partialAmountError).toBe('');
  });

  // ── GetPaymentDetailsUseCase discriminated input resolution ─────────────────

  describe('loadData — getDetailsUc.execute() discriminated input', () => {
    it('calls execute with { paymentId } when route has paymentId', async () => {
      withPaymentId('pay-123');
      mockPaymentRepo.findById.mockResolvedValue(STANDALONE_PAYMENT);
      mockInvoiceRepo.getInvoice.mockResolvedValue(null);

      const spy = jest.spyOn(GetPaymentDetailsUseCase.prototype, 'execute');

      const { result } = renderHook(() => usePaymentDetails());
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(spy).toHaveBeenCalledWith({ paymentId: 'pay-123' });
      spy.mockRestore();
    });

    it('calls execute with { invoiceId } when route has invoiceId', async () => {
      withInvoiceId('inv-1');
      mockInvoiceRepo.getInvoice.mockResolvedValue(INVOICE_FIXTURE);
      mockPaymentRepo.findByInvoice.mockResolvedValue([]);
      mockProjectRepo.findById.mockResolvedValue(PROJECT_FIXTURE);

      const spy = jest.spyOn(GetPaymentDetailsUseCase.prototype, 'execute');

      const { result } = renderHook(() => usePaymentDetails());
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(spy).toHaveBeenCalledWith({ invoiceId: 'inv-1' });
      spy.mockRestore();
    });

    it('calls execute with { syntheticRow } when route has syntheticRow', async () => {
      withSyntheticRow(SYNTHETIC_PAYMENT);

      const spy = jest.spyOn(GetPaymentDetailsUseCase.prototype, 'execute');

      const { result } = renderHook(() => usePaymentDetails());
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(spy).toHaveBeenCalledWith({ syntheticRow: SYNTHETIC_PAYMENT });
      spy.mockRestore();
    });

    it('state is populated from the DTO returned by execute', async () => {
      withPaymentId('pay-123');
      mockPaymentRepo.findById.mockResolvedValue(PAYMENT_FIXTURE);
      mockInvoiceRepo.getInvoice.mockResolvedValue(INVOICE_FIXTURE);
      mockPaymentRepo.findByInvoice.mockResolvedValue([]);
      mockProjectRepo.findById.mockResolvedValue(PROJECT_FIXTURE);

      const { result } = renderHook(() => usePaymentDetails());
      await waitFor(() => expect(result.current.loading).toBe(false));

      expect(result.current.payment).toEqual(PAYMENT_FIXTURE);
      expect(result.current.invoice).toEqual(INVOICE_FIXTURE);
      expect(result.current.project).toEqual(PROJECT_FIXTURE);
      expect(result.current.linkedPayments).toEqual([]);
      expect(result.current.isSyntheticRow).toBe(false);
    });
  });
});
