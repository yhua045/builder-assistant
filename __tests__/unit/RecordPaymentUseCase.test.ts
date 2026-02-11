import { Payment } from '../../src/domain/entities/Payment';
import { PaymentRepository } from '../../src/domain/repositories/PaymentRepository';
import { InvoiceRepository } from '../../src/domain/repositories/InvoiceRepository';
import { RecordPaymentUseCase } from '../../src/application/usecases/payment/RecordPaymentUseCase';

describe('RecordPaymentUseCase', () => {
  it('saves payment via payment repository', async () => {
    const payment: Payment = {
      id: 'pay_1',
      projectId: 'proj_1',
      amount: 100,
    } as Payment;

    const mockPaymentRepo: PaymentRepository = {
      save: jest.fn().mockResolvedValue(undefined),
      findById: jest.fn(),
      findAll: jest.fn(),
      findByProjectId: jest.fn(),
      findPendingByProject: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as unknown as PaymentRepository;

    const mockInvoiceRepo: InvoiceRepository = {
      createInvoice: jest.fn(),
      getInvoice: jest.fn(),
      updateInvoice: jest.fn(),
      deleteInvoice: jest.fn(),
      findByExternalKey: jest.fn(),
      listInvoices: jest.fn(),
      assignProject: jest.fn(),
    } as unknown as InvoiceRepository;

    const uc = new RecordPaymentUseCase(mockPaymentRepo, mockInvoiceRepo);
    await uc.execute(payment);

    expect((mockPaymentRepo.save as jest.Mock).mock.calls.length).toBe(1);
    expect((mockPaymentRepo.save as jest.Mock).mock.calls[0][0]).toEqual(payment);
  });
});
