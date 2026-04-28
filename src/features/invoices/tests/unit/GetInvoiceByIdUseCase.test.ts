import { Invoice } from '../../../../domain/entities/Invoice';
import { InvoiceRepository } from '../../../../domain/repositories/InvoiceRepository';
import { GetInvoiceByIdUseCase } from '../../application/GetInvoiceByIdUseCase';

describe('GetInvoiceByIdUseCase', () => {
  it('returns invoice from repository', async () => {
    const invoice: Invoice = {
      id: 'inv_1',
      total: 200,
      currency: 'USD',
      status: 'draft',
      paymentStatus: 'unpaid',
    } as Invoice;

    const mockRepo: InvoiceRepository = {
      createInvoice: jest.fn(),
      getInvoice: jest.fn().mockResolvedValue(invoice),
      updateInvoice: jest.fn(),
      deleteInvoice: jest.fn(),
      findByExternalKey: jest.fn(),
      listInvoices: jest.fn(),
      assignProject: jest.fn(),
    } as unknown as InvoiceRepository;

    const uc = new GetInvoiceByIdUseCase(mockRepo);
    const result = await uc.execute('inv_1');

    expect((mockRepo.getInvoice as jest.Mock).mock.calls.length).toBe(1);
    expect(result).toEqual(invoice);
  });
});
