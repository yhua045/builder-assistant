import { Quotation } from '../../../shared/domain/entities/Quotation';
import { QuotationRepository } from '../../../shared/domain/repositories/QuotationRepository';

export class GetQuotationByIdUseCase {
  constructor(private readonly repo: QuotationRepository) {}

  async execute(id: string): Promise<Quotation | null> {
    return this.repo.getQuotation(id);
  }
}
