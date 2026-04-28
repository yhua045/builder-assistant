import { Invoice } from '../../../../domain/entities/Invoice';
import { InvoiceRepository } from '../../../../domain/repositories/InvoiceRepository';
import { ListInvoicesUseCase } from '../../application/ListInvoicesUseCase';

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

  it('passes status filter to repository', async () => {
    const mockRepo: InvoiceRepository = {
      listInvoices: jest.fn().mockResolvedValue({ items: [], total: 0 }),
    } as unknown as InvoiceRepository;

    const uc = new ListInvoicesUseCase(mockRepo);
    const statuses: Invoice['status'][] = ['paid', 'overdue'];
    
    await uc.execute({ status: statuses });

    expect(mockRepo.listInvoices).toHaveBeenCalledWith(
      expect.objectContaining({
        status: statuses
      })
    );
  });
});
