import { QuotationRepository } from '../../../shared/domain/repositories/QuotationRepository';

export class DeleteQuotationUseCase {
  constructor(private readonly repo: QuotationRepository) {}

  async execute(id: string): Promise<void> {
    return this.repo.deleteQuotation(id);
  }
}
