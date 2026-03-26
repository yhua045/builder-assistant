import type { QuotationRepository } from '../../../domain/repositories/QuotationRepository';
import type { Quotation } from '../../../domain/entities/Quotation';

/** Statuses that block task completion (quotation not yet resolved). */
const BLOCKING_STATUSES: Quotation['status'][] = ['draft', 'sent'];

export interface ValidationResult {
  ok: boolean;
  pendingQuotations: Pick<Quotation, 'id' | 'reference' | 'status'>[];
}

export class TaskCompletionValidator {
  constructor(private readonly quotationRepository: QuotationRepository) {}

  async validate(taskId: string): Promise<ValidationResult> {
    const quotations = await this.quotationRepository.findByTask(taskId);

    // Exclude soft-deleted records
    const activeQuotations = quotations.filter(q => !q.deletedAt);

    const pending = activeQuotations
      .filter(q => BLOCKING_STATUSES.includes(q.status))
      .map(({ id, reference, status }) => ({ id, reference, status }));

    return {
      ok: pending.length === 0,
      pendingQuotations: pending,
    };
  }
}
