import { Quotation } from '../../../domain/entities/Quotation';
import { QuotationRepository } from '../../../domain/repositories/QuotationRepository';

export class CreateQuotationUseCase {
  constructor(private readonly repo: QuotationRepository) {}

  async execute(quotation: Quotation): Promise<Quotation> {
    return this.repo.createQuotation(quotation);
  }
}
