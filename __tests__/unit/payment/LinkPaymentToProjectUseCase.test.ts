import { LinkPaymentToProjectUseCase } from '../../../src/application/usecases/payment/LinkPaymentToProjectUseCase';
import { PaymentNotPendingError } from '../../../src/application/errors/PaymentErrors';
import { PaymentRepository } from '../../../src/domain/repositories/PaymentRepository';
import { Payment } from '../../../src/domain/entities/Payment';

function makeRepo(payment?: Payment | null): jest.Mocked<PaymentRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn().mockResolvedValue(payment ?? null),
    findAll: jest.fn(),
    findByInvoice: jest.fn(),
    findByProjectId: jest.fn(),
    findPendingByProject: jest.fn(),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn(),
    list: jest.fn(),
    getMetrics: jest.fn(),
    getGlobalAmountPayable: jest.fn(),
  } as unknown as jest.Mocked<PaymentRepository>;
}

const pendingPayment: Payment = {
  id: 'pay_001',
  amount: 500,
  status: 'pending',
};

describe('LinkPaymentToProjectUseCase', () => {
  it('assigns project to a pending payment', async () => {
    const repo = makeRepo(pendingPayment);
    const uc = new LinkPaymentToProjectUseCase(repo);

    const result = await uc.execute({ paymentId: 'pay_001', projectId: 'proj_a' });

    expect(repo.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'pay_001', projectId: 'proj_a' }),
    );
    expect(result.projectId).toBe('proj_a');
  });

  it('clears project when projectId is undefined', async () => {
    const repo = makeRepo({ ...pendingPayment, projectId: 'proj_a' });
    const uc = new LinkPaymentToProjectUseCase(repo);

    const result = await uc.execute({ paymentId: 'pay_001', projectId: undefined });

    expect(repo.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'pay_001', projectId: undefined }),
    );
    expect(result.projectId).toBeUndefined();
  });

  it('throws PaymentNotPendingError when payment status is settled', async () => {
    const repo = makeRepo({ ...pendingPayment, status: 'settled' });
    const uc = new LinkPaymentToProjectUseCase(repo);

    await expect(
      uc.execute({ paymentId: 'pay_001', projectId: 'proj_a' }),
    ).rejects.toThrow(PaymentNotPendingError);
  });

  it('throws PaymentNotPendingError when payment status is cancelled', async () => {
    const repo = makeRepo({ ...pendingPayment, status: 'cancelled' });
    const uc = new LinkPaymentToProjectUseCase(repo);

    await expect(
      uc.execute({ paymentId: 'pay_001', projectId: 'proj_a' }),
    ).rejects.toThrow(PaymentNotPendingError);
  });

  it('throws when payment is not found', async () => {
    const repo = makeRepo(null);
    const uc = new LinkPaymentToProjectUseCase(repo);

    await expect(
      uc.execute({ paymentId: 'pay_missing', projectId: 'proj_a' }),
    ).rejects.toThrow('Payment not found: pay_missing');
  });
});
