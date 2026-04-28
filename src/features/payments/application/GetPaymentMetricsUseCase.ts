import { PaymentRepository, PaymentMetrics } from '../../../domain/repositories/PaymentRepository';

export class GetPaymentMetricsUseCase {
  constructor(private readonly repo: PaymentRepository) {}

  async execute(projectId?: string): Promise<PaymentMetrics> {
    return this.repo.getMetrics(projectId);
  }
}
