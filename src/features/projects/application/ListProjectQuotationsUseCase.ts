import { Quotation } from '../../../domain/entities/Quotation';
import { QuotationRepository } from '../../../domain/repositories/QuotationRepository';

const MAX_ITEMS = 500;

export interface ListProjectQuotationsResult {
  quotations: Quotation[];
  truncated: boolean;
}

/**
 * Lists all quotations for a single project, aggregated across all tasks
 * in that project, sorted by quotation date ascending.
 * Enforces a 500-item guard to protect render performance.
 */
export class ListProjectQuotationsUseCase {
  constructor(private readonly repo: QuotationRepository) {}

  async execute(projectId: string): Promise<ListProjectQuotationsResult> {
    const all = await this.repo.findByProjectId(projectId);
    const truncated = all.length > MAX_ITEMS;
    const quotations = truncated ? all.slice(0, MAX_ITEMS) : all;
    return { quotations, truncated };
  }
}
