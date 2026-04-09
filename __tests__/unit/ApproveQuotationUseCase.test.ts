import { Quotation } from '../../src/domain/entities/Quotation';
import { Task } from '../../src/domain/entities/Task';
import { Invoice } from '../../src/domain/entities/Invoice';
import { QuotationRepository } from '../../src/domain/repositories/QuotationRepository';
import { TaskRepository } from '../../src/domain/repositories/TaskRepository';
import { InvoiceRepository } from '../../src/domain/repositories/InvoiceRepository';
import {
  ApproveQuotationUseCase,
  ApproveQuotationInput,
} from '../../src/application/usecases/quotation/ApproveQuotationUseCase';

// ── Mock factories ────────────────────────────────────────────────────────────

function makeQuotation(overrides: Partial<Quotation> = {}): Quotation {
  return {
    id: 'quot-1',
    reference: 'QUO-2026-001',
    date: '2026-04-09',
    total: 5000,
    currency: 'AUD',
    status: 'pending_approval',
    projectId: 'proj-1',
    vendorName: 'Acme Builders',
    createdAt: '2026-04-09T00:00:00.000Z',
    updatedAt: '2026-04-09T00:00:00.000Z',
    ...overrides,
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Review Quotation: Acme Builders',
    status: 'pending',
    taskType: 'contract_work',
    quoteStatus: 'issued',
    quoteAmount: 5000,
    projectId: 'proj-1',
    ...overrides,
  };
}

function makeInvoiceRepo(overrides: Partial<InvoiceRepository> = {}): InvoiceRepository {
  return {
    createInvoice: jest.fn(async (inv: Invoice) => inv),
    getInvoice: jest.fn(),
    updateInvoice: jest.fn(),
    deleteInvoice: jest.fn(),
    listInvoices: jest.fn(),
    findByProjectId: jest.fn(),
    findByTaskId: jest.fn(),
    ...overrides,
  } as unknown as InvoiceRepository;
}

function makeQuotationRepo(overrides: Partial<QuotationRepository> = {}): QuotationRepository {
  return {
    createQuotation: jest.fn(),
    getQuotation: jest.fn().mockResolvedValue(makeQuotation()),
    updateQuotation: jest.fn(async (_id: string, updates: Partial<Quotation>) => ({
      ...makeQuotation(),
      ...updates,
    })),
    deleteQuotation: jest.fn(),
    findByReference: jest.fn(),
    findByTask: jest.fn().mockResolvedValue([]),
    findByProjectId: jest.fn().mockResolvedValue([]),
    listQuotations: jest.fn(),
    ...overrides,
  } as unknown as QuotationRepository;
}

