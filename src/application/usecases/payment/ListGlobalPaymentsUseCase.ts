import { PaymentRepository, PaymentFilters, PaymentListResult } from '../../../domain/repositories/PaymentRepository';

export interface ListGlobalPaymentsRequest {
  contractorSearch?: string;
}

/**
 * Lists all pending payments across every active project, sorted by urgency
 * (overdue first, then ascending due date). Used by "The Firefighter" mode.
 */
export class ListGlobalPaymentsUseCase {
  constructor(private readonly repo: PaymentRepository) {}

  async execute(req: ListGlobalPaymentsRequest): Promise<PaymentListResult> {
    const filters: PaymentFilters = {
      allProjects: true,
      status: 'pending',
      contractorSearch: req.contractorSearch,
    };
    return this.repo.list(filters);
  }
}
