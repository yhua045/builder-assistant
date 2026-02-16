import { Quotation } from '../../../domain/entities/Quotation';
import { QuotationRepository } from '../../../domain/repositories/QuotationRepository';

export class UpdateQuotationUseCase {
  constructor(private readonly repo: QuotationRepository) {}

  async execute(id: string, updates: Partial<Quotation>): Promise<Quotation> {
    return this.repo.updateQuotation(id, updates);
  }
}
