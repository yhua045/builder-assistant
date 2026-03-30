import { ListGlobalPaymentsUseCase } from '../../../src/application/usecases/payment/ListGlobalPaymentsUseCase';
import { PaymentRepository } from '../../../src/domain/repositories/PaymentRepository';

function makeRepo(items = []): jest.Mocked<PaymentRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn(),
    findByInvoice: jest.fn(),
    findByProjectId: jest.fn(),
    findPendingByProject: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    list: jest.fn().mockResolvedValue({ items, meta: { total: items.length } } as PaymentListResult),
    getMetrics: jest.fn(),
    getGlobalAmountPayable: jest.fn(),
  } as unknown as jest.Mocked<PaymentRepository>;
}

describe('ListGlobalPaymentsUseCase', () => {
  it('calls repo.list with allProjects:true and status:pending', async () => {
    const repo = makeRepo();
    const uc = new ListGlobalPaymentsUseCase(repo);

    await uc.execute({});

    expect(repo.list).toHaveBeenCalledWith(
      expect.objectContaining({ allProjects: true, status: 'pending' }),
    );
  });

  it('forwards contractorSearch to repo filters', async () => {
    const repo = makeRepo();
    const uc = new ListGlobalPaymentsUseCase(repo);

    await uc.execute({ contractorSearch: 'Smith' });

    expect(repo.list).toHaveBeenCalledWith(
      expect.objectContaining({ contractorSearch: 'Smith' }),
    );
  });

  it('returns the result from repo unchanged', async () => {
    const fakeItems = [{ id: 'p1', amount: 500 }] as any;
    const repo = makeRepo(fakeItems);
    const uc = new ListGlobalPaymentsUseCase(repo);

    const result = await uc.execute({});

    expect(result.items).toEqual(fakeItems);
    expect(result.meta.total).toBe(1);
  });
});
