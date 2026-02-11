import { Invoice } from '../../src/domain/entities/Invoice';
import { InvoiceRepository } from '../../src/domain/repositories/InvoiceRepository';
import { CreateInvoiceUseCase } from '../../src/application/usecases/invoice/CreateInvoiceUseCase';

describe('CreateInvoiceUseCase', () => {
  it('creates an invoice via repository and returns created invoice', async () => {
    const invoice: Invoice = {
      id: 'inv_test_1',
      total: 100,
      currency: 'USD',
      status: 'draft',
      paymentStatus: 'unpaid',
    } as Invoice;

    const mockRepo: InvoiceRepository = {
      createInvoice: jest.fn().mockResolvedValue(invoice),
      getInvoice: jest.fn(),
      updateInvoice: jest.fn(),
      deleteInvoice: jest.fn(),
      findByExternalKey: jest.fn(),
      listInvoices: jest.fn(),
      assignProject: jest.fn(),
    } as unknown as InvoiceRepository;

    const uc = new CreateInvoiceUseCase(mockRepo);
    const result = await uc.execute(invoice);

    expect((mockRepo.createInvoice as jest.Mock).mock.calls.length).toBe(1);
    expect(result).toEqual(invoice);
  });
});
