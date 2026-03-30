/**
 * Unit tests for ListGlobalPaymentsUseCase - status param extension
 * Run: npx jest ListGlobalPaymentsUseCase.paid
 */
import { ListGlobalPaymentsUseCase } from '../../src/application/usecases/payment/ListGlobalPaymentsUseCase';
import {
  PaymentRepository,
  PaymentListResult,
} from '../../src/domain/repositories/PaymentRepository';

function makeRepo(): jest.Mocked<PaymentRepository> {
  return {
    save: jest.fn(),
    findById: jest.fn(),
    findAll: jest.fn(),
    findByInvoice: jest.fn(),
    findByProjectId: jest.fn(),
    findPendingByProject: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    list: jest
      .fn()
      .mockResolvedValue({ items: [], meta: { total: 0 } } as PaymentListResult),
    getMetrics: jest.fn(),
    getGlobalAmountPayable: jest.fn(),
  } as unknown as jest.Mocked<PaymentRepository>;
}

describe('ListGlobalPaymentsUseCase — status param', () => {
  it('uses status:pending by default (backward compat)', async () => {
    const repo = makeRepo();
    const uc = new ListGlobalPaymentsUseCase(repo);

    await uc.execute({});

    expect(repo.list).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending' }),
    );
  });

  it('forwards status:settled when explicitly provided', async () => {
    const repo = makeRepo();
    const uc = new ListGlobalPaymentsUseCase(repo);

    await uc.execute({ status: 'settled' });

    expect(repo.list).toHaveBeenCalledWith(
      expect.objectContaining({ allProjects: true, status: 'settled' }),
    );
  });

  it('forwards contractorSearch alongside status:settled', async () => {
    const repo = makeRepo();
    const uc = new ListGlobalPaymentsUseCase(repo);

    await uc.execute({ status: 'settled', contractorSearch: 'Smith' });

    expect(repo.list).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'settled', contractorSearch: 'Smith' }),
    );
  });

  it('does not call repo with pending when status:settled is requested', async () => {
    const repo = makeRepo();
    const uc = new ListGlobalPaymentsUseCase(repo);

    await uc.execute({ status: 'settled' });

    expect(repo.list).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: 'pending' }),
    );
  });
});
