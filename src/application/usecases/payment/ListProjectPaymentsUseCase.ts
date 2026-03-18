import { Payment } from '../../../domain/entities/Payment';
import { PaymentRepository } from '../../../domain/repositories/PaymentRepository';

const MAX_ITEMS = 500;

export interface ListProjectPaymentsResult {
  payments: Payment[];
  truncated: boolean;
}

/**
 * Lists payments scoped to a single project for the project detail timeline.
 * Returns raw Payment records (no invoice-payable derivation) sorted by
 * dueDate ascending. Enforces a 500-item guard to protect render performance.
 */
export class ListProjectPaymentsUseCase {
  constructor(private readonly repo: PaymentRepository) {}

  async execute(projectId: string): Promise<ListProjectPaymentsResult> {
    const all = await this.repo.findByProjectId(projectId);
    const truncated = all.length > MAX_ITEMS;
    const payments = truncated ? all.slice(0, MAX_ITEMS) : all;
    return { payments, truncated };
  }
}
