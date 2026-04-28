import { QuotationRepository } from '../../../../domain/repositories/QuotationRepository';
import { DeleteQuotationUseCase } from '../../application/DeleteQuotationUseCase';

describe('DeleteQuotationUseCase', () => {
  it('soft-deletes a quotation via repository', async () => {
    const mockRepo: QuotationRepository = {
      createQuotation: jest.fn(),
      getQuotation: jest.fn(),
      updateQuotation: jest.fn(),
      deleteQuotation: jest.fn().mockResolvedValue(undefined),
      findByReference: jest.fn(),
      listQuotations: jest.fn(),
    } as unknown as QuotationRepository;

    const uc = new DeleteQuotationUseCase(mockRepo);
    await uc.execute('quot_test_1');

    expect((mockRepo.deleteQuotation as jest.Mock).mock.calls.length).toBe(1);
    expect((mockRepo.deleteQuotation as jest.Mock).mock.calls[0][0]).toBe('quot_test_1');
  });
});
