import { GetGlobalAmountPayableUseCase } from '../../application/GetGlobalAmountPayableUseCase';
import { PaymentRepository } from '../../../../domain/repositories/PaymentRepository';

function makeRepo(total = 0): jest.Mocked<PaymentRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn(),
    findByInvoice: jest.fn(),
    findByProjectId: jest.fn(),
    findPendingByProject: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    list: jest.fn(),
    getMetrics: jest.fn(),
    getGlobalAmountPayable: jest.fn().mockResolvedValue(total),
  } as unknown as jest.Mocked<PaymentRepository>;
}

describe('GetGlobalAmountPayableUseCase', () => {
  it('returns the total from repo.getGlobalAmountPayable', async () => {
    const repo = makeRepo(12500);
    const uc = new GetGlobalAmountPayableUseCase(repo);

    const result = await uc.execute();

    expect(result).toBe(12500);
    expect(repo.getGlobalAmountPayable).toHaveBeenCalledWith(undefined);
  });

  it('returns 0 when no pending payments exist', async () => {
    const repo = makeRepo(0);
    const uc = new GetGlobalAmountPayableUseCase(repo);

    expect(await uc.execute()).toBe(0);
  });

  it('forwards contractorSearch to the repo', async () => {
    const repo = makeRepo(3000);
    const uc = new GetGlobalAmountPayableUseCase(repo);

    await uc.execute('Jones');

    expect(repo.getGlobalAmountPayable).toHaveBeenCalledWith('Jones');
  });
});
