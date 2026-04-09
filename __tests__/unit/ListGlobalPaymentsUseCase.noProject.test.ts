/**
 * T-18: ListGlobalPaymentsUseCase — noProject flag
 * When noProject: true, repo.list() is called with noProject: true and no status filter.
 */
import { ListGlobalPaymentsUseCase } from '../../src/application/usecases/payment/ListGlobalPaymentsUseCase';
import type { PaymentRepository } from '../../src/domain/repositories/PaymentRepository';

describe('ListGlobalPaymentsUseCase — noProject flag (T-18)', () => {
  const mockRepo: jest.Mocked<Pick<PaymentRepository, 'list'>> = {
    list: jest.fn().mockResolvedValue({ items: [], meta: { total: 0 } }),
  };

  const uc = new ListGlobalPaymentsUseCase(mockRepo as unknown as PaymentRepository);

  beforeEach(() => jest.clearAllMocks());

  it('T-18: passes noProject:true to repo.list() and omits status when noProject is true', async () => {
    await uc.execute({ noProject: true });

    expect(mockRepo.list).toHaveBeenCalledTimes(1);
    const calledFilters = (mockRepo.list as jest.Mock).mock.calls[0][0];
    expect(calledFilters.noProject).toBe(true);
    expect(calledFilters.status).toBeUndefined();
    expect(calledFilters.allProjects).toBe(true);
  });

  it('still defaults to status=pending when noProject is not set', async () => {
    await uc.execute({});

    const calledFilters = (mockRepo.list as jest.Mock).mock.calls[0][0];
    expect(calledFilters.noProject).toBeUndefined();
    expect(calledFilters.status).toBe('pending');
  });
});
