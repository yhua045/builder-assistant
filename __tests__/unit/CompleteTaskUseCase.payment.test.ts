/**
 * Tests for the payment-validation path added to CompleteTaskUseCase (AC-4).
 * The existing quotation-validation tests live in CompleteTaskUseCase.test.ts.
 */
import { CompleteTaskUseCase } from '../../src/features/tasks/application/CompleteTaskUseCase';
import { TaskRepository } from '../../src/domain/repositories/TaskRepository';
import { QuotationRepository } from '../../src/domain/repositories/QuotationRepository';
import { PaymentRepository } from '../../src/domain/repositories/PaymentRepository';
import {
  PendingPaymentsForTaskError,
} from '../../src/features/tasks/application/TaskCompletionErrors';
import { Task } from '../../src/domain/entities/Task';
import { Payment } from '../../src/domain/entities/Payment';

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

function makeMockPaymentRepo(paymentsForInvoice: Payment[] = []): PaymentRepository {
  return {
    save: jest.fn(),
    findById: jest.fn().mockResolvedValue(null),
    findAll: jest.fn().mockResolvedValue([]),
    findByInvoice: jest.fn().mockResolvedValue(paymentsForInvoice),
    findByProjectId: jest.fn().mockResolvedValue([]),
    findPendingByProject: jest.fn().mockResolvedValue([]),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
    list: jest.fn().mockResolvedValue({ items: [], meta: { total: 0 } }),
    getMetrics: jest.fn().mockResolvedValue({ pendingTotalNext7Days: 0, overdueCount: 0 }),
  } as unknown as PaymentRepository;
}

describe('CompleteTaskUseCase — payment validation (AC-4)', () => {
  // AC-4a: no paymentRepository provided → completes without payment check (backward compat)
  it('completes task without payment check when paymentRepository is not provided', async () => {
    const task = makeTask({ quoteInvoiceId: 'inv-1' });
    const taskRepo = makeMockTaskRepo({ findById: jest.fn().mockResolvedValue(task) });
    const quotationRepo = makeMockQuotationRepo();
    const useCase = new CompleteTaskUseCase(taskRepo, quotationRepo);

    await useCase.execute('task-1');

    expect(taskRepo.update).toHaveBeenCalledTimes(1);
  });

  // AC-4b: paymentRepository provided, no pending payments → completes successfully
  it('completes task when paymentRepository provided but no pending payments', async () => {
    const task = makeTask({ quoteInvoiceId: 'inv-1' });
    const taskRepo = makeMockTaskRepo({ findById: jest.fn().mockResolvedValue(task) });
    const quotationRepo = makeMockQuotationRepo();
    const paymentRepo = makeMockPaymentRepo([makePayment({ status: 'settled' })]);
    const useCase = new CompleteTaskUseCase(taskRepo, quotationRepo, paymentRepo);

    await useCase.execute('task-1');

    expect(taskRepo.update).toHaveBeenCalledTimes(1);
    const updatedTask = (taskRepo.update as jest.Mock).mock.calls[0][0] as Task;
    expect(updatedTask.status).toBe('completed');
  });

  // AC-4c: paymentRepository provided, pending payments exist → throws PendingPaymentsForTaskError
  it('throws PendingPaymentsForTaskError when pending payments exist on linked invoice', async () => {
    const task = makeTask({ quoteInvoiceId: 'inv-1' });
    const taskRepo = makeMockTaskRepo({ findById: jest.fn().mockResolvedValue(task) });
    const quotationRepo = makeMockQuotationRepo();
    const paymentRepo = makeMockPaymentRepo([makePayment({ status: 'pending' })]);
    const useCase = new CompleteTaskUseCase(taskRepo, quotationRepo, paymentRepo);

    await expect(useCase.execute('task-1')).rejects.toThrow(PendingPaymentsForTaskError);
    expect(taskRepo.update).not.toHaveBeenCalled();
  });

  // AC-4d: error carries the pending payment records
  it('PendingPaymentsForTaskError contains the pending payment details', async () => {
    const task = makeTask({ quoteInvoiceId: 'inv-1' });
    const taskRepo = makeMockTaskRepo({ findById: jest.fn().mockResolvedValue(task) });
    const quotationRepo = makeMockQuotationRepo();
    const pendingPayment = makePayment({ id: 'pay-X', amount: 2500, contractorName: 'Alice', dueDate: '2026-05-01', status: 'pending' });
    const paymentRepo = makeMockPaymentRepo([pendingPayment]);
    const useCase = new CompleteTaskUseCase(taskRepo, quotationRepo, paymentRepo);

    let caught: PendingPaymentsForTaskError | undefined;
    try {
      await useCase.execute('task-1');
    } catch (err) {
      if (err instanceof PendingPaymentsForTaskError) caught = err;
    }

    expect(caught).toBeDefined();
    expect(caught!.pendingPayments).toHaveLength(1);
    expect(caught!.pendingPayments[0].id).toBe('pay-X');
    expect(caught!.pendingPayments[0].amount).toBe(2500);
    expect(caught!.code).toBe('PENDING_PAYMENTS_FOR_TASK');
  });

  // AC-4e: task has no quoteInvoiceId → no payment check call
  it('does not call findByInvoice when task has no quoteInvoiceId', async () => {
    const task = makeTask({ quoteInvoiceId: undefined });
    const taskRepo = makeMockTaskRepo({ findById: jest.fn().mockResolvedValue(task) });
    const quotationRepo = makeMockQuotationRepo();
    const paymentRepo = makeMockPaymentRepo([]);
    const useCase = new CompleteTaskUseCase(taskRepo, quotationRepo, paymentRepo);

    await useCase.execute('task-1');

    expect(paymentRepo.findByInvoice).not.toHaveBeenCalled();
    expect(taskRepo.update).toHaveBeenCalledTimes(1);
  });
});
