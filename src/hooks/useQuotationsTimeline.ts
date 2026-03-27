/**
 * useQuotationsTimeline
 *
 * Fetches quotations for a project (aggregated across all tasks) and groups
 * them into day buckets for the project detail timeline.
 *
 * Cache key: queryKeys.projectQuotations(projectId)
 */

import { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { container } from 'tsyringe';
import { Quotation } from '../domain/entities/Quotation';
import { QuotationRepository } from '../domain/repositories/QuotationRepository';
import { ListProjectQuotationsUseCase } from '../application/usecases/quotation/ListProjectQuotationsUseCase';
import { queryKeys } from './queryKeys';
import '../infrastructure/di/registerServices';

// ─── Public types ─────────────────────────────────────────────────────────────

/** A single day bucket with its quotations sorted by date ascending. */
export interface QuotationDayGroup {
  /** ISO date string YYYY-MM-DD, or '__nodate__' */
  date: string;
  /** Human-readable label, e.g. "Thu 20 Mar" */
  label: string;
  quotations: Quotation[];
}

export interface UseQuotationsTimelineReturn {
  quotationDayGroups: QuotationDayGroup[];
  loading: boolean;
  error: string | null;
  truncated: boolean;
  invalidate: () => Promise<void>;
}

// ─── Pure grouping helpers (exported for unit testing) ───────────────────────

/** Extract YYYY-MM-DD key from a Quotation using Quotation.date. */
export function getQuotationDateKey(quotation: Quotation): string | null {
  if (!quotation.date) return null;
  return quotation.date.slice(0, 10);
}

/** Format a YYYY-MM-DD string as "Thu 20 Mar". */
function formatQuotationDayLabel(dateKey: string): string {
  const d = new Date(`${dateKey}T00:00:00Z`);
  const weekday = d.toLocaleDateString('en-AU', { weekday: 'short', timeZone: 'UTC' });
  const day = d.getUTCDate();
  const month = d.toLocaleDateString('en-AU', { month: 'short', timeZone: 'UTC' });
  return `${weekday} ${day} ${month}`;
}

/** Group and sort quotations into QuotationDayGroup[]. No-date quotations trail at the end. */
export function groupQuotationsByDay(quotations: Quotation[]): QuotationDayGroup[] {
  const buckets = new Map<string, Quotation[]>();

  for (const quotation of quotations) {
    const key = getQuotationDateKey(quotation) ?? '__nodate__';
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(quotation);
  }

  const sortKey = (q: Quotation): number =>
    q.date ? new Date(q.date).getTime() : 0;

  const groups: QuotationDayGroup[] = [];

  const dateBuckets = [...buckets.entries()]
    .filter(([k]) => k !== '__nodate__')
    .sort(([a], [b]) => a.localeCompare(b));

  for (const [date, quotationsInBucket] of dateBuckets) {
    groups.push({
      date,
      label: formatQuotationDayLabel(date),
      quotations: [...quotationsInBucket].sort((a, b) => sortKey(a) - sortKey(b)),
    });
  }

  const undated = buckets.get('__nodate__');
  if (undated?.length) {
    groups.push({ date: '__nodate__', label: 'No Date', quotations: undated });
  }

  return groups;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useQuotationsTimeline(projectId: string): UseQuotationsTimelineReturn {
  const queryClient = useQueryClient();

  const quotationRepository = useMemo(
    () => container.resolve<QuotationRepository>('QuotationRepository'),
    [],
  );

  const listUseCase = useMemo(
    () => new ListProjectQuotationsUseCase(quotationRepository),
    [quotationRepository],
  );

  const {
    data,
    isLoading,
    error: queryError,
  } = useQuery({
    queryKey: queryKeys.projectQuotations(projectId),
    queryFn: () => listUseCase.execute(projectId),
    staleTime: 30_000,
    enabled: Boolean(projectId),
  });

  const truncated = data?.truncated ?? false;

  const quotationDayGroups = useMemo(
    () => {
      const quotations = data?.quotations ?? [];
      return groupQuotationsByDay(quotations);
    },
    [data?.quotations],
  );

  const invalidate = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.projectQuotations(projectId) });
  }, [queryClient, projectId]);

  const error = queryError instanceof Error
    ? queryError.message
    : queryError ? String(queryError) : null;

  return useMemo(
    () => ({ quotationDayGroups, loading: isLoading, error, truncated, invalidate }),
    [quotationDayGroups, isLoading, error, truncated, invalidate],
  );
}
