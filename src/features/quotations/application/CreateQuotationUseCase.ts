import { Quotation, QuotationEntity } from '../../../domain/entities/Quotation';
import { QuotationRepository } from '../../../domain/repositories/QuotationRepository';

export type CreateQuotationDTO = Omit<Quotation, 'id' | 'createdAt' | 'updatedAt'>;

export class CreateQuotationUseCase {
  constructor(private readonly repo: QuotationRepository) {}

  async execute(dto: CreateQuotationDTO): Promise<Quotation> {
    const entity = QuotationEntity.create(dto as any);
    return this.repo.createQuotation(entity.data());
  }
}
