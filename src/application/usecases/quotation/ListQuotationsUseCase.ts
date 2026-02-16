import { Quotation } from '../../../domain/entities/Quotation';
import {
  QuotationRepository,
  QuotationFilterParams,
} from '../../../domain/repositories/QuotationRepository';

export class ListQuotationsUseCase {
  constructor(private readonly repo: QuotationRepository) {}

  async execute(
    params?: QuotationFilterParams
  ): Promise<{ items: Quotation[]; total: number }> {
    return this.repo.listQuotations(params);
  }
}
