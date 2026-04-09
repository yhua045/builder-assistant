import type { PaymentRepository } from '../../../domain/repositories/PaymentRepository';
import type { Task } from '../../../domain/entities/Task';
import type { Payment } from '../../../domain/entities/Payment';

export interface PaymentValidationResult {
  ok: boolean;
  pendingPayments: Pick<Payment, 'id' | 'amount' | 'contractorName' | 'dueDate'>[];
}

export class TaskPaymentValidator {
  constructor(private readonly paymentRepo: PaymentRepository) {}

  async validate(task: Task): Promise<PaymentValidationResult> {
    if (!task.quoteInvoiceId) {
      return { ok: true, pendingPayments: [] };
    }

    const payments = await this.paymentRepo.findByInvoice(task.quoteInvoiceId);
    const pending = payments
      .filter(p => p.status === 'pending')
      .map(({ id, amount, contractorName, dueDate }) => ({ id, amount, contractorName, dueDate }));

    return { ok: pending.length === 0, pendingPayments: pending };
  }
}
