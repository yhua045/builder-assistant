/**
 * useQuotationTimeline
 *
 * Fetches all quotations for a project, groups them into QuoteDayGroup[],
 * and provides a pending-only filter (default) with a "show all" toggle.
 *
 * Follows the same structural pattern as useProjectTimeline (tasks) and
 * usePayments — each ProjectDetail section owns its dedicated hook.
 *
 * Cache strategy: uses queryKeys.quotationsByProject(projectId) so any
 * mutation that invalidates that key automatically refreshes this hook.
 */

import { useCallback, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { container } from 'tsyringe';
import { Quotation } from '../domain/entities/Quotation';
import { QuotationRepository } from '../domain/repositories/QuotationRepository';
import { InvoiceRepository } from '../domain/repositories/InvoiceRepository';
import { TaskRepository } from '../domain/repositories/TaskRepository';
import { AcceptStandaloneQuotationUseCase } from '../application/usecases/quotation/AcceptStandaloneQuotationUseCase';
import { UpdateQuotationUseCase } from '../application/usecases/quotation/UpdateQuotationUseCase';
import { formatDayLabel } from './useProjectTimeline';
import { queryKeys, invalidations } from './queryKeys';
import '../infrastructure/di/registerServices';

// ─── Public types ─────────────────────────────────────────────────────────────

export type QuotationStatusFilter = 'pending' | 'all';

/** A single day bucket with its quotations sorted by .date asc. */
export interface QuoteDayGroup {
  /** ISO date string YYYY-MM-DD, or '__nodate__' */
  date: string;
  /** Human-readable label, e.g. "Thu 20 Mar" */
  label: string;
  quotations: Quotation[];
}

export interface UseQuotationTimelineReturn {
  /** Quotations filtered by statusFilter, grouped by day */
  quoteDayGroups: QuoteDayGroup[];
  /** Always the full unfiltered set — used for total count badge */
  allQuoteDayGroups: QuoteDayGroup[];
  /** Count of status === 'sent' (pending) quotations */
  pendingCount: number;
  /** Count of all project quotations */
  totalCount: number;
  /** Sum of .total for non-declined quotes in the current filtered view */
  visibleTotal: number;
  /** Defaults to 'pending'; 'all' shows all statuses */
  statusFilter: QuotationStatusFilter;
  setStatusFilter: (f: QuotationStatusFilter) => void;
  loading: boolean;
  error: string | null;
  acceptQuotation: (quotation: Quotation) => Promise<void>;
  rejectQuotation: (quotation: Quotation) => Promise<void>;
  invalidateQuotes: () => Promise<void>;
}

// ─── Pure grouping helpers (exported for unit testing) ────────────────────────

/** Extract a YYYY-MM-DD bucket key from a quotation's .date field. */
export function getQuotationDateKey(quotation: Quotation): string | null {
  if (!quotation.date) return null;
  return quotation.date.slice(0, 10);
}

/** Group and sort quotations into QuoteDayGroup[]. Undated → trailing '__nodate__' bucket. */
export function groupQuotationsByDay(quotations: Quotation[]): QuoteDayGroup[] {
  const buckets = new Map<string, Quotation[]>();

  for (const q of quotations) {
    const key = getQuotationDateKey(q) ?? '__nodate__';
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(q);
  }

  const sortKey = (q: Quotation): number =>
    q.date ? new Date(q.date).getTime() : 0;

  const groups: QuoteDayGroup[] = [];

  // Dated buckets — ascending by date
  const dateBuckets = [...buckets.entries()]
    .filter(([k]) => k !== '__nodate__')
    .sort(([a], [b]) => a.localeCompare(b));

  for (const [date, qs] of dateBuckets) {
    groups.push({
      date,
      label: formatDayLabel(date),
      quotations: [...qs].sort((a, b) => sortKey(a) - sortKey(b)),
    });
  }

  // Undated quotations appended last
  const undated = buckets.get('__nodate__');
  if (undated?.length) {
    groups.push({ date: '__nodate__', label: 'No Date', quotations: undated });
  }

  return groups;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useQuotationTimeline(projectId: string): UseQuotationTimelineReturn {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<QuotationStatusFilter>('pending');

  const quotationRepo = useMemo(
    () => container.resolve<QuotationRepository>('QuotationRepository'),
    [],
  );
  const invoiceRepo = useMemo(
    () => container.resolve<InvoiceRepository>('InvoiceRepository'),
    [],
  );
  const taskRepo = useMemo(
    () => container.resolve<TaskRepository>('TaskRepository'),
    [],
  );

  const acceptStandaloneUseCase = useMemo(
    () => new AcceptStandaloneQuotationUseCase(invoiceRepo, quotationRepo),
    [invoiceRepo, quotationRepo],
  );
  const updateQuotationUseCase = useMemo(
    () => new UpdateQuotationUseCase(quotationRepo),
    [quotationRepo],
  );

  // ── Quotations query ──────────────────────────────────────────────────────
  const {
    data: allQuotations = [],
    isLoading: loading,
    error: queryError,
  } = useQuery<Quotation[]>({
    queryKey: queryKeys.quotationsByProject(projectId),
    queryFn: async () => {
      const result = await quotationRepo.listQuotations({ projectId });
      return result.items;
    },
    staleTime: 30_000,
    enabled: Boolean(projectId),
  });

  // ── Derived data ──────────────────────────────────────────────────────────

  const allQuoteDayGroups = useMemo(
    () => groupQuotationsByDay(allQuotations),
    [allQuotations],
  );

  const filteredQuotations = useMemo(
    () =>
      statusFilter === 'pending'
        ? allQuotations.filter((q) => q.status === 'sent')
        : allQuotations,
    [allQuotations, statusFilter],
  );

  const quoteDayGroups = useMemo(
    () => groupQuotationsByDay(filteredQuotations),
    [filteredQuotations],
  );

  const pendingCount = useMemo(
    () => allQuotations.filter((q) => q.status === 'sent').length,
    [allQuotations],
  );

  const totalCount = allQuotations.length;

  const visibleTotal = useMemo(
    () =>
      filteredQuotations
        .filter((q) => q.status !== 'declined')
        .reduce((sum, q) => sum + (q.total ?? 0), 0),
    [filteredQuotations],
  );

  // ── Mutations ─────────────────────────────────────────────────────────────

  const acceptQuotation = useCallback(
    async (quotation: Quotation): Promise<void> => {
      if (quotation.taskId) {
        // Task-linked: delegate to task repo path (mirrors useAcceptQuote)
        const task = await taskRepo.findById(quotation.taskId);
        if (!task) throw new Error('TASK_NOT_FOUND');
        const AcceptQuotationUseCase = (
          await import('../application/usecases/quotation/AcceptQuotationUseCase')
        ).AcceptQuotationUseCase;
        const useCase = new AcceptQuotationUseCase(invoiceRepo, taskRepo, quotationRepo);
        await useCase.execute({
          quotationId: quotation.id,
          taskId: quotation.taskId,
          task: {
            title: task.title,
            projectId: task.projectId,
            quoteAmount: task.quoteAmount ?? quotation.total,
            taskType: task.taskType,
            workType: task.workType,
            subcontractorId: task.subcontractorId,
          },
        });
        // Invalidate task-scoped keys (acceptQuotation) + project-scoped keys
        const taskKeys = invalidations.acceptQuotation({
          projectId,
          taskId: quotation.taskId,
        });
        const projectKeys = invalidations.quotationProjectMutated({ projectId });
        await Promise.all(
          [...taskKeys, ...projectKeys].map((key) =>
            queryClient.invalidateQueries({ queryKey: key }),
          ),
        );
      } else {
        // Standalone: create invoice from quotation data
        await acceptStandaloneUseCase.execute({ quotationId: quotation.id, projectId });
        const keys = [
          ...invalidations.quotationProjectMutated({ projectId }),
          ...invalidations.invoiceMutated({ projectId }),
        ];
        await Promise.all(
          keys.map((key) => queryClient.invalidateQueries({ queryKey: key })),
        );
      }
    },
    [
      taskRepo,
      invoiceRepo,
      quotationRepo,
      acceptStandaloneUseCase,
      queryClient,
      projectId,
    ],
  );

  const rejectQuotation = useCallback(
    async (quotation: Quotation): Promise<void> => {
      if (quotation.taskId) {
        // Task-linked: update task.quoteStatus = 'rejected' (mirrors useAcceptQuote)
        const task = await taskRepo.findById(quotation.taskId);
        if (!task) throw new Error('TASK_NOT_FOUND');
        await taskRepo.update({
          ...task,
          quoteStatus: 'rejected',
          updatedAt: new Date().toISOString(),
        });
        const taskKeys = invalidations.rejectQuotation({
          projectId,
          taskId: quotation.taskId,
        });
        const projectKeys = invalidations.quotationProjectMutated({ projectId });
        await Promise.all(
          [...taskKeys, ...projectKeys].map((key) =>
            queryClient.invalidateQueries({ queryKey: key }),
          ),
        );
      } else {
        // Standalone: update quotation.status = 'declined'
        await updateQuotationUseCase.execute(quotation.id, {
          status: 'declined',
          updatedAt: new Date().toISOString(),
        });
        const keys = invalidations.quotationProjectMutated({ projectId });
        await Promise.all(
          keys.map((key) => queryClient.invalidateQueries({ queryKey: key })),
        );
      }
    },
    [taskRepo, updateQuotationUseCase, queryClient, projectId],
  );

  const invalidateQuotes = useCallback(async () => {
    await queryClient.invalidateQueries({
      queryKey: queryKeys.quotationsByProject(projectId),
    });
  }, [queryClient, projectId]);

  const error =
    queryError instanceof Error
      ? queryError.message
      : queryError
      ? String(queryError)
      : null;

  return useMemo(
    () => ({
      quoteDayGroups,
      allQuoteDayGroups,
      pendingCount,
      totalCount,
      visibleTotal,
      statusFilter,
      setStatusFilter,
      loading,
      error,
      acceptQuotation,
      rejectQuotation,
      invalidateQuotes,
    }),
    [
      quoteDayGroups,
      allQuoteDayGroups,
      pendingCount,
      totalCount,
      visibleTotal,
      statusFilter,
      loading,
      error,
      acceptQuotation,
      rejectQuotation,
      invalidateQuotes,
    ],
  );
}
