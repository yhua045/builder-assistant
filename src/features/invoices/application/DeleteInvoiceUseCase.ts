import { InvoiceRepository } from '../../../shared/domain/repositories/InvoiceRepository';

export class DeleteInvoiceUseCase {
  constructor(private readonly repo: InvoiceRepository) {}

  async execute(id: string): Promise<void> {
    return this.repo.deleteInvoice(id);
  }
}
