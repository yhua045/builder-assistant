/**
 * usePaymentsTimeline
 *
 * Fetches payments for a project and groups them into day buckets
 * for the project detail timeline. Exposes a recordPayment mutation
 * that invalidates the appropriate query keys.
 *
 * Cache key: queryKeys.projectPayments(projectId)
 */

import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { container } from 'tsyringe';
import { Payment } from '../domain/entities/Payment';
import { PaymentRepository } from '../domain/repositories/PaymentRepository';
import { ListProjectPaymentsUseCase } from '../application/usecases/payment/ListProjectPaymentsUseCase';
import { queryKeys, invalidations } from './queryKeys';
import '../infrastructure/di/registerServices';

// ─── Public types ─────────────────────────────────────────────────────────────

/** A single day bucket with its payments sorted by dueDate ascending. */
export interface PaymentDayGroup {
  /** ISO date string YYYY-MM-DD, or '__nodate__' */
  date: string;
  /** Human-readable label, e.g. "Thu 20 Mar" */
  label: string;
  payments: Payment[];
}

export interface UsePaymentsTimelineReturn {
  paymentDayGroups: PaymentDayGroup[];
  loading: boolean;
  error: string | null;
  truncated: boolean;
  recordPayment: (payment: Payment) => Promise<void>;
  invalidate: () => Promise<void>;
}

// ─── Pure grouping helpers (exported for unit testing) ───────────────────────

/** Extract YYYY-MM-DD key from a Payment using dueDate ?? date. */
export function getPaymentDateKey(payment: Payment): string | null {
  const raw = payment.dueDate ?? payment.date;
  if (!raw) return null;
  return raw.slice(0, 10);
}

/** Format a YYYY-MM-DD string as "Thu 20 Mar". */
function formatPaymentDayLabel(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  const weekday = d.toLocaleDateString('en-AU', { weekday: 'short', timeZone: 'UTC' });
  const day = d.getUTCDate();
  const month = d.toLocaleDateString('en-AU', { month: 'short', timeZone: 'UTC' });
  return `${weekday} ${day} ${month}`;
}

/** Group and sort payments into PaymentDayGroup[]. No-date payments trail at the end. */
export function groupPaymentsByDay(payments: Payment[]): PaymentDayGroup[] {
  const buckets = new Map<string, Payment[]>();

  for (const payment of payments) {
    const key = getPaymentDateKey(payment) ?? '__nodate__';
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(payment);
  }

  const sortKey = (p: Payment): number => {
    const raw = p.dueDate ?? p.date;
    return raw ? new Date(raw).getTime() : 0;
  };

  const groups: PaymentDayGroup[] = [];

  const dateBuckets = [...buckets.entries()]
    .filter(([k]) => k !== '__nodate__')
    .sort(([a], [b]) => a.localeCompare(b));

  for (const [date, paymentsInBucket] of dateBuckets) {
    groups.push({
      date,
      label: formatPaymentDayLabel(date),
      payments: [...paymentsInBucket].sort((a, b) => sortKey(a) - sortKey(b)),
    });
  }

  const undated = buckets.get('__nodate__');
  if (undated?.length) {
    groups.push({ date: '__nodate__', label: 'No Date', payments: undated });
  }

  return groups;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePaymentsTimeline(projectId: string): UsePaymentsTimelineReturn {
  const queryClient = useQueryClient();

  const paymentRepository = useMemo(
    () => container.resolve<PaymentRepository>('PaymentRepository'),
    [],
  );

  const listUseCase = useMemo(
    () => new ListProjectPaymentsUseCase(paymentRepository),
    [paymentRepository],
  );

  const {
    data,
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: queryKeys.projectPayments(projectId),
    queryFn: () => listUseCase.execute(projectId),
    staleTime: 30_000,
    enabled: Boolean(projectId),
  });

  const payments = data?.payments ?? [];
  const truncated = data?.truncated ?? false;

  const paymentDayGroups = useMemo(() => groupPaymentsByDay(payments), [payments]);

  const recordPayment = useCallback(
    async (payment: Payment) => {
      // Persist is handled by the caller (e.g. RecordPaymentSheet).
      // This helper only invalidates the relevant cache keys.
      await Promise.all(
        invalidations
          .paymentRecorded({ projectId })
          .map((key) => queryClient.invalidateQueries({ queryKey: key })),
      );
    },
    [queryClient, projectId],
  );

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.projectPayments(projectId) });
  }, [queryClient, projectId]);

  const error = queryError instanceof Error
    ? queryError.message
    : queryError ? String(queryError) : null;

  return useMemo(
    () => ({ paymentDayGroups, loading: isLoading, error, truncated, recordPayment, invalidate }),
    [paymentDayGroups, isLoading, error, truncated, recordPayment, invalidate],
  );
}
