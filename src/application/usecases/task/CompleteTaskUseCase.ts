import type { TaskRepository } from '../../../domain/repositories/TaskRepository';
import type { QuotationRepository } from '../../../domain/repositories/QuotationRepository';
import { TaskCompletionValidator } from './TaskCompletionValidator';
import { TaskNotFoundError, TaskCompletionValidationError } from '../../errors/TaskCompletionErrors';

export class CompleteTaskUseCase {
  private readonly validator: TaskCompletionValidator;

  constructor(
    private readonly taskRepository: TaskRepository,
    quotationRepository: QuotationRepository,
  ) {
    this.validator = new TaskCompletionValidator(quotationRepository);
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

    const result = await this.validator.validate(taskId);
    if (!result.ok) {
      throw new TaskCompletionValidationError(result.pendingQuotations);
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
