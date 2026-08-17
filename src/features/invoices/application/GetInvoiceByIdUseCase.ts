import { Invoice } from '../../../shared/domain/entities/Invoice';
import { InvoiceRepository } from '../../../shared/domain/repositories/InvoiceRepository';

export class GetInvoiceByIdUseCase {
  constructor(private readonly repo: InvoiceRepository) {}

  async execute(id: string): Promise<Invoice | null> {
    return this.repo.getInvoice(id);
  }
}
