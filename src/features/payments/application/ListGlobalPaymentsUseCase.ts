import { PaymentRepository, PaymentFilters, PaymentListResult } from '../../../domain/repositories/PaymentRepository';

export interface ListGlobalPaymentsRequest {
  contractorSearch?: string;
  /** Payment status filter. Defaults to 'pending' for backward compatibility. */
  status?: 'pending' | 'settled';
  /** If true, list only payments with no linked project (overrides status filter). Added in #191. */
  noProject?: boolean;
}

/**
 * Lists all payments across every active project.
 * Defaults to 'pending' status (backward compat with firefighter mode).
 * Pass status: 'settled' for the Paid filter on the Finances screen.
 * Pass noProject: true to list only payments not linked to any project.
 */
export class ListGlobalPaymentsUseCase {
  constructor(private readonly repo: PaymentRepository) {}

  async execute(req: ListGlobalPaymentsRequest): Promise<PaymentListResult> {
    const filters: PaymentFilters = {
      allProjects: true,
      noProject: req.noProject,
      ...(!req.noProject ? { status: req.status ?? 'pending' } : {}),
      contractorSearch: req.contractorSearch,
    };
    return this.repo.list(filters);
  }
}
