import { Payment } from '../../src/domain/entities/Payment';
import { PaymentRepository } from '../../src/domain/repositories/PaymentRepository';
import { InvoiceRepository } from '../../src/domain/repositories/InvoiceRepository';
import { RecordPaymentUseCase } from '../../src/application/usecases/payment/RecordPaymentUseCase';
import { Invoice } from '../../src/domain/entities/Invoice';

const makeInvoice = (overrides: Partial<Invoice> = {}): Invoice => ({
  id: 'inv_1',
  total: 1000,
  currency: 'AUD',
  status: 'issued',
  paymentStatus: 'unpaid',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  ...overrides,
});

const baseRepos = () => ({
  paymentRepo: {
    save: jest.fn().mockResolvedValue(undefined),
    findById: jest.fn(),
    findAll: jest.fn(),
    findByProjectId: jest.fn(),
    findPendingByProject: jest.fn(),
    findByInvoice: jest.fn().mockResolvedValue([]),
    update: jest.fn(),
    delete: jest.fn(),
  } as unknown as jest.Mocked<PaymentRepository>,
  invoiceRepo: {
    createInvoice: jest.fn(),
    getInvoice: jest.fn(),
    updateInvoice: jest.fn().mockResolvedValue(undefined),
    deleteInvoice: jest.fn(),
    findByExternalKey: jest.fn(),
    listInvoices: jest.fn(),
    assignProject: jest.fn(),
  } as unknown as jest.Mocked<InvoiceRepository>,
});

describe('RecordPaymentUseCase', () => {
  it('saves payment via payment repository', async () => {
    const payment: Payment = {
      id: 'pay_1',
      projectId: 'proj_1',
      amount: 100,
    } as Payment;

    const { paymentRepo, invoiceRepo } = baseRepos();

    const uc = new RecordPaymentUseCase(paymentRepo, invoiceRepo);
    await uc.execute(payment);

    expect((paymentRepo.save as jest.Mock).mock.calls.length).toBe(1);
    expect((paymentRepo.save as jest.Mock).mock.calls[0][0]).toEqual(payment);
  });

  it('sets invoice paymentStatus to partial when a payment is less than total', async () => {
    const { paymentRepo, invoiceRepo } = baseRepos();
    const payment: Payment = { id: 'pay_1', invoiceId: 'inv_1', amount: 400 } as Payment;
    invoiceRepo.getInvoice.mockResolvedValue(makeInvoice());
    paymentRepo.findByInvoice.mockResolvedValue([payment]);

    const uc = new RecordPaymentUseCase(paymentRepo, invoiceRepo);
    await uc.execute(payment);

    expect(invoiceRepo.updateInvoice).toHaveBeenCalledWith('inv_1', expect.objectContaining({ paymentStatus: 'partial' }));
  });

  it('sets invoice paymentStatus to paid when payments cover total', async () => {
    const { paymentRepo, invoiceRepo } = baseRepos();
    const payment: Payment = { id: 'pay_1', invoiceId: 'inv_1', amount: 1000 } as Payment;
    invoiceRepo.getInvoice.mockResolvedValue(makeInvoice());
    paymentRepo.findByInvoice.mockResolvedValue([payment]);

    const uc = new RecordPaymentUseCase(paymentRepo, invoiceRepo);
    await uc.execute(payment);

    expect(invoiceRepo.updateInvoice).toHaveBeenCalledWith(
      'inv_1',
      expect.objectContaining({ paymentStatus: 'paid', status: 'paid' }),
    );
  });

  it('does not count cancelled payments toward totalSettled', async () => {
    const { paymentRepo, invoiceRepo } = baseRepos();
    const newPayment: Payment = { id: 'pay_2', invoiceId: 'inv_1', amount: 300 } as Payment;
    // A cancelled payment should NOT contribute to the total
    const cancelledPayment: Payment = { id: 'pay_1', invoiceId: 'inv_1', amount: 800, status: 'cancelled' } as Payment;
    invoiceRepo.getInvoice.mockResolvedValue(makeInvoice());
    paymentRepo.findByInvoice.mockResolvedValue([cancelledPayment, newPayment]);

    const uc = new RecordPaymentUseCase(paymentRepo, invoiceRepo);
    await uc.execute(newPayment);

    // Only the 300 payment counts; 800 cancelled is excluded → partial not paid
    expect(invoiceRepo.updateInvoice).toHaveBeenCalledWith(
      'inv_1',
      expect.objectContaining({ paymentStatus: 'partial' }),
    );
    expect(invoiceRepo.updateInvoice).not.toHaveBeenCalledWith(
      'inv_1',
      expect.objectContaining({ paymentStatus: 'paid' }),
    );
  });

  it('does not count reverse_payment records toward totalSettled', async () => {
    const { paymentRepo, invoiceRepo } = baseRepos();
    const newPayment: Payment = { id: 'pay_2', invoiceId: 'inv_1', amount: 500 } as Payment;
    const reversalPayment: Payment = { id: 'pay_r', invoiceId: 'inv_1', amount: 600, status: 'reverse_payment' } as Payment;
    invoiceRepo.getInvoice.mockResolvedValue(makeInvoice());
    paymentRepo.findByInvoice.mockResolvedValue([reversalPayment, newPayment]);

    const uc = new RecordPaymentUseCase(paymentRepo, invoiceRepo);
    await uc.execute(newPayment);

    // Only 500 counts; reversal excluded → partial
    expect(invoiceRepo.updateInvoice).toHaveBeenCalledWith(
      'inv_1',
      expect.objectContaining({ paymentStatus: 'partial' }),
    );
  });
});
