/**
 * Unit tests for useGlobalPaymentsScreen hook
 * Run: npx jest useGlobalPaymentsScreen
 */
import { act } from '@testing-library/react-native';
import { container } from 'tsyringe';
import { renderHookWithQuery } from '../../../../../__tests__/utils/queryClientWrapper';
import { useGlobalPaymentsScreen } from '../../hooks/useGlobalPaymentsScreen';
import type { PaymentWithProject } from '../../hooks/usePayments';
import type { Quotation } from '../../../../domain/entities/Quotation';
import type { Payment } from '../../../../domain/entities/Payment';

// ─── Mock dependencies (factories cannot reference module-scope variables) ──

jest.mock('../../hooks/usePayments', () => ({
  usePayments: jest.fn(),
}));

jest.mock('../../../../hooks/useGlobalQuotations', () => ({
  useGlobalQuotations: jest.fn(),
}));

jest.mock('../../application/ListGlobalPaymentsUseCase');

import { usePayments } from '../../hooks/usePayments';
import { useGlobalQuotations } from '../../../../hooks/useGlobalQuotations';
import { ListGlobalPaymentsUseCase } from '../../application/ListGlobalPaymentsUseCase';

// ─── Test data ───────────────────────────────────────────────────────────────

const mockRefresh = jest.fn();

const mockPendingPayments: PaymentWithProject[] = [
  {
    id: 'p1',
    amount: 1000,
    dueDate: '2026-01-01',
    status: 'pending',
    contractorName: 'Ace Builders',
  },
];

const mockQuotations: Quotation[] = [
  {
    id: 'q1',
    reference: 'QT-001',
    date: '2026-03-20',
    total: 5000,
    vendorName: 'Test Vendor',
    status: 'sent',
    currency: 'AUD',
    createdAt: '2026-03-20T00:00:00Z',
    updatedAt: '2026-03-20T00:00:00Z',
  },
];

const mockPaidPayments: Payment[] = [
  {
    id: 'paid1',
    amount: 500,
    date: '2026-02-01',
    status: 'settled',
  },
];

const mockPaymentRepo: any = {
  save: jest.fn(),
  findById: jest.fn(),
  findAll: jest.fn(),
  findByInvoice: jest.fn(),
  findByProjectId: jest.fn(),
  findPendingByProject: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  list: jest.fn().mockResolvedValue({ items: [], meta: { total: 0 } }),
  getMetrics: jest.fn(),
  getGlobalAmountPayable: jest.fn(),
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('useGlobalPaymentsScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    jest.spyOn(container, 'resolve').mockReturnValue(mockPaymentRepo);

    (usePayments as jest.Mock).mockReturnValue({
      globalPayments: mockPendingPayments,
      globalAmountPayable: 1000,
      loading: false,
      refresh: mockRefresh,
    });

    (useGlobalQuotations as jest.Mock).mockReturnValue({
      quotations: mockQuotations,
      loading: false,
      refresh: mockRefresh,
    });

    (ListGlobalPaymentsUseCase as any).prototype.execute = jest
      .fn()
      .mockResolvedValue({ items: mockPaidPayments, meta: { total: 1 } });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('defaults to filter=pending', () => {
    const { result } = renderHookWithQuery(() => useGlobalPaymentsScreen());
    expect(result.current.filter).toBe('pending');
  });

  it('setFilter transitions to "paid"', () => {
    const { result } = renderHookWithQuery(() => useGlobalPaymentsScreen());

    act(() => {
      result.current.setFilter('paid');
    });

    expect(result.current.filter).toBe('paid');
  });

  it('setFilter transitions to "quotations"', () => {
    const { result } = renderHookWithQuery(() => useGlobalPaymentsScreen());

    act(() => {
      result.current.setFilter('quotations');
    });

    expect(result.current.filter).toBe('quotations');
  });

  it('setFilter transitions to "all"', () => {
    const { result } = renderHookWithQuery(() => useGlobalPaymentsScreen());

    act(() => {
      result.current.setFilter('all');
    });

    expect(result.current.filter).toBe('all');
  });

  it('setFilter can cycle through all options', () => {
    const { result } = renderHookWithQuery(() => useGlobalPaymentsScreen());

    act(() => { result.current.setFilter('paid'); });
    expect(result.current.filter).toBe('paid');

    act(() => { result.current.setFilter('quotations'); });
    expect(result.current.filter).toBe('quotations');

    act(() => { result.current.setFilter('all'); });
    expect(result.current.filter).toBe('all');

    act(() => { result.current.setFilter('pending'); });
    expect(result.current.filter).toBe('pending');
  });

  it('search defaults to empty string', () => {
    const { result } = renderHookWithQuery(() => useGlobalPaymentsScreen());
    expect(result.current.search).toBe('');
  });

  it('setSearch updates search value', () => {
    const { result } = renderHookWithQuery(() => useGlobalPaymentsScreen());

    act(() => {
      result.current.setSearch('Smith');
    });

    expect(result.current.search).toBe('Smith');
  });

  it('exposes quotations from useGlobalQuotations', () => {
    const { result } = renderHookWithQuery(() => useGlobalPaymentsScreen());
    expect(result.current.quotations).toEqual(mockQuotations);
  });

  it('exposes pendingPayments as array', () => {
    const { result } = renderHookWithQuery(() => useGlobalPaymentsScreen());
    expect(Array.isArray(result.current.pendingPayments)).toBe(true);
  });

  it('exposes paidPayments as array', () => {
    const { result } = renderHookWithQuery(() => useGlobalPaymentsScreen());
    expect(Array.isArray(result.current.paidPayments)).toBe(true);
  });

  it('exposes amountPayable as number', () => {
    const { result } = renderHookWithQuery(() => useGlobalPaymentsScreen());
    expect(typeof result.current.amountPayable).toBe('number');
  });

  it('exposes amountPayable equal to globalAmountPayable from usePayments', () => {
    const { result } = renderHookWithQuery(() => useGlobalPaymentsScreen());
    expect(result.current.amountPayable).toBe(1000);
  });

  it('exposes loading boolean', () => {
    const { result } = renderHookWithQuery(() => useGlobalPaymentsScreen());
    expect(typeof result.current.loading).toBe('boolean');
  });

  it('exposes a refresh function', () => {
    const { result } = renderHookWithQuery(() => useGlobalPaymentsScreen());
    expect(typeof result.current.refresh).toBe('function');
  });
});

