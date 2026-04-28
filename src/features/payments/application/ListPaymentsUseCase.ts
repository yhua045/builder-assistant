import { PaymentRepository, PaymentFilters, PaymentListResult } from '../../../domain/repositories/PaymentRepository';

export type ListPaymentsRequest = PaymentFilters & { preset?: 'upcoming' | 'overdue' | 'paid' };

export class ListPaymentsUseCase {
  constructor(private readonly repo: PaymentRepository) {}

  async execute(req: ListPaymentsRequest): Promise<PaymentListResult> {
    const filters: PaymentFilters = { ...req };

    if (req.preset === 'upcoming') {
      const now = Date.now();
      filters.status = 'pending';
      filters.fromDate = new Date(now).toISOString();
      filters.toDate = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
    }

    if (req.preset === 'overdue') {
      filters.isOverdue = true;
    }

    if (req.preset === 'paid') {
      const now = Date.now();
      filters.status = 'settled';
      filters.fromDate = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
      filters.toDate = new Date(now).toISOString();
    }

    return this.repo.list(filters);
  }
}
