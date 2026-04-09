import { TaskPaymentValidator } from '../../src/application/usecases/task/TaskPaymentValidator';
import { PaymentRepository } from '../../src/domain/repositories/PaymentRepository';
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

describe('TaskPaymentValidator', () => {
  // AC-1: task has no quoteInvoiceId → ok: true, no pending payments
  it('returns ok when the task has no quoteInvoiceId', async () => {
    const task = makeTask({ quoteInvoiceId: undefined });
    const paymentRepo = makeMockPaymentRepo([]);
    const validator = new TaskPaymentValidator(paymentRepo);

    const result = await validator.validate(task);

    expect(result.ok).toBe(true);
    expect(result.pendingPayments).toHaveLength(0);
    expect(paymentRepo.findByInvoice).not.toHaveBeenCalled();
  });

  // AC-2: task has quoteInvoiceId but no pending payments → ok: true
  it('returns ok when the linked invoice has no pending payments', async () => {
    const task = makeTask({ quoteInvoiceId: 'inv-1' });
    const settledPayment = makePayment({ status: 'settled' });
    const paymentRepo = makeMockPaymentRepo([settledPayment]);
    const validator = new TaskPaymentValidator(paymentRepo);

    const result = await validator.validate(task);

    expect(result.ok).toBe(true);
    expect(result.pendingPayments).toHaveLength(0);
    expect(paymentRepo.findByInvoice).toHaveBeenCalledWith('inv-1');
  });

  // AC-3: task has quoteInvoiceId with pending payments → ok: false, pendingPayments populated
  it('returns not-ok when the linked invoice has one or more pending payments', async () => {
    const task = makeTask({ quoteInvoiceId: 'inv-1' });
    const pendingPayment = makePayment({ id: 'pay-1', amount: 1500, contractorName: 'Alice', dueDate: '2026-04-01', status: 'pending' });
    const paymentRepo = makeMockPaymentRepo([pendingPayment]);
    const validator = new TaskPaymentValidator(paymentRepo);

    const result = await validator.validate(task);

    expect(result.ok).toBe(false);
    expect(result.pendingPayments).toHaveLength(1);
    expect(result.pendingPayments[0].id).toBe('pay-1');
    expect(result.pendingPayments[0].amount).toBe(1500);
    expect(result.pendingPayments[0].contractorName).toBe('Alice');
    expect(result.pendingPayments[0].dueDate).toBe('2026-04-01');
  });

  // AC-3 additional: mixed settled + pending → only pending ones returned
  it('filters out settled payments and only returns pending ones', async () => {
    const task = makeTask({ quoteInvoiceId: 'inv-2' });
    const payments = [
      makePayment({ id: 'pay-settled', status: 'settled' }),
      makePayment({ id: 'pay-pending-1', status: 'pending' }),
      makePayment({ id: 'pay-pending-2', status: 'pending' }),
    ];
    const paymentRepo = makeMockPaymentRepo(payments);
    const validator = new TaskPaymentValidator(paymentRepo);

    const result = await validator.validate(task);

    expect(result.ok).toBe(false);
    expect(result.pendingPayments).toHaveLength(2);
    expect(result.pendingPayments.map(p => p.id)).toEqual(
      expect.arrayContaining(['pay-pending-1', 'pay-pending-2']),
    );
    expect(result.pendingPayments.map(p => p.id)).not.toContain('pay-settled');
  });
});
