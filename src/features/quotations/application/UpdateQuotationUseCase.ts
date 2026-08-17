import { Quotation } from '../../../shared/domain/entities/Quotation';
import { QuotationRepository } from '../../../shared/domain/repositories/QuotationRepository';

export class UpdateQuotationUseCase {
  constructor(private readonly repo: QuotationRepository) {}

  async execute(id: string, updates: Partial<Quotation>): Promise<Quotation> {
    return this.repo.updateQuotation(id, updates);
  }
}
