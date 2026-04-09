import { Payment } from '../../../domain/entities/Payment';
import { PaymentRepository } from '../../../domain/repositories/PaymentRepository';
import { PaymentNotPendingError } from '../../errors/PaymentErrors';

export interface LinkPaymentToProjectInput {
  paymentId: string;
  projectId: string | undefined;
}

export class LinkPaymentToProjectUseCase {
  constructor(private readonly paymentRepo: PaymentRepository) {}

  async execute({ paymentId, projectId }: LinkPaymentToProjectInput): Promise<Payment> {
    const payment = await this.paymentRepo.findById(paymentId);
    if (!payment) {
      throw new Error(`Payment not found: ${paymentId}`);
    }
    if (payment.status !== 'pending') {
      throw new PaymentNotPendingError(paymentId, payment.status ?? 'unknown');
    }
    const updated: Payment = { ...payment, projectId };
    await this.paymentRepo.update(updated);
    return updated;
  }
}
