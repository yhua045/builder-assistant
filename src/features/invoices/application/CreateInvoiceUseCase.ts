import { Invoice } from '../../../shared/domain/entities/Invoice';
import { InvoiceRepository } from '../../../shared/domain/repositories/InvoiceRepository';

export class CreateInvoiceUseCase {
  constructor(private readonly repo: InvoiceRepository) {}

  async execute(invoice: Invoice): Promise<Invoice> {
    return this.repo.createInvoice(invoice);
  }
}
