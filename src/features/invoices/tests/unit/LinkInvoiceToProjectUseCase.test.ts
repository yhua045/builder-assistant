import { LinkInvoiceToProjectUseCase } from '../../application/LinkInvoiceToProjectUseCase';
import { InvoiceNotEditableError } from '../../../../features/payments/application/PaymentErrors';
import { InvoiceRepository } from '../../../../domain/repositories/InvoiceRepository';
import { Invoice } from '../../../../domain/entities/Invoice';

function makeRepo(invoice?: Invoice | null): jest.Mocked<InvoiceRepository> {
  return {
    createInvoice: jest.fn(),
    getInvoice: jest.fn().mockResolvedValue(invoice ?? null),
    updateInvoice: jest.fn().mockImplementation(async (_id: string, updates: Partial<Invoice>) => ({
      ...(invoice ?? {}),
      ...updates,
    })),
    deleteInvoice: jest.fn(),
    findByExternalKey: jest.fn(),
    listInvoices: jest.fn(),
    assignProject: jest.fn().mockImplementation(async (_invoiceId: string, projectId: string) => ({
      ...(invoice ?? {}),
      projectId,
    })),
  } as unknown as jest.Mocked<InvoiceRepository>;
}

const unpaidInvoice: Invoice = {
  id: 'inv_001',
  total: 1000,
  currency: 'AUD',
  status: 'issued',
  paymentStatus: 'unpaid',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('LinkInvoiceToProjectUseCase', () => {
  it('assigns project to an unpaid invoice', async () => {
    const repo = makeRepo(unpaidInvoice);
    const uc = new LinkInvoiceToProjectUseCase(repo);

    await uc.execute({ invoiceId: 'inv_001', projectId: 'proj_a' });

    expect(repo.assignProject).toHaveBeenCalledWith('inv_001', 'proj_a');
    expect(repo.updateInvoice).not.toHaveBeenCalled();
  });

  it('clears project when projectId is undefined', async () => {
    const repo = makeRepo({ ...unpaidInvoice, projectId: 'proj_a' });
    const uc = new LinkInvoiceToProjectUseCase(repo);

    await uc.execute({ invoiceId: 'inv_001', projectId: undefined });

    expect(repo.updateInvoice).toHaveBeenCalledWith('inv_001', { projectId: undefined });
    expect(repo.assignProject).not.toHaveBeenCalled();
  });

  it('throws InvoiceNotEditableError when invoice is cancelled', async () => {
    const repo = makeRepo({ ...unpaidInvoice, status: 'cancelled' });
    const uc = new LinkInvoiceToProjectUseCase(repo);

    await expect(
      uc.execute({ invoiceId: 'inv_001', projectId: 'proj_a' }),
    ).rejects.toThrow(InvoiceNotEditableError);
  });

  it('throws InvoiceNotEditableError when invoice paymentStatus is paid', async () => {
    const repo = makeRepo({ ...unpaidInvoice, status: 'paid', paymentStatus: 'paid' });
    const uc = new LinkInvoiceToProjectUseCase(repo);

    await expect(
      uc.execute({ invoiceId: 'inv_001', projectId: 'proj_a' }),
    ).rejects.toThrow(InvoiceNotEditableError);
  });

  it('throws when invoice is not found', async () => {
    const repo = makeRepo(null);
    const uc = new LinkInvoiceToProjectUseCase(repo);

    await expect(
      uc.execute({ invoiceId: 'inv_missing', projectId: 'proj_a' }),
    ).rejects.toThrow('Invoice not found: inv_missing');
  });
});
