import { ListPaymentsUseCase } from '../../src/application/usecases/payment/ListPaymentsUseCase';
import { PaymentRepository } from '../../src/domain/repositories/PaymentRepository';

describe('ListPaymentsUseCase (presets)', () => {
  const fixedNow = new Date('2026-02-13T00:00:00.000Z');

  beforeAll(() => {
    jest.useFakeTimers();
    // setSystemTime works with fake timers in modern environments
    jest.setSystemTime(fixedNow as unknown as number);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('calls repo.list with from/to for upcoming preset', async () => {
    const mockList = jest.fn().mockResolvedValue({ items: [], meta: { total: 0 } });
    const repo: Partial<PaymentRepository> = { list: mockList };
    const uc = new ListPaymentsUseCase(repo as PaymentRepository);

    await uc.execute({ preset: 'upcoming' });

    expect(mockList).toHaveBeenCalledTimes(1);
    const calledWith = mockList.mock.calls[0][0];
    expect(calledWith.status).toBe('pending');
    expect(calledWith.fromDate).toBe(fixedNow.toISOString());
    expect(calledWith.toDate).toBe(new Date(fixedNow.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString());
  });

  it('calls repo.list with isOverdue for overdue preset', async () => {
    const mockList = jest.fn().mockResolvedValue({ items: [], meta: { total: 0 } });
    const repo: Partial<PaymentRepository> = { list: mockList };
    const uc = new ListPaymentsUseCase(repo as PaymentRepository);

    await uc.execute({ preset: 'overdue' });

    expect(mockList).toHaveBeenCalledTimes(1);
    const calledWith = mockList.mock.calls[0][0];
    expect(calledWith.isOverdue).toBe(true);
  });

  it('calls repo.list with from/to and status=settled for paid preset', async () => {
    const mockList = jest.fn().mockResolvedValue({ items: [], meta: { total: 0 } });
    const repo: Partial<PaymentRepository> = { list: mockList };
    const uc = new ListPaymentsUseCase(repo as PaymentRepository);

    await uc.execute({ preset: 'paid' });

    expect(mockList).toHaveBeenCalledTimes(1);
    const calledWith = mockList.mock.calls[0][0];
    expect(calledWith.status).toBe('settled');
    expect(calledWith.fromDate).toBe(new Date(fixedNow.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString());
    expect(calledWith.toDate).toBe(fixedNow.toISOString());
  });
});
