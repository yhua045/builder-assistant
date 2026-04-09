import { CompleteTaskAndSettlePaymentsUseCase } from '../../src/application/usecases/task/CompleteTaskAndSettlePaymentsUseCase';
import { TaskRepository } from '../../src/domain/repositories/TaskRepository';
import { PaymentRepository } from '../../src/domain/repositories/PaymentRepository';
import { InvoiceRepository } from '../../src/domain/repositories/InvoiceRepository';
import { QuotationRepository } from '../../src/domain/repositories/QuotationRepository';
import { TaskNotFoundError } from '../../src/application/errors/TaskCompletionErrors';
import { Task } from '../../src/domain/entities/Task';
import { Payment } from '../../src/domain/entities/Payment';
import { Invoice } from '../../src/domain/entities/Invoice';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    title: 'Test Task',
    status: 'in_progress',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makePayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: 'pay-1',
    amount: 1000,
    status: 'pending',
    invoiceId: 'inv-1',
    contractorName: 'Bob Builder',
    dueDate: '2026-03-01',
    ...overrides,
  };
}

function makeInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    id: 'inv-1',
    projectId: 'proj-1',
    vendor: 'Bob Builder',
    total: 1000,
    status: 'issued',
    currency: 'USD',
    paymentStatus: 'unpaid',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeMockTaskRepo(overrides: Partial<TaskRepository> = {}): TaskRepository {
  return {
    save: jest.fn(),
    findById: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockResolvedValue([]),
    findByProjectId: jest.fn().mockResolvedValue([]),
    findAdHoc: jest.fn().mockResolvedValue([]),
    findUpcoming: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    addDependency: jest.fn(),
    removeDependency: jest.fn(),
    findDependencies: jest.fn().mockResolvedValue([]),
    findDependents: jest.fn().mockResolvedValue([]),
    findAllDependencies: jest.fn().mockResolvedValue([]),
    addDelayReason: jest.fn(),
    removeDelayReason: jest.fn(),
    findDelayReasons: jest.fn().mockResolvedValue([]),
    resolveDelayReason: jest.fn().mockResolvedValue(undefined),
    summarizeDelayReasons: jest.fn().mockResolvedValue([]),
    deleteDependenciesByTaskId: jest.fn().mockResolvedValue(undefined),
    deleteDelayReasonsByTaskId: jest.fn().mockResolvedValue(undefined),
    findProgressLogs: jest.fn().mockResolvedValue([]),
    addProgressLog: jest.fn(),
    updateProgressLog: jest.fn(),
    deleteProgressLog: jest.fn(),
    ...overrides,
  } as unknown as TaskRepository;
}

function makeMockPaymentRepo(paymentsForInvoice: Payment[] = []): PaymentRepository {
  // Stateful mock: update() persists changes so findByInvoice/findById reflect settled state
  const paymentMap = new Map(paymentsForInvoice.map(p => [p.id, { ...p }]));
  return {
    save: jest.fn(),
    findById: jest.fn().mockImplementation(async (id: string) => {
      const p = paymentMap.get(id);
      return p ? { ...p } : null;
    }),
    findAll: jest.fn().mockResolvedValue([]),
    findByInvoice: jest.fn().mockImplementation(async () => Array.from(paymentMap.values())),
    findByProjectId: jest.fn().mockResolvedValue([]),
    findPendingByProject: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockImplementation(async (payment: Payment) => {
      paymentMap.set(payment.id, { ...payment });
    }),
    delete: jest.fn().mockResolvedValue(undefined),
    list: jest.fn().mockResolvedValue({ items: [], meta: { total: 0 } }),
    getMetrics: jest.fn().mockResolvedValue({ pendingTotalNext7Days: 0, overdueCount: 0 }),
  } as unknown as PaymentRepository;
}

function makeMockInvoiceRepo(invoice: Invoice | null = null): InvoiceRepository {
  return {
    createInvoice: jest.fn(),
    getInvoice: jest.fn().mockResolvedValue(invoice),
    updateInvoice: jest.fn(),
    deleteInvoice: jest.fn(),
    listInvoices: jest.fn().mockResolvedValue({ items: [], meta: {} }),
    findByProjectId: jest.fn().mockResolvedValue([]),
  } as unknown as InvoiceRepository;
}

function makeMockQuotationRepo(): QuotationRepository {
  return {
    createQuotation: jest.fn(),
    getQuotation: jest.fn(),
    updateQuotation: jest.fn(),
    deleteQuotation: jest.fn(),
    findByReference: jest.fn(),
    findByTask: jest.fn().mockResolvedValue([]),
    findByProjectId: jest.fn(),
    listQuotations: jest.fn(),
  } as unknown as QuotationRepository;
}

