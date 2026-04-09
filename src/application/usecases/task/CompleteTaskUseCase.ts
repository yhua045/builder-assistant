import type { TaskRepository } from '../../../domain/repositories/TaskRepository';
import type { QuotationRepository } from '../../../domain/repositories/QuotationRepository';
import type { PaymentRepository } from '../../../domain/repositories/PaymentRepository';
import { TaskCompletionValidator } from './TaskCompletionValidator';
import { TaskPaymentValidator } from './TaskPaymentValidator';
import { TaskNotFoundError, TaskCompletionValidationError, PendingPaymentsForTaskError } from '../../errors/TaskCompletionErrors';

export class CompleteTaskUseCase {
  private readonly validator: TaskCompletionValidator;
  private readonly paymentValidator: TaskPaymentValidator | null;

  constructor(
    private readonly taskRepository: TaskRepository,
    quotationRepository: QuotationRepository,
    paymentRepository?: PaymentRepository,
  ) {
    this.validator = new TaskCompletionValidator(quotationRepository);
    this.paymentValidator = paymentRepository
      ? new TaskPaymentValidator(paymentRepository)
      : null;
  }

  async execute(taskId: string): Promise<void> {
    const task = await this.taskRepository.findById(taskId);
    if (!task) {
      throw new TaskNotFoundError(taskId);
    }

    // Guard: already completed tasks are a no-op
    if (task.status === 'completed') {
      return;
    }

    // 1. Quotation check (existing)
    const result = await this.validator.validate(taskId);
    if (!result.ok) {
      throw new TaskCompletionValidationError(result.pendingQuotations);
    }

    // 2. Payment check (new)
    if (this.paymentValidator) {
      const paymentResult = await this.paymentValidator.validate(task);
      if (!paymentResult.ok) {
        throw new PendingPaymentsForTaskError(paymentResult.pendingPayments);
      }
    }

    const now = new Date().toISOString();
    await this.taskRepository.update({
      ...task,
      status: 'completed',
      completedAt: now,
      updatedAt: now,
    });
  }
}
