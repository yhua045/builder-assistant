/**
 * Unit tests for useQuotationTimeline hook.
 *
 * Covers:
 *  - groupQuotationsByDay: buckets, ordering, undated quotes, stable output
 *  - getQuotationDateKey: correct date key extraction
 *  - pending filter: shows only sent-status quotes by default
 *  - setStatusFilter ('all'): shows all statuses
 *  - visibleTotal: sum of non-declined quotes in filtered view
 *  - pendingCount / totalCount derived correctly
 */

import { act } from '@testing-library/react-native';
import { container } from 'tsyringe';
import {
  groupQuotationsByDay,
  getQuotationDateKey,
  useQuotationTimeline,
} from '../../src/hooks/useQuotationTimeline';
import { Quotation } from '../../src/domain/entities/Quotation';
import { renderHookWithQuery } from '../utils/queryClientWrapper';

// ─── Factories ────────────────────────────────────────────────────────────────

function makeQuotation(overrides: Partial<Quotation> & { id: string }): Quotation {
  return {
    reference: `QT-${overrides.id}`,
    date: '2024-12-20',
    total: 1000,
    currency: 'AUD',
    status: 'sent',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeQuotationRepo(overrides: Record<string, jest.Mock> = {}) {
  return {
    createQuotation: jest.fn().mockResolvedValue(undefined),
    getQuotation: jest.fn().mockResolvedValue(null),
    updateQuotation: jest.fn().mockImplementation((_id, patch) => patch),
    deleteQuotation: jest.fn().mockResolvedValue(undefined),
    findByReference: jest.fn().mockResolvedValue(null),
    findByTask: jest.fn().mockResolvedValue([]),
    listQuotations: jest
      .fn()
      .mockResolvedValue({ items: [], total: 0 }),
    ...overrides,
  };
}

function makeInvoiceRepo(overrides: Record<string, jest.Mock> = {}) {
  return {
    createInvoice: jest.fn().mockResolvedValue({ id: 'inv-1', status: 'issued', total: 1000, currency: 'AUD', paymentStatus: 'unpaid', createdAt: '', updatedAt: '' }),
    getInvoice: jest.fn().mockResolvedValue(null),
    updateInvoice: jest.fn().mockResolvedValue(undefined),
    deleteInvoice: jest.fn().mockResolvedValue(undefined),
    listInvoices: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    findByExternalKey: jest.fn().mockResolvedValue(null),
    assignProject: jest.fn().mockResolvedValue(undefined),
  };
}

function makeTaskRepo(overrides: Record<string, jest.Mock> = {}) {
  return {
    findById: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue(undefined),
    findByProjectId: jest.fn().mockResolvedValue([]),
    findAll: jest.fn().mockResolvedValue([]),
    save: jest.fn().mockResolvedValue(undefined),
    findAdHoc: jest.fn().mockResolvedValue([]),
    findUpcoming: jest.fn().mockResolvedValue([]),
    delete: jest.fn().mockResolvedValue(undefined),
    addDependency: jest.fn().mockResolvedValue(undefined),
    removeDependency: jest.fn().mockResolvedValue(undefined),
    findDependencies: jest.fn().mockResolvedValue([]),
    findDependents: jest.fn().mockResolvedValue([]),
    findAllDependencies: jest.fn().mockResolvedValue([]),
    addDelayReason: jest.fn().mockResolvedValue({ id: 'dr-1' }),
    removeDelayReason: jest.fn().mockResolvedValue(undefined),
    resolveDelayReason: jest.fn().mockResolvedValue(undefined),
    findDelayReasons: jest.fn().mockResolvedValue([]),
    summarizeDelayReasons: jest.fn().mockResolvedValue([]),
    deleteDependenciesByTaskId: jest.fn().mockResolvedValue(undefined),
    deleteDelayReasonsByTaskId: jest.fn().mockResolvedValue(undefined),
    findProgressLogs: jest.fn().mockResolvedValue([]),
    addProgressLog: jest.fn().mockResolvedValue({ id: 'pl-1' }),
    updateProgressLog: jest.fn().mockResolvedValue(undefined),
    deleteProgressLog: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

// ─── Pure function tests ──────────────────────────────────────────────────────

describe('getQuotationDateKey', () => {
  it('returns YYYY-MM-DD slice of quotation.date', () => {
    const q = makeQuotation({ id: 'q1', date: '2024-12-20T10:00:00.000Z' });
    expect(getQuotationDateKey(q)).toBe('2024-12-20');
  });

  it('handles plain YYYY-MM-DD date strings', () => {
    const q = makeQuotation({ id: 'q1', date: '2025-03-15' });
    expect(getQuotationDateKey(q)).toBe('2025-03-15');
  });

  it('returns null when date is absent', () => {
    const q = makeQuotation({ id: 'q1', date: undefined as any });
    expect(getQuotationDateKey(q)).toBeNull();
  });
});

describe('groupQuotationsByDay', () => {
  it('groups quotations into separate day buckets', () => {
    const quotations = [
      makeQuotation({ id: 'q1', date: '2024-12-20' }),
      makeQuotation({ id: 'q2', date: '2024-12-20' }),
      makeQuotation({ id: 'q3', date: '2024-12-28' }),
    ];
    const groups = groupQuotationsByDay(quotations);
    expect(groups).toHaveLength(2);
    expect(groups[0].date).toBe('2024-12-20');
    expect(groups[0].quotations).toHaveLength(2);
    expect(groups[1].date).toBe('2024-12-28');
  });

  it('orders groups ascending by date', () => {
    const quotations = [
      makeQuotation({ id: 'q1', date: '2025-01-10' }),
      makeQuotation({ id: 'q2', date: '2024-12-01' }),
    ];
    const groups = groupQuotationsByDay(quotations);
    expect(groups[0].date).toBe('2024-12-01');
    expect(groups[1].date).toBe('2025-01-10');
  });

  it('places undated quotations in a trailing __nodate__ bucket', () => {
    const quotations = [
      makeQuotation({ id: 'q1', date: '2024-12-20' }),
      makeQuotation({ id: 'q2', date: undefined as any }),
    ];
    const groups = groupQuotationsByDay(quotations);
    expect(groups).toHaveLength(2);
    expect(groups[groups.length - 1].date).toBe('__nodate__');
    expect(groups[groups.length - 1].label).toBe('No Date');
  });

  it('returns empty array for no input', () => {
    expect(groupQuotationsByDay([])).toEqual([]);
  });

  it('orders quotations within a day bucket ascending by date', () => {
    const quotations = [
      makeQuotation({ id: 'q1', date: '2024-12-20T14:00:00Z' }),
      makeQuotation({ id: 'q2', date: '2024-12-20T08:00:00Z' }),
    ];
    const groups = groupQuotationsByDay(quotations);
    expect(groups[0].quotations[0].id).toBe('q2');
    expect(groups[0].quotations[1].id).toBe('q1');
  });

  it('generates a human-readable label', () => {
    const quotations = [makeQuotation({ id: 'q1', date: '2024-12-20' })];
    const groups = groupQuotationsByDay(quotations);
    const label = groups[0].label;
    expect(label).toMatch(/20/);
    expect(label).toMatch(/Dec/);
  });
});

// ─── Hook tests ───────────────────────────────────────────────────────────────

describe('useQuotationTimeline', () => {
  const PROJECT_ID = 'proj-test-1';

  let quotationRepo: ReturnType<typeof makeQuotationRepo>;
  let invoiceRepo: ReturnType<typeof makeInvoiceRepo>;
  let taskRepo: ReturnType<typeof makeTaskRepo>;

  beforeEach(() => {
    quotationRepo = makeQuotationRepo();
    invoiceRepo = makeInvoiceRepo();
    taskRepo = makeTaskRepo();
    jest.spyOn(container, 'resolve').mockImplementation((token: any) => {
      if (token === 'QuotationRepository') return quotationRepo;
      if (token === 'InvoiceRepository') return invoiceRepo;
      if (token === 'TaskRepository') return taskRepo;
      throw new Error(`Unexpected token: ${String(token)}`);
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('defaults to pending filter and returns only sent quotations', async () => {
    const quotations = [
      makeQuotation({ id: 'q1', status: 'sent', date: '2024-12-20' }),
      makeQuotation({ id: 'q2', status: 'accepted', date: '2024-12-21' }),
      makeQuotation({ id: 'q3', status: 'declined', date: '2024-12-22' }),
    ];
    quotationRepo.listQuotations.mockResolvedValue({ items: quotations, total: 3 });

    const { result } = renderHookWithQuery(() =>
      useQuotationTimeline(PROJECT_ID),
    );

    await act(async () => { await new Promise<void>((r) => setTimeout(r, 100)); });

    expect(result.current.statusFilter).toBe('pending');
    const visibleIds = result.current.quoteDayGroups.flatMap(
      (g: { quotations: { id: string }[] }) => g.quotations.map((q: { id: string }) => q.id),
    );
    expect(visibleIds).toEqual(['q1']);
  });

  it('setStatusFilter("all") shows all quotations', async () => {
    const quotations = [
      makeQuotation({ id: 'q1', status: 'sent', date: '2024-12-20' }),
      makeQuotation({ id: 'q2', status: 'accepted', date: '2024-12-21' }),
    ];
    quotationRepo.listQuotations.mockResolvedValue({ items: quotations, total: 2 });

    const { result } = renderHookWithQuery(() =>
      useQuotationTimeline(PROJECT_ID),
    );

    await act(async () => { await new Promise<void>((r) => setTimeout(r, 100)); });

    act(() => {
      result.current.setStatusFilter('all');
    });

    const visibleIds = result.current.quoteDayGroups.flatMap(
      (g: { quotations: { id: string }[] }) => g.quotations.map((q: { id: string }) => q.id),
    );
    expect(visibleIds).toContain('q1');
    expect(visibleIds).toContain('q2');
  });

  it('computes pendingCount correctly', async () => {
    const quotations = [
      makeQuotation({ id: 'q1', status: 'sent', date: '2024-12-20' }),
      makeQuotation({ id: 'q2', status: 'sent', date: '2024-12-21' }),
      makeQuotation({ id: 'q3', status: 'accepted', date: '2024-12-22' }),
    ];
    quotationRepo.listQuotations.mockResolvedValue({ items: quotations, total: 3 });

    const { result } = renderHookWithQuery(() =>
      useQuotationTimeline(PROJECT_ID),
    );

    await act(async () => { await new Promise<void>((r) => setTimeout(r, 100)); });

    expect(result.current.pendingCount).toBe(2);
    expect(result.current.totalCount).toBe(3);
  });

  it('computes visibleTotal excluding declined quotes', async () => {
    const quotations = [
      makeQuotation({ id: 'q1', status: 'sent', total: 500, date: '2024-12-20' }),
      makeQuotation({ id: 'q2', status: 'sent', total: 200, date: '2024-12-20' }),
      makeQuotation({ id: 'q3', status: 'declined', total: 999, date: '2024-12-20' }),
    ];
    quotationRepo.listQuotations.mockResolvedValue({ items: quotations, total: 3 });

    const { result } = renderHookWithQuery(() =>
      useQuotationTimeline(PROJECT_ID),
    );

    await act(async () => { await new Promise<void>((r) => setTimeout(r, 100)); });

    // Default filter = pending (sent only), declined excluded
    expect(result.current.visibleTotal).toBe(700);
  });

  it('passes projectId to listQuotations', async () => {
    quotationRepo.listQuotations.mockResolvedValue({ items: [], total: 0 });

    renderHookWithQuery(() => useQuotationTimeline(PROJECT_ID));

    await act(async () => { await new Promise<void>((r) => setTimeout(r, 100)); });

    expect(quotationRepo.listQuotations).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: PROJECT_ID }),
    );
  });

  it('returns loading=true initially', () => {
    quotationRepo.listQuotations.mockReturnValue(new Promise(() => {})); // never resolves

    const { result } = renderHookWithQuery(() => useQuotationTimeline(PROJECT_ID));

    expect(result.current.loading).toBe(true);
  });

  it('returns error string when query fails', async () => {
    quotationRepo.listQuotations.mockRejectedValue(new Error('network error'));

    const { result } = renderHookWithQuery(() =>
      useQuotationTimeline(PROJECT_ID),
    );

    await act(async () => { await new Promise<void>((r) => setTimeout(r, 100)); });

    expect(result.current.error).toBe('network error');
  });
});