describe('CompleteTaskAndSettlePaymentsUseCase', () => {
  // AC-5: throws TaskNotFoundError when task doesn't exist
  it('throws TaskNotFoundError when the task does not exist', async () => {
    const taskRepo = makeMockTaskRepo({ findById: jest.fn().mockResolvedValue(null) });
    const paymentRepo = makeMockPaymentRepo([]);
    const invoiceRepo = makeMockInvoiceRepo(null);
    const quotationRepo = makeMockQuotationRepo();
    const useCase = new CompleteTaskAndSettlePaymentsUseCase(taskRepo, paymentRepo, invoiceRepo, quotationRepo);

    await expect(useCase.execute('nonexistent')).rejects.toThrow(TaskNotFoundError);
  });

  // AC-5/11: task with no quoteInvoiceId → just completes (no payment settling)
  it('completes task with no quoteInvoiceId without settling payments', async () => {
    const task = makeTask({ quoteInvoiceId: undefined });
    const taskRepo = makeMockTaskRepo({ findById: jest.fn().mockResolvedValue(task) });
    const paymentRepo = makeMockPaymentRepo([]);
    const invoiceRepo = makeMockInvoiceRepo(null);
    const quotationRepo = makeMockQuotationRepo();
    const useCase = new CompleteTaskAndSettlePaymentsUseCase(taskRepo, paymentRepo, invoiceRepo, quotationRepo);

    await useCase.execute('task-1');

    expect(paymentRepo.findByInvoice).not.toHaveBeenCalled();
    expect(taskRepo.update).toHaveBeenCalledTimes(1);
    const updated = (taskRepo.update as jest.Mock).mock.calls[0][0] as Task;
    expect(updated.status).toBe('completed');
  });

  // AC-11: settles all pending payments then completes the task
  it('settles all pending payments and completes the task', async () => {
    const task = makeTask({ quoteInvoiceId: 'inv-1' });
    const invoice = makeInvoice({ id: 'inv-1', total: 2000 });
    const payments = [
      makePayment({ id: 'pay-1', status: 'pending', invoiceId: 'inv-1' }),
      makePayment({ id: 'pay-2', status: 'pending', invoiceId: 'inv-1', amount: 500 }),
    ];
    const taskRepo = makeMockTaskRepo({ findById: jest.fn().mockResolvedValue(task) });
    const paymentRepo = makeMockPaymentRepo(payments);
    const invoiceRepo = makeMockInvoiceRepo(invoice);
    const quotationRepo = makeMockQuotationRepo();
    const useCase = new CompleteTaskAndSettlePaymentsUseCase(taskRepo, paymentRepo, invoiceRepo, quotationRepo);

    await useCase.execute('task-1');

    // Both payments should be updated (settled)
    expect(paymentRepo.update).toHaveBeenCalledTimes(2);
    const updatedPayments = (paymentRepo.update as jest.Mock).mock.calls.map(call => call[0] as Payment);
    expect(updatedPayments.every(p => p.status === 'settled')).toBe(true);

    // Task should be completed
    expect(taskRepo.update).toHaveBeenCalledTimes(1);
    const updatedTask = (taskRepo.update as jest.Mock).mock.calls[0][0] as Task;
    expect(updatedTask.status).toBe('completed');
  });

  // AC-11: only pending payments are settled (settled payments are skipped)
  it('only settles pending payments, skips already settled ones', async () => {
    const task = makeTask({ quoteInvoiceId: 'inv-1' });
    const invoice = makeInvoice({ id: 'inv-1' });
    const payments = [
      makePayment({ id: 'pay-settled', status: 'settled', invoiceId: 'inv-1' }),
      makePayment({ id: 'pay-pending', status: 'pending', invoiceId: 'inv-1' }),
    ];
    const taskRepo = makeMockTaskRepo({ findById: jest.fn().mockResolvedValue(task) });
    const paymentRepo = makeMockPaymentRepo(payments);
    const invoiceRepo = makeMockInvoiceRepo(invoice);
    const quotationRepo = makeMockQuotationRepo();
    const useCase = new CompleteTaskAndSettlePaymentsUseCase(taskRepo, paymentRepo, invoiceRepo, quotationRepo);

    await useCase.execute('task-1');

    // Only 1 payment update (the pending one)
    expect(paymentRepo.update).toHaveBeenCalledTimes(1);
    const updatedPayment = (paymentRepo.update as jest.Mock).mock.calls[0][0] as Payment;
    expect(updatedPayment.id).toBe('pay-pending');
    expect(updatedPayment.status).toBe('settled');

    // Task completed
    expect(taskRepo.update).toHaveBeenCalledTimes(1);
  });
});
