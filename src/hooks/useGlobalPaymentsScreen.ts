import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { container } from 'tsyringe';
import { Quotation } from '../domain/entities/Quotation';
import { Payment } from '../domain/entities/Payment';
import { PaymentRepository } from '../domain/repositories/PaymentRepository';
import { ListGlobalPaymentsUseCase } from '../application/usecases/payment/ListGlobalPaymentsUseCase';
import { usePayments, PaymentWithProject } from './usePayments';
import { useGlobalQuotations } from './useGlobalQuotations';
import { sortByPaymentPriority, sortByPaidDateDesc } from '../utils/sortByPaymentPriority';
import { queryKeys } from './queryKeys';
import '../infrastructure/di/registerServices';

export type PaymentsFilterOption = 'quotations' | 'pending' | 'paid' | 'all';

export interface UseGlobalPaymentsScreenOptions {
  /** Override payment repo for testing */
  paymentRepoOverride?: PaymentRepository;
}

export interface UseGlobalPaymentsScreenReturn {
  // Filter state
  filter: PaymentsFilterOption;
  setFilter: (option: PaymentsFilterOption) => void;

  // Search
  search: string;
  setSearch: (q: string) => void;

  // Quotations (filter === 'quotations')
  quotations: Quotation[];

  // Payments
  pendingPayments: PaymentWithProject[];   // priority-sorted
  paidPayments: Payment[];                 // paid-date-desc sorted
  amountPayable: number;                   // sum of pending amounts

  // Loading / refresh
  loading: boolean;
  refresh: () => void;
}

export function useGlobalPaymentsScreen(
  options?: UseGlobalPaymentsScreenOptions,
): UseGlobalPaymentsScreenReturn {
  const [filter, setFilter] = useState<PaymentsFilterOption>('pending');
  const [search, setSearch] = useState('');

  const queryClient = useQueryClient();

  // ── Quotations data ──────────────────────────────────────────────────────
  const { quotations, loading: quotationsLoading, refresh: refreshQuotations } =
    useGlobalQuotations({ vendorSearch: filter === 'quotations' ? search : undefined });

  // ── Pending payments data (firefighter mode) ─────────────────────────────
  const {
    globalPayments,
    globalAmountPayable,
    loading: pendingLoading,
    refresh: refreshPending,
  } = usePayments({
    mode: 'firefighter',
    contractorSearch: filter !== 'quotations' ? search : undefined,
  });

  // ── Paid payments data ───────────────────────────────────────────────────
  const paymentRepo = useMemo(
    () =>
      options?.paymentRepoOverride ??
      container.resolve<PaymentRepository>('PaymentRepository' as any),
     
    [options?.paymentRepoOverride],
  );
  const listGlobalUc = useMemo(
    () => new ListGlobalPaymentsUseCase(paymentRepo),
    [paymentRepo],
  );

  const paidSearch = filter !== 'quotations' ? search : undefined;

  const { data: paidData, isFetching: paidFetching } = useQuery({
    queryKey: queryKeys.paidPaymentsGlobal(paidSearch),
    queryFn: async () => {
      const result = await listGlobalUc.execute({
        status: 'settled',
        contractorSearch: paidSearch,
      });
      return result.items;
    },
    staleTime: Infinity,
  });

  // ── Derived / sorted results ─────────────────────────────────────────────
  const pendingPayments = useMemo(
    () => sortByPaymentPriority(globalPayments ?? []),
    [globalPayments],
  );

  const paidPayments = useMemo(
    () => sortByPaidDateDesc(paidData ?? []),
    [paidData],
  );

  // ── Refresh all queries ──────────────────────────────────────────────────
  const refresh = () => {
    refreshPending();
    refreshQuotations();
    queryClient.invalidateQueries({ queryKey: queryKeys.paidPaymentsGlobal() });
  };

  const loading = pendingLoading || quotationsLoading || paidFetching;

  return {
    filter,
    setFilter,
    search,
    setSearch,
    quotations,
    pendingPayments,
    paidPayments,
    amountPayable: globalAmountPayable,
    loading,
    refresh,
  };
}
