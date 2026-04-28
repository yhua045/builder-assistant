import { Quotation } from '../../../../domain/entities/Quotation';
import { QuotationRepository } from '../../../../domain/repositories/QuotationRepository';
import { CreateQuotationUseCase, CreateQuotationDTO } from '../../application/CreateQuotationUseCase';

describe('CreateQuotationUseCase', () => {
  it('creates an entity via DTO and passes to repository', async () => {
    const dto: CreateQuotationDTO = {
      reference: 'QT-001',
      date: '2026-01-15',
      total: 1000,
      currency: 'USD',
      status: 'draft',
      // Assuming missing optional fields are omitted for simplicity
    };

    const quotation: Quotation = {
      id: 'mock_id',
      createdAt: '2026-01-15T00:00:00.000Z',
      updatedAt: '2026-01-15T00:00:00.000Z',
      ...dto
    } as any;

    const mockRepo: QuotationRepository = {
      createQuotation: jest.fn().mockResolvedValue(quotation),
    } as unknown as QuotationRepository;

    const uc = new CreateQuotationUseCase(mockRepo);
    const result = await uc.execute(dto);

    expect((mockRepo.createQuotation as jest.Mock).mock.calls.length).toBe(1);
    expect((mockRepo.createQuotation as jest.Mock).mock.calls[0][0]).toMatchObject(dto);
    expect(result).toEqual(quotation);
  });
});
