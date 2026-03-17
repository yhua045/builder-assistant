/**
 * Invalidation unit tests — §5.1 of design/issue-152-query-invalidation-review.md
 *
 * Each test family asserts that after calling a mutation the hook calls
 * queryClient.invalidateQueries with exactly the expected cache keys.
 *
 * Strategy:
 *  - Use renderHookWithQuery which provides a real QueryClient via QueryClientProvider.
 *  - Spy on the returned queryClient.invalidateQueries so we can assert calls.
 *  - Mock the DI container so repository calls are no-ops.
 */

import { act } from '@testing-library/react-native';
import { container } from 'tsyringe';
import { renderHookWithQuery } from '../utils/queryClientWrapper';
import { useAcceptQuote } from '../../src/hooks/useAcceptQuote';
import { useTasks } from '../../src/hooks/useTasks';
import { useInvoices } from '../../src/hooks/useInvoices';

// ── Repo factory helpers ─────────────────────────────────────────────────────

function makeTaskRepo(overrides: Record<string, jest.Mock> = {}) {
  return {
    save: jest.fn().mockResolvedValue(undefined),
    findById: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockResolvedValue([]),
    findByProjectId: jest.fn().mockResolvedValue([]),
    findAdHoc: jest.fn().mockResolvedValue([]),
    findUpcoming: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    addDependency: jest.fn().mockResolvedValue(undefined),
    removeDependency: jest.fn().mockResolvedValue(undefined),
    findDependencies: jest.fn().mockResolvedValue([]),
    findDependents: jest.fn().mockResolvedValue([]),
    addDelayReason: jest.fn().mockResolvedValue({ id: 'dr-1' }),
    removeDelayReason: jest.fn().mockResolvedValue(undefined),
    resolveDelayReason: jest.fn().mockResolvedValue(undefined),
    findDelayReasons: jest.fn().mockResolvedValue([]),
    summarizeDelayReasons: jest.fn().mockResolvedValue([]),
    deleteDependenciesByTaskId: jest.fn().mockResolvedValue(undefined),
    deleteDelayReasonsByTaskId: jest.fn().mockResolvedValue(undefined),
    findProgressLogs: jest.fn().mockResolvedValue([]),
    addProgressLog: jest.fn().mockResolvedValue({ id: 'pl-1', taskId: 'task-1' }),
    updateProgressLog: jest.fn().mockResolvedValue(undefined),
    deleteProgressLog: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeInvoiceRepo(overrides: Record<string, jest.Mock> = {}) {
  return {
    createInvoice: jest.fn().mockResolvedValue({ id: 'inv-1', status: 'draft', paymentStatus: 'unpaid', total: 0, currency: 'AUD', createdAt: '', updatedAt: '' }),
    updateInvoice: jest.fn().mockResolvedValue(undefined),
    deleteInvoice: jest.fn().mockResolvedValue(undefined),
    listInvoices: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    getInvoice: jest.fn().mockResolvedValue(null),
    ...overrides,
  };
}

function makeContactRepo(overrides: Record<string, jest.Mock> = {}) {
  return {
    findById: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 'c-1' }),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeQuotationRepo(overrides: Record<string, jest.Mock> = {}) {
  return {
    create: jest.fn().mockResolvedValue({ id: 'q-1', total: 0 }),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    findById: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    findByTask: jest.fn().mockResolvedValue([]),
    findByTaskId: jest.fn().mockResolvedValue([]),
    accept: jest.fn().mockResolvedValue(undefined),
    reject: jest.fn().mockResolvedValue(undefined),
    createQuotation: jest.fn().mockResolvedValue({ id: 'q-1', total: 0, createdAt: '', updatedAt: '' }),
    getQuotation: jest.fn().mockResolvedValue(null),
    updateQuotation: jest.fn().mockResolvedValue({ id: 'q-1', total: 0, createdAt: '', updatedAt: '' }),
    deleteQuotation: jest.fn().mockResolvedValue(undefined),
    findByReference: jest.fn().mockResolvedValue(null),
    listQuotations: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    ...overrides,
  };
}

afterEach(() => {
  jest.restoreAllMocks();
});

// ────────────────────────────────────────────────────────────────────────────
// 1. useAcceptQuote
// ────────────────────────────────────────────────────────────────────────────

describe('useAcceptQuote — invalidations', () => {
  const PROJECT_ID = 'project-1';
  const TASK_ID = 'task-1';
  const INVOICE_ID = 'inv-accepted-1';

  let taskRepo: ReturnType<typeof makeTaskRepo>;
  let invoiceRepo: ReturnType<typeof makeInvoiceRepo>;
  let contactRepo: ReturnType<typeof makeContactRepo>;
  let quotationRepo: ReturnType<typeof makeQuotationRepo>;

  beforeEach(() => {
    taskRepo = makeTaskRepo({
      findById: jest.fn().mockResolvedValue({
        id: TASK_ID,
        projectId: PROJECT_ID,
        title: 'Build deck',
        taskType: 'contract_work',
        quoteStatus: 'pending',
        quoteAmount: 5000,
        subcontractorId: undefined,
      }),
    });
    invoiceRepo = makeInvoiceRepo({
      createInvoice: jest.fn().mockResolvedValue({
        id: INVOICE_ID,
        status: 'draft',
        paymentStatus: 'unpaid',
        total: 5000,
        currency: 'AUD',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    });
    contactRepo = makeContactRepo();
    quotationRepo = makeQuotationRepo();

    jest.spyOn(container, 'resolve').mockImplementation((token: any) => {
      if (token === 'TaskRepository') return taskRepo;
      if (token === 'InvoiceRepository') return invoiceRepo;
      if (token === 'ContactRepository') return contactRepo;
      if (token === 'QuotationRepository') return quotationRepo;
      return {};
    });
  });

  it('acceptQuote invalidates payments, invoices(projectId), tasks(projectId), taskDetail, quotations(taskId)', async () => {
    const { result, queryClient } = renderHookWithQuery(() => useAcceptQuote());
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);

    await act(async () => {
      await result.current.acceptQuote(TASK_ID);
    });

    const calledKeys = invalidateSpy.mock.calls.map((c: any) => c[0].queryKey);

    expect(calledKeys).toContainEqual(['payments']);
    expect(calledKeys).toContainEqual(['invoices', PROJECT_ID]);
    expect(calledKeys).toContainEqual(['tasks', PROJECT_ID]);
    expect(calledKeys).toContainEqual(['taskDetail', TASK_ID]);
    expect(calledKeys).toContainEqual(['quotations', TASK_ID]);
    // Must NOT invalidate bare ['invoices'] or ['tasks'] (over-invalidation guard)
    expect(calledKeys).not.toContainEqual(['invoices']);
    expect(calledKeys).not.toContainEqual(['tasks']);
  });

  it('rejectQuote invalidates tasks, taskDetail, quotations — NOT payments', async () => {
    const { result, queryClient } = renderHookWithQuery(() => useAcceptQuote());
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);

    await act(async () => {
      await result.current.rejectQuote(TASK_ID);
    });

    const calledKeys = invalidateSpy.mock.calls.map((c: any) => c[0].queryKey);

    expect(calledKeys).toContainEqual(['tasks', PROJECT_ID]);
    expect(calledKeys).toContainEqual(['taskDetail', TASK_ID]);
    expect(calledKeys).toContainEqual(['quotations', TASK_ID]);
    // Reject should NOT touch payments or invoices — no financial change
    expect(calledKeys).not.toContainEqual(['payments']);
    expect(calledKeys).not.toContainEqual(expect.arrayContaining(['invoices']));
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 2. useTasks — progress log mutations
// ────────────────────────────────────────────────────────────────────────────

describe('useTasks — progress log invalidations', () => {
  const TASK_ID = 'task-pl-1';
  const LOG_ID = 'pl-log-1';

  let taskRepo: ReturnType<typeof makeTaskRepo>;

  beforeEach(() => {
    taskRepo = makeTaskRepo({
      findProgressLogs: jest.fn().mockResolvedValue([]),
      addProgressLog: jest.fn().mockResolvedValue({ id: LOG_ID, taskId: TASK_ID }),
      updateProgressLog: jest.fn().mockResolvedValue(undefined),
      deleteProgressLog: jest.fn().mockResolvedValue(undefined),
    });

    jest.spyOn(container, 'resolve').mockImplementation((token: any) => {
      if (token === 'TaskRepository') return taskRepo;
      return {};
    });
  });

  it('addProgressLog invalidates progressLogs and taskDetail', async () => {
    const { result, queryClient } = renderHookWithQuery(() => useTasks());
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);

    await act(async () => {
      await result.current.addProgressLog(TASK_ID, { description: 'Foundation poured', photos: [] });
    });

    const calledKeys = invalidateSpy.mock.calls.map((c: any) => c[0].queryKey);
    expect(calledKeys).toContainEqual(['progressLogs', TASK_ID]);
    expect(calledKeys).toContainEqual(['taskDetail', TASK_ID]);
  });

  it('updateProgressLog invalidates progressLogs and taskDetail', async () => {
    const { result, queryClient } = renderHookWithQuery(() => useTasks());
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);

    await act(async () => {
      await result.current.updateProgressLog(TASK_ID, LOG_ID, { description: 'Updated note' });
    });

    const calledKeys = invalidateSpy.mock.calls.map((c: any) => c[0].queryKey);
    expect(calledKeys).toContainEqual(['progressLogs', TASK_ID]);
    expect(calledKeys).toContainEqual(['taskDetail', TASK_ID]);
  });

  it('deleteProgressLog invalidates progressLogs and taskDetail', async () => {
    const { result, queryClient } = renderHookWithQuery(() => useTasks());
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);

    await act(async () => {
      await result.current.deleteProgressLog(TASK_ID, LOG_ID);
    });

    const calledKeys = invalidateSpy.mock.calls.map((c: any) => c[0].queryKey);
    expect(calledKeys).toContainEqual(['progressLogs', TASK_ID]);
    expect(calledKeys).toContainEqual(['taskDetail', TASK_ID]);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 3. useTasks — task edit invalidations
// ────────────────────────────────────────────────────────────────────────────

describe('useTasks — updateTask invalidations', () => {
  const PROJECT_ID = 'project-upd-1';
  const TASK_ID = 'task-upd-1';

  let taskRepo: ReturnType<typeof makeTaskRepo>;

  beforeEach(() => {
    taskRepo = makeTaskRepo({
      findById: jest.fn().mockResolvedValue({
        id: TASK_ID,
        projectId: PROJECT_ID,
        title: 'Old title',
        status: 'pending',
      }),
      update: jest.fn().mockResolvedValue(undefined),
      findByProjectId: jest.fn().mockResolvedValue([]),
    });

    jest.spyOn(container, 'resolve').mockImplementation((token: any) => {
      if (token === 'TaskRepository') return taskRepo;
      return {};
    });
  });

  it('updateTask invalidates tasks(projectId) and taskDetail', async () => {
    const { result, queryClient } = renderHookWithQuery(() => useTasks(PROJECT_ID));
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);

    await act(async () => {
      await result.current.updateTask({ id: TASK_ID, projectId: PROJECT_ID, title: 'New title', status: 'in_progress' });
    });

    const calledKeys = invalidateSpy.mock.calls.map((c: any) => c[0].queryKey);
    expect(calledKeys).toContainEqual(['tasks', PROJECT_ID]);
    expect(calledKeys).toContainEqual(['taskDetail', TASK_ID]);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// 4. useInvoices — invoice create/update/delete invalidations
// ────────────────────────────────────────────────────────────────────────────

describe('useInvoices — mutation invalidations', () => {
  const PROJECT_ID = 'project-inv-1';

  let invoiceRepo: ReturnType<typeof makeInvoiceRepo>;

  beforeEach(() => {
    invoiceRepo = makeInvoiceRepo();

    jest.spyOn(container, 'resolve').mockImplementation((token: any) => {
      if (token === 'InvoiceRepository') return invoiceRepo;
      return {};
    });
  });

  it('createInvoice invalidates payments and invoices(projectId)', async () => {
    const { result, queryClient } = renderHookWithQuery(() => useInvoices({ projectId: PROJECT_ID }));
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);

    await act(async () => {
      await result.current.createInvoice({
        projectId: PROJECT_ID,
        status: 'draft',
        paymentStatus: 'unpaid',
        total: 1000,
        currency: 'AUD',
        dueDate: '2025-12-31',
      } as any);
    });

    const calledKeys = invalidateSpy.mock.calls.map((c: any) => c[0].queryKey);
    expect(calledKeys).toContainEqual(['payments']);
    expect(calledKeys).toContainEqual(['invoices', PROJECT_ID]);
  });

  it('updateInvoice invalidates payments and invoices(projectId)', async () => {
    const { result, queryClient } = renderHookWithQuery(() => useInvoices({ projectId: PROJECT_ID }));
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);

    await act(async () => {
      await result.current.updateInvoice({ id: 'inv-1', total: 2000 } as any);
    });

    const calledKeys = invalidateSpy.mock.calls.map((c: any) => c[0].queryKey);
    expect(calledKeys).toContainEqual(['payments']);
    expect(calledKeys).toContainEqual(['invoices', PROJECT_ID]);
  });

  it('deleteInvoice invalidates payments and invoices(projectId)', async () => {
    const { result, queryClient } = renderHookWithQuery(() => useInvoices({ projectId: PROJECT_ID }));
    const invalidateSpy = jest.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);

    await act(async () => {
      await result.current.deleteInvoice('inv-1');
    });

    const calledKeys = invalidateSpy.mock.calls.map((c: any) => c[0].queryKey);
    expect(calledKeys).toContainEqual(['payments']);
    expect(calledKeys).toContainEqual(['invoices', PROJECT_ID]);
  });
});

