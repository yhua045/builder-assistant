import { AcceptQuoteUseCase } from '../../src/application/usecases/task/AcceptQuoteUseCase';
import { Task } from '../../src/domain/entities/Task';
import { Invoice } from '../../src/domain/entities/Invoice';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Concrete slab',
    status: 'pending',
    taskType: 'contract_work',
    quoteAmount: 5000,
    quoteStatus: 'issued',
    projectId: 'proj-1',
    subcontractorId: 'contact-1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeTaskRepo(task: Task | null = makeTask()) {
  return {
    findById: jest.fn().mockResolvedValue(task),
    update: jest.fn().mockResolvedValue(undefined),
    save: jest.fn(),
    findAll: jest.fn(),
    findByProjectId: jest.fn(),
    findAdHoc: jest.fn(),
    findUpcoming: jest.fn(),
    delete: jest.fn(),
    addDependency: jest.fn(),
    removeDependency: jest.fn(),
    findDependencies: jest.fn(),
    findDependents: jest.fn(),
    findAllDependencies: jest.fn(),
    addDelayReason: jest.fn(),
    getDelayReasons: jest.fn(),
    getProgressLogs: jest.fn(),
    addProgressLog: jest.fn(),
  };
}

function makeInvoiceRepo(createReturnFn?: (inv: Invoice) => Promise<Invoice>) {
  return {
    createInvoice: jest.fn(createReturnFn ?? ((inv: Invoice) => Promise.resolve(inv))),
    getInvoice: jest.fn(),
    updateInvoice: jest.fn(),
    deleteInvoice: jest.fn(),
    findByExternalKey: jest.fn(),
    listInvoices: jest.fn(),
    assignProject: jest.fn(),
  };
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('AcceptQuoteUseCase', () => {
  let taskRepo: ReturnType<typeof makeTaskRepo>;
  let invoiceRepo: ReturnType<typeof makeInvoiceRepo>;

  beforeEach(() => {
    taskRepo = makeTaskRepo();
    invoiceRepo = makeInvoiceRepo();
  });

  it('creates an issued invoice from the task quote amount', async () => {
    const uc = new AcceptQuoteUseCase(taskRepo as any, invoiceRepo as any);
    const { invoice } = await uc.execute('task-1');

    expect(invoiceRepo.createInvoice).toHaveBeenCalledTimes(1);
    expect(invoice.total).toBe(5000);
    expect(invoice.status).toBe('issued');
    expect(invoice.paymentStatus).toBe('unpaid');
    expect(invoice.projectId).toBe('proj-1');
  });

  it('links the invoice note to the task title', async () => {
    const uc = new AcceptQuoteUseCase(taskRepo as any, invoiceRepo as any);
    const { invoice } = await uc.execute('task-1');

    expect(invoice.notes).toContain('Concrete slab');
  });

  it('updates the task with quoteStatus=accepted and quoteInvoiceId', async () => {
    const uc = new AcceptQuoteUseCase(taskRepo as any, invoiceRepo as any);
    const { task, invoice } = await uc.execute('task-1');

    expect(task.quoteStatus).toBe('accepted');
    expect(task.quoteInvoiceId).toBe(invoice.id);
    expect(taskRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ quoteStatus: 'accepted', quoteInvoiceId: invoice.id }),
    );
  });

  it('uses zero total when quoteAmount is undefined', async () => {
    taskRepo = makeTaskRepo(makeTask({ quoteAmount: undefined }));
    const uc = new AcceptQuoteUseCase(taskRepo as any, invoiceRepo as any);
    const { invoice } = await uc.execute('task-1');

    expect(invoice.total).toBe(0);
  });

  it('throws TASK_NOT_FOUND when task does not exist', async () => {
    taskRepo = makeTaskRepo(null);
    const uc = new AcceptQuoteUseCase(taskRepo as any, invoiceRepo as any);

    await expect(uc.execute('missing')).rejects.toThrow('TASK_NOT_FOUND');
  });

  it('throws NOT_CONTRACT_WORK for variation tasks', async () => {
    taskRepo = makeTaskRepo(makeTask({ taskType: 'variation' }));
    const uc = new AcceptQuoteUseCase(taskRepo as any, invoiceRepo as any);

    await expect(uc.execute('task-1')).rejects.toThrow('NOT_CONTRACT_WORK');
  });

  it('throws NOT_CONTRACT_WORK for standard tasks', async () => {
    taskRepo = makeTaskRepo(makeTask({ taskType: 'standard' }));
    const uc = new AcceptQuoteUseCase(taskRepo as any, invoiceRepo as any);

    await expect(uc.execute('task-1')).rejects.toThrow('NOT_CONTRACT_WORK');
  });

  it('throws QUOTE_ALREADY_ACCEPTED when already accepted', async () => {
    taskRepo = makeTaskRepo(makeTask({ quoteStatus: 'accepted' }));
    const uc = new AcceptQuoteUseCase(taskRepo as any, invoiceRepo as any);

    await expect(uc.execute('task-1')).rejects.toThrow('QUOTE_ALREADY_ACCEPTED');
  });

  it('does not call createInvoice when task not found', async () => {
    taskRepo = makeTaskRepo(null);
    const uc = new AcceptQuoteUseCase(taskRepo as any, invoiceRepo as any);

    await expect(uc.execute('task-1')).rejects.toThrow();
    expect(invoiceRepo.createInvoice).not.toHaveBeenCalled();
  });
});
