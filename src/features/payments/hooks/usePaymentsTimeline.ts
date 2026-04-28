/**
 * usePaymentsTimeline
 *
 * Fetches the unified payments feed (unlinked payments + all invoices) for a
 * project and groups them into day buckets for the project detail timeline.
 * Exposes a recordPayment mutation that invalidates the appropriate query keys.
 *
 * Cache key: queryKeys.projectPayments(projectId)
 */

import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { container } from 'tsyringe';
import { Payment } from '../../../domain/entities/Payment';
import { PaymentFeedItem } from '../domain/PaymentFeedItem';
import { PaymentRepository } from '../../../domain/repositories/PaymentRepository';
import { InvoiceRepository } from '../../../domain/repositories/InvoiceRepository';
import { ListProjectPaymentsFeedUseCase } from '../application/ListProjectPaymentsFeedUseCase';
import { queryKeys, invalidations } from '../../../hooks/queryKeys';
import '../../../infrastructure/di/registerServices';

// Re-export for consumers
export type { PaymentFeedItem };

// ─── Public types ─────────────────────────────────────────────────────────────

/** A single day bucket with its feed items sorted by dueDate ascending. */
export interface PaymentDayGroup {
  /** ISO date string YYYY-MM-DD, or '__nodate__' */
  date: string;
  /** Human-readable label, e.g. "Thu 20 Mar" */
  label: string;
  items: PaymentFeedItem[];
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

/** Extract YYYY-MM-DD key from a PaymentFeedItem. */
export function getFeedItemDateKey(item: PaymentFeedItem): string | null {
  if (item.kind === 'payment') {
    const raw = item.data.dueDate ?? item.data.date;
    return raw ? raw.slice(0, 10) : null;
  }
  // invoice: dateDue ?? dueDate alias ?? issueDate alias
  const raw = item.data.dateDue ?? item.data.dueDate ?? item.data.issueDate;
  return raw ? raw.slice(0, 10) : null;
}

/** Format a YYYY-MM-DD string as "Thu 20 Mar". */
function formatDayLabel(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  const weekday = d.toLocaleDateString('en-AU', { weekday: 'short', timeZone: 'UTC' });
  const day = d.getUTCDate();
  const month = d.toLocaleDateString('en-AU', { month: 'short', timeZone: 'UTC' });
  return `${weekday} ${day} ${month}`;
}

/** Group and sort PaymentFeedItems into PaymentDayGroup[]. No-date items trail at the end. */
export function groupFeedItemsByDay(items: PaymentFeedItem[]): PaymentDayGroup[] {
  const buckets = new Map<string, PaymentFeedItem[]>();

  for (const item of items) {
    const key = getFeedItemDateKey(item) ?? '__nodate__';
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(item);
  }

  const groups: PaymentDayGroup[] = [];

  const dateBuckets = [...buckets.entries()]
    .filter(([k]) => k !== '__nodate__')
    .sort(([a], [b]) => a.localeCompare(b));

  for (const [date, itemsInBucket] of dateBuckets) {
    groups.push({
      date,
      label: formatDayLabel(date),
      items: itemsInBucket,
    });
  }

  const undated = buckets.get('__nodate__');
  if (undated?.length) {
    groups.push({ date: '__nodate__', label: 'No Date', items: undated });
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

  const invoiceRepository = useMemo(
    () => container.resolve<InvoiceRepository>('InvoiceRepository'),
    [],
  );

  const listUseCase = useMemo(
    () => new ListProjectPaymentsFeedUseCase(paymentRepository, invoiceRepository),
    [paymentRepository, invoiceRepository],
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

  const feedItems = useMemo(() => data?.items ?? [], [data?.items]);
  const truncated = data?.truncated ?? false;

  const paymentDayGroups = useMemo(() => groupFeedItemsByDay(feedItems), [feedItems]);

  const recordPayment = useCallback(
    async (_payment: Payment) => {
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
