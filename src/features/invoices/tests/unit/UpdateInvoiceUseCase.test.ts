import { Invoice } from '../../../../domain/entities/Invoice';
import { InvoiceRepository } from '../../../../domain/repositories/InvoiceRepository';
import { UpdateInvoiceUseCase } from '../../application/UpdateInvoiceUseCase';

describe('UpdateInvoiceUseCase', () => {
  it('calls repository.updateInvoice and returns updated invoice', async () => {
    const updated: Invoice = {
      id: 'inv_2',
      total: 300,
      currency: 'USD',
      status: 'issued',
      paymentStatus: 'unpaid',
    } as Invoice;

    const mockRepo: InvoiceRepository = {
      createInvoice: jest.fn(),
      getInvoice: jest.fn(),
      updateInvoice: jest.fn().mockResolvedValue(updated),
      deleteInvoice: jest.fn(),
      findByExternalKey: jest.fn(),
      listInvoices: jest.fn(),
      assignProject: jest.fn(),
    } as unknown as InvoiceRepository;

    const uc = new UpdateInvoiceUseCase(mockRepo);
    const result = await uc.execute('inv_2', { total: 300 });

    expect((mockRepo.updateInvoice as jest.Mock).mock.calls.length).toBe(1);
    expect(result).toEqual(updated);
  });
});
