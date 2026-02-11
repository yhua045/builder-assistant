import { Invoice } from '../../../domain/entities/Invoice';
import { InvoiceRepository } from '../../../domain/repositories/InvoiceRepository';

export class UpdateInvoiceUseCase {
  constructor(private readonly repo: InvoiceRepository) {}

  async execute(id: string, updates: Partial<Invoice>): Promise<Invoice> {
    return this.repo.updateInvoice(id, updates);
  }
}
