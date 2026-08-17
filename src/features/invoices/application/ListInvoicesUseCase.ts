import { Invoice } from '../../../shared/domain/entities/Invoice';
import { InvoiceRepository, InvoiceFilterParams } from '../../../shared/domain/repositories/InvoiceRepository';

export class ListInvoicesUseCase {
  constructor(private readonly repo: InvoiceRepository) {}

  async execute(params?: InvoiceFilterParams): Promise<{ items: Invoice[]; total: number }> {
    return this.repo.listInvoices(params as any);
  }
}
