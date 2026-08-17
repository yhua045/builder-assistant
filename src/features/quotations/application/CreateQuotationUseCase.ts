import { Quotation, QuotationEntity } from '../../../shared/domain/entities/Quotation';
import { QuotationRepository } from '../../../shared/domain/repositories/QuotationRepository';

export type CreateQuotationDTO = Omit<Quotation, 'id' | 'createdAt' | 'updatedAt'>;

export class CreateQuotationUseCase {
  constructor(private readonly repo: QuotationRepository) {}

  async execute(dto: CreateQuotationDTO): Promise<Quotation> {
    const entity = QuotationEntity.create(dto as any);
    return this.repo.createQuotation(entity.data());
  }
}