function makeTaskRepo(overrides: Partial<TaskRepository> = {}): TaskRepository {
  return {
    save: jest.fn(),
    findById: jest.fn().mockResolvedValue(makeTask()),
    findAll: jest.fn().mockResolvedValue([]),
    findByProjectId: jest.fn().mockResolvedValue([]),
    findAdHoc: jest.fn().mockResolvedValue([]),
    findUpcoming: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn(),
    addDependency: jest.fn(),
    removeDependency: jest.fn(),
    findDependencies: jest.fn().mockResolvedValue([]),
    findDependents: jest.fn().mockResolvedValue([]),
    findAllDependencies: jest.fn().mockResolvedValue([]),
    addDelayReason: jest.fn(),
    removeDelayReason: jest.fn(),
    resolveDelayReason: jest.fn(),
    findDelayReasons: jest.fn().mockResolvedValue([]),
    summarizeDelayReasons: jest.fn().mockResolvedValue([]),
    deleteDependenciesByTaskId: jest.fn(),
    deleteDelayReasonsByTaskId: jest.fn(),
    findProgressLogs: jest.fn().mockResolvedValue([]),
    addProgressLog: jest.fn(),
    updateProgressLog: jest.fn(),
    deleteProgressLog: jest.fn(),
    ...overrides,
  } as unknown as TaskRepository;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ApproveQuotationUseCase', () => {
  it('throws QUOTATION_NOT_FOUND when quotation does not exist', async () => {
    const quotationRepo = makeQuotationRepo({
      getQuotation: jest.fn().mockResolvedValue(null),
    });
    const uc = new ApproveQuotationUseCase(makeInvoiceRepo(), quotationRepo, makeTaskRepo());

    await expect(uc.execute({ quotationId: 'missing' })).rejects.toThrow('QUOTATION_NOT_FOUND');
  });

  it('throws QUOTATION_NOT_PENDING_APPROVAL when status is not pending_approval', async () => {
    const quotationRepo = makeQuotationRepo({
      getQuotation: jest.fn().mockResolvedValue(makeQuotation({ status: 'draft' })),
    });
    const uc = new ApproveQuotationUseCase(makeInvoiceRepo(), quotationRepo, makeTaskRepo());

    await expect(uc.execute({ quotationId: 'quot-1' })).rejects.toThrow(
      'QUOTATION_NOT_PENDING_APPROVAL',
    );
  });

  it('throws QUOTATION_NOT_PENDING_APPROVAL when status is accepted', async () => {
    const quotationRepo = makeQuotationRepo({
      getQuotation: jest.fn().mockResolvedValue(makeQuotation({ status: 'accepted' })),
    });
    const uc = new ApproveQuotationUseCase(makeInvoiceRepo(), quotationRepo, makeTaskRepo());

    await expect(uc.execute({ quotationId: 'quot-1' })).rejects.toThrow(
      'QUOTATION_NOT_PENDING_APPROVAL',
    );
  });

  it('creates an invoice from quotation data', async () => {
    const createdInvoices: Invoice[] = [];
    const invoiceRepo = makeInvoiceRepo({
      createInvoice: jest.fn(async (inv: Invoice) => {
        createdInvoices.push(inv);
        return inv;
      }),
    });
    const uc = new ApproveQuotationUseCase(invoiceRepo, makeQuotationRepo(), makeTaskRepo());

    await uc.execute({ quotationId: 'quot-1' });

    expect(createdInvoices).toHaveLength(1);
    expect(createdInvoices[0].total).toBe(5000);
    expect(createdInvoices[0].quoteId).toBe('quot-1');
    expect(createdInvoices[0].status).toBe('issued');
  });

  it('transitions quotation status to accepted', async () => {
    const updates: Array<{ id: string; patch: Partial<Quotation> }> = [];
    const quotationRepo = makeQuotationRepo({
      updateQuotation: jest.fn(async (id: string, patch: Partial<Quotation>) => {
        updates.push({ id, patch });
        return { ...makeQuotation(), ...patch };
      }),
    });
    const uc = new ApproveQuotationUseCase(makeInvoiceRepo(), quotationRepo, makeTaskRepo());

    await uc.execute({ quotationId: 'quot-1' });

    expect(updates).toHaveLength(1);
    expect(updates[0].id).toBe('quot-1');
    expect(updates[0].patch.status).toBe('accepted');
  });

  it('updates linked task quoteStatus to accepted when taskId is set', async () => {
    const quotationWithTask = makeQuotation({ taskId: 'task-1' });
    const quotationRepo = makeQuotationRepo({
      getQuotation: jest.fn().mockResolvedValue(quotationWithTask),
    });
    const taskUpdates: Task[] = [];
    const taskRepo = makeTaskRepo({
      update: jest.fn(async (t: Task) => { taskUpdates.push(t); }),
    });
    const uc = new ApproveQuotationUseCase(makeInvoiceRepo(), quotationRepo, taskRepo);

    await uc.execute({ quotationId: 'quot-1' });

    expect(taskUpdates).toHaveLength(1);
    expect(taskUpdates[0].quoteStatus).toBe('accepted');
    expect(typeof taskUpdates[0].quoteInvoiceId).toBe('string');
  });

  it('does not update task when taskId is not set', async () => {
    const quotationNoTask = makeQuotation({ taskId: undefined });
    const quotationRepo = makeQuotationRepo({
      getQuotation: jest.fn().mockResolvedValue(quotationNoTask),
    });
    const taskRepo = makeTaskRepo();
    const uc = new ApproveQuotationUseCase(makeInvoiceRepo(), quotationRepo, taskRepo);

    await uc.execute({ quotationId: 'quot-1' });

    expect(taskRepo.update as jest.Mock).not.toHaveBeenCalled();
  });

  it('returns { invoice, quotation, task } on success with taskId', async () => {
    const quotationWithTask = makeQuotation({ taskId: 'task-1' });
    const quotationRepo = makeQuotationRepo({
      getQuotation: jest.fn().mockResolvedValue(quotationWithTask),
    });
    const uc = new ApproveQuotationUseCase(makeInvoiceRepo(), quotationRepo, makeTaskRepo());

    const result = await uc.execute({ quotationId: 'quot-1' });

    expect(result.invoice).toBeDefined();
    expect(result.quotation.status).toBe('accepted');
    expect(result.task).toBeDefined();
  });
});
