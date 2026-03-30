import { PaymentRepository, PaymentFilters, PaymentListResult } from '../../../domain/repositories/PaymentRepository';

export interface ListGlobalPaymentsRequest {
  contractorSearch?: string;
  /** Payment status filter. Defaults to 'pending' for backward compatibility. */
  status?: 'pending' | 'settled';
}

/**
 * Lists all payments across every active project.
 * Defaults to 'pending' status (backward compat with firefighter mode).
 * Pass status: 'settled' for the Paid filter on the Finances screen.
 */
export class ListGlobalPaymentsUseCase {
  constructor(private readonly repo: PaymentRepository) {}

  async execute(req: ListGlobalPaymentsRequest): Promise<PaymentListResult> {
    const filters: PaymentFilters = {
      allProjects: true,
      status: req.status ?? 'pending',
      contractorSearch: req.contractorSearch,
    };
    return this.repo.list(filters);
  }
}
