import { Quotation } from '../../../../domain/entities/Quotation';
import { QuotationRepository } from '../../../../domain/repositories/QuotationRepository';
import { UpdateQuotationUseCase } from '../../application/UpdateQuotationUseCase';

describe('UpdateQuotationUseCase', () => {
  it('updates a quotation via repository and returns updated quotation', async () => {
    const originalQuotation: Quotation = {
      id: 'quot_test_1',
      reference: 'QT-001',
      date: '2026-01-15',
      total: 1000,
      currency: 'USD',
      status: 'draft',
      createdAt: '2026-01-15T00:00:00.000Z',
      updatedAt: '2026-01-15T00:00:00.000Z',
    };

    const updatedQuotation: Quotation = {
      ...originalQuotation,
      status: 'sent',
      vendorName: 'ABC Supplies',
      updatedAt: '2026-01-16T00:00:00.000Z',
    };

    const mockRepo: QuotationRepository = {
      createQuotation: jest.fn(),
      getQuotation: jest.fn(),
      updateQuotation: jest.fn().mockResolvedValue(updatedQuotation),
      deleteQuotation: jest.fn(),
      findByReference: jest.fn(),
      listQuotations: jest.fn(),
    } as unknown as QuotationRepository;

    const uc = new UpdateQuotationUseCase(mockRepo);
    const result = await uc.execute('quot_test_1', {
      status: 'sent',
      vendorName: 'ABC Supplies',
    });

    expect((mockRepo.updateQuotation as jest.Mock).mock.calls.length).toBe(1);
    expect((mockRepo.updateQuotation as jest.Mock).mock.calls[0][0]).toBe('quot_test_1');
    expect((mockRepo.updateQuotation as jest.Mock).mock.calls[0][1]).toEqual({
      status: 'sent',
      vendorName: 'ABC Supplies',
    });
    expect(result).toEqual(updatedQuotation);
  });
});
