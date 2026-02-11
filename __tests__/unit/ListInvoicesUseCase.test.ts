import { Invoice } from '../../src/domain/entities/Invoice';
import { InvoiceRepository } from '../../src/domain/repositories/InvoiceRepository';
import { ListInvoicesUseCase } from '../../src/application/usecases/invoice/ListInvoicesUseCase';

describe('ListInvoicesUseCase', () => {
  it('returns list and total from repository', async () => {
    const invoice: Invoice = {
      id: 'inv_3',
      total: 150,
      currency: 'USD',
      status: 'draft',
      paymentStatus: 'unpaid',
    } as Invoice;

    const mockRepo: InvoiceRepository = {
      createInvoice: jest.fn(),
      getInvoice: jest.fn(),
      updateInvoice: jest.fn(),
      deleteInvoice: jest.fn(),
      findByExternalKey: jest.fn(),
      listInvoices: jest.fn().mockResolvedValue({ items: [invoice], total: 1 }),
      assignProject: jest.fn(),
    } as unknown as InvoiceRepository;

    const uc = new ListInvoicesUseCase(mockRepo);
    const result = await uc.execute({});

    expect((mockRepo.listInvoices as jest.Mock).mock.calls.length).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
  });
});
