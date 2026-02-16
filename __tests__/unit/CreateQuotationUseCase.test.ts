import { Quotation } from '../../src/domain/entities/Quotation';
import { QuotationRepository } from '../../src/domain/repositories/QuotationRepository';
import { CreateQuotationUseCase } from '../../src/application/usecases/quotation/CreateQuotationUseCase';

describe('CreateQuotationUseCase', () => {
  it('creates a quotation via repository and returns created quotation', async () => {
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
      createQuotation: jest.fn().mockResolvedValue(quotation),
      getQuotation: jest.fn(),
      updateQuotation: jest.fn(),
      deleteQuotation: jest.fn(),
      findByReference: jest.fn(),
      listQuotations: jest.fn(),
    } as unknown as QuotationRepository;

    const uc = new CreateQuotationUseCase(mockRepo);
    const result = await uc.execute(quotation);

    expect((mockRepo.createQuotation as jest.Mock).mock.calls.length).toBe(1);
    expect(result).toEqual(quotation);
  });
});
