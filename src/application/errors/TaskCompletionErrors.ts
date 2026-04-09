import type { Quotation } from '../../domain/entities/Quotation';
import type { Payment } from '../../domain/entities/Payment';

export class TaskNotFoundError extends Error {
  constructor(taskId: string) {
    super(`Task not found: ${taskId}`);
    this.name = 'TaskNotFoundError';
  }
}

export class TaskCompletionValidationError extends Error {
  readonly code = 'PENDING_QUOTATIONS' as const;
  readonly pendingQuotations: Pick<Quotation, 'id' | 'reference' | 'status'>[];

  constructor(pendingQuotations: Pick<Quotation, 'id' | 'reference' | 'status'>[]) {
    const refs = pendingQuotations.map(q => q.reference).join(', ');
    super(`Cannot complete task: unresolved quotations [${refs}]`);
    this.name = 'TaskCompletionValidationError';
    this.pendingQuotations = pendingQuotations;
  }
}

export class PendingPaymentsForTaskError extends Error {
  readonly code = 'PENDING_PAYMENTS_FOR_TASK' as const;
  readonly pendingPayments: Pick<Payment, 'id' | 'amount' | 'contractorName' | 'dueDate'>[];

  constructor(payments: Pick<Payment, 'id' | 'amount' | 'contractorName' | 'dueDate'>[]) {
    super(`Cannot complete task: ${payments.length} unpaid payment(s) on linked invoice`);
    this.name = 'PendingPaymentsForTaskError';
    this.pendingPayments = payments;
  }
}
