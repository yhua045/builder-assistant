import { Quotation } from '../../../../domain/entities/Quotation';
import { QuotationRepository } from '../../../../domain/repositories/QuotationRepository';
import { GetQuotationByIdUseCase } from '../../application/GetQuotationByIdUseCase';

describe('GetQuotationByIdUseCase', () => {
  it('retrieves a quotation by id via repository', async () => {
    const quotation: Quotation = {
      id: 'quot_test_1',
      reference: 'QT-001',
      date: '2026-01-15',
      total: 1000,
      currency: 'USD',
      status: 'draft',
      createdAt: '2026-01-15T00:00:00.000Z',
      updatedAt: '2026-01-15T00:00:00.000Z',
    };

    const mockRepo: QuotationRepository = {
      createQuotation: jest.fn(),
      getQuotation: jest.fn().mockResolvedValue(quotation),
      updateQuotation: jest.fn(),
      deleteQuotation: jest.fn(),
      findByReference: jest.fn(),
      listQuotations: jest.fn(),
    } as unknown as QuotationRepository;

    const uc = new GetQuotationByIdUseCase(mockRepo);
    const result = await uc.execute('quot_test_1');

    expect((mockRepo.getQuotation as jest.Mock).mock.calls.length).toBe(1);
    expect((mockRepo.getQuotation as jest.Mock).mock.calls[0][0]).toBe('quot_test_1');
    expect(result).toEqual(quotation);
  });

  it('returns null when quotation is not found', async () => {
    const mockRepo: QuotationRepository = {
      createQuotation: jest.fn(),
      getQuotation: jest.fn().mockResolvedValue(null),
      updateQuotation: jest.fn(),
      deleteQuotation: jest.fn(),
      findByReference: jest.fn(),
      listQuotations: jest.fn(),
    } as unknown as QuotationRepository;

    const uc = new GetQuotationByIdUseCase(mockRepo);
    const result = await uc.execute('nonexistent');

    expect(result).toBeNull();
  });
});
