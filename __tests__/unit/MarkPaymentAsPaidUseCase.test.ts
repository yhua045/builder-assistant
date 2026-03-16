import { MarkPaymentAsPaidUseCase } from '../../src/application/usecases/payment/MarkPaymentAsPaidUseCase';
import { PaymentRepository } from '../../src/domain/repositories/PaymentRepository';
import { InvoiceRepository } from '../../src/domain/repositories/InvoiceRepository';
import { Payment } from '../../src/domain/entities/Payment';
import { Invoice } from '../../src/domain/entities/Invoice';

const makePayment = (overrides: Partial<Payment> = {}): Payment => ({
  id: 'pay_1',
  amount: 500,
  status: 'pending',
  invoiceId: 'inv_1',
  currency: 'AUD',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  ...overrides,
});

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

describe('MarkPaymentAsPaidUseCase', () => {
  let paymentRepo: jest.Mocked<PaymentRepository>;
  let invoiceRepo: jest.Mocked<InvoiceRepository>;
  let useCase: MarkPaymentAsPaidUseCase;

  beforeEach(() => {
    paymentRepo = {
      findById: jest.fn(),
      update: jest.fn(),
      findByInvoice: jest.fn(),
      save: jest.fn(),
      findAll: jest.fn(),
      findByProjectId: jest.fn(),
      findPendingByProject: jest.fn(),
      delete: jest.fn(),
      list: jest.fn(),
      getMetrics: jest.fn(),
      getGlobalAmountPayable: jest.fn(),
    } as any;

    invoiceRepo = {
      getInvoice: jest.fn(),
      updateInvoice: jest.fn(),
      createInvoice: jest.fn(),
      deleteInvoice: jest.fn(),
      findByExternalKey: jest.fn(),
      listInvoices: jest.fn(),
      assignProject: jest.fn(),
    } as any;

    useCase = new MarkPaymentAsPaidUseCase(paymentRepo, invoiceRepo);
  });

  it('throws when payment is not found', async () => {
    paymentRepo.findById.mockResolvedValue(null);
    await expect(useCase.execute({ paymentId: 'nonexistent' })).rejects.toThrow('not found');
  });

  it('throws when payment is already settled', async () => {
    paymentRepo.findById.mockResolvedValue(makePayment({ status: 'settled' }));
    await expect(useCase.execute({ paymentId: 'pay_1' })).rejects.toThrow('already settled');
  });

  it('marks a pending payment as settled', async () => {
    const payment = makePayment();
    const invoice = makeInvoice();
    paymentRepo.findById.mockResolvedValue(payment);
    paymentRepo.update.mockResolvedValue(undefined);
    invoiceRepo.getInvoice.mockResolvedValue(invoice);
    paymentRepo.findByInvoice.mockResolvedValue([{ ...payment, status: 'settled' }]);
    invoiceRepo.updateInvoice.mockResolvedValue({ ...invoice, paymentStatus: 'partial' });

    const result = await useCase.execute({ paymentId: 'pay_1' });

    expect(paymentRepo.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'pay_1', status: 'settled' }),
    );
    expect(result.payment.status).toBe('settled');
  });

  it('sets invoice paymentStatus to "paid" when full amount settled', async () => {
    const payment = makePayment({ amount: 1000 });
    const invoice = makeInvoice({ total: 1000 });
    paymentRepo.findById.mockResolvedValue(payment);
    paymentRepo.update.mockResolvedValue(undefined);
    invoiceRepo.getInvoice.mockResolvedValue(invoice);
    // findByInvoice returns the now-settled payment
    paymentRepo.findByInvoice.mockResolvedValue([{ ...payment, status: 'settled' }]);
    invoiceRepo.updateInvoice.mockResolvedValue({ ...invoice, paymentStatus: 'paid', status: 'paid' });

    const result = await useCase.execute({ paymentId: 'pay_1' });

    expect(invoiceRepo.updateInvoice).toHaveBeenCalledWith(
      'inv_1',
      expect.objectContaining({ paymentStatus: 'paid', status: 'paid' }),
    );
    expect(result.invoicePaymentStatus).toBe('paid');
  });

  it('sets invoice paymentStatus to "partial" for a partial payment', async () => {
    const payment = makePayment({ amount: 400 });
    const invoice = makeInvoice({ total: 1000 });
    paymentRepo.findById.mockResolvedValue(payment);
    paymentRepo.update.mockResolvedValue(undefined);
    invoiceRepo.getInvoice.mockResolvedValue(invoice);
    paymentRepo.findByInvoice.mockResolvedValue([{ ...payment, status: 'settled' }]);
    invoiceRepo.updateInvoice.mockResolvedValue({ ...invoice, paymentStatus: 'partial' });

    const result = await useCase.execute({ paymentId: 'pay_1' });

    expect(result.invoicePaymentStatus).toBe('partial');
  });

  it('does not count cancelled payments when recalculating invoice totalSettled', async () => {
    const payment = makePayment({ amount: 400 });
    const invoice = makeInvoice({ total: 1000 });
    paymentRepo.findById.mockResolvedValue(payment);
    paymentRepo.update.mockResolvedValue(undefined);
    invoiceRepo.getInvoice.mockResolvedValue(invoice);
    // The settled payment (400) + a cancelled one (800) — only 400 should count
    paymentRepo.findByInvoice.mockResolvedValue([
      { ...payment, status: 'settled' },
      { id: 'pay_cancelled', invoiceId: 'inv_1', amount: 800, status: 'cancelled' } as any,
    ]);
    invoiceRepo.updateInvoice.mockResolvedValue({ ...invoice, paymentStatus: 'partial' });

    const result = await useCase.execute({ paymentId: 'pay_1' });

    expect(result.invoicePaymentStatus).toBe('partial');
    expect(invoiceRepo.updateInvoice).not.toHaveBeenCalledWith(
      'inv_1',
      expect.objectContaining({ paymentStatus: 'paid' }),
    );
  });

  it('does not count reverse_payment records when recalculating invoice totalSettled', async () => {
    const payment = makePayment({ amount: 400 });
    const invoice = makeInvoice({ total: 1000 });
    paymentRepo.findById.mockResolvedValue(payment);
    paymentRepo.update.mockResolvedValue(undefined);
    invoiceRepo.getInvoice.mockResolvedValue(invoice);
    paymentRepo.findByInvoice.mockResolvedValue([
      { ...payment, status: 'settled' },
      { id: 'pay_rev', invoiceId: 'inv_1', amount: 700, status: 'reverse_payment' } as any,
    ]);
    invoiceRepo.updateInvoice.mockResolvedValue({ ...invoice, paymentStatus: 'partial' });

    const result = await useCase.execute({ paymentId: 'pay_1' });

    expect(result.invoicePaymentStatus).toBe('partial');
  });
});
