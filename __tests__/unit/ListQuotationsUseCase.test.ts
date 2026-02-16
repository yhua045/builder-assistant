import { Quotation } from '../../src/domain/entities/Quotation';
import { QuotationRepository } from '../../src/domain/repositories/QuotationRepository';
import { ListQuotationsUseCase } from '../../src/application/usecases/quotation/ListQuotationsUseCase';

describe('ListQuotationsUseCase', () => {
  it('lists all quotations via repository', async () => {
    const quotations: Quotation[] = [
      {
        id: 'quot_test_1',
        reference: 'QT-001',
        date: '2026-01-15',
        total: 1000,
        currency: 'USD',
        status: 'draft',
        createdAt: '2026-01-15T00:00:00.000Z',
        updatedAt: '2026-01-15T00:00:00.000Z',
      },
      {
        id: 'quot_test_2',
        reference: 'QT-002',
        date: '2026-01-16',
        total: 2000,
        currency: 'USD',
        status: 'sent',
        createdAt: '2026-01-16T00:00:00.000Z',
        updatedAt: '2026-01-16T00:00:00.000Z',
      },
    ];

    const mockRepo: QuotationRepository = {
      createQuotation: jest.fn(),
      getQuotation: jest.fn(),
      updateQuotation: jest.fn(),
      deleteQuotation: jest.fn(),
      findByReference: jest.fn(),
      listQuotations: jest.fn().mockResolvedValue({ items: quotations, total: 2 }),
    } as unknown as QuotationRepository;

    const uc = new ListQuotationsUseCase(mockRepo);
    const result = await uc.execute();

    expect((mockRepo.listQuotations as jest.Mock).mock.calls.length).toBe(1);
    expect(result.items).toEqual(quotations);
    expect(result.total).toBe(2);
  });

  it('filters quotations by project id', async () => {
    const quotations: Quotation[] = [
      {
        id: 'quot_test_1',
        reference: 'QT-001',
        date: '2026-01-15',
        projectId: 'proj-1',
        total: 1000,
        currency: 'USD',
        status: 'draft',
        createdAt: '2026-01-15T00:00:00.000Z',
        updatedAt: '2026-01-15T00:00:00.000Z',
      },
    ];

    const mockRepo: QuotationRepository = {
      createQuotation: jest.fn(),
      getQuotation: jest.fn(),
      updateQuotation: jest.fn(),
      deleteQuotation: jest.fn(),
      findByReference: jest.fn(),
      listQuotations: jest.fn().mockResolvedValue({ items: quotations, total: 1 }),
    } as unknown as QuotationRepository;

    const uc = new ListQuotationsUseCase(mockRepo);
    const result = await uc.execute({ projectId: 'proj-1' });

    expect((mockRepo.listQuotations as jest.Mock).mock.calls.length).toBe(1);
    expect((mockRepo.listQuotations as jest.Mock).mock.calls[0][0]).toEqual({
      projectId: 'proj-1',
    });
    expect(result.items.length).toBe(1);
  });
});
