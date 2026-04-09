import { Quotation } from '../../../domain/entities/Quotation';
import { Task } from '../../../domain/entities/Task';
import { QuotationRepository } from '../../../domain/repositories/QuotationRepository';
import { TaskRepository } from '../../../domain/repositories/TaskRepository';

export interface DeclineQuotationInput {
  quotationId: string;
}

/**
 * DeclineQuotationUseCase
 *
 * Declines a quotation that is in 'pending_approval' status:
 * 1. Validates quotation exists and is pending_approval.
 * 2. Transitions quotation to 'declined'.
 * 3. If quotation.taskId is set: updates task.quoteStatus = 'declined'.
 */
export class DeclineQuotationUseCase {
  constructor(
    private readonly quotationRepository: QuotationRepository,
    private readonly taskRepository: TaskRepository,
  ) {}

  async execute(input: DeclineQuotationInput): Promise<void> {
    const { quotationId } = input;

    // ── Load and validate quotation ──────────────────────────────────────────
    const quotation = await this.quotationRepository.getQuotation(quotationId);
    if (!quotation) throw new Error('QUOTATION_NOT_FOUND');
    if (quotation.status !== 'pending_approval') throw new Error('QUOTATION_NOT_PENDING_APPROVAL');

    const now = new Date().toISOString();

    // ── Transition quotation to declined ──────────────────────────────────────
    await this.quotationRepository.updateQuotation(quotationId, {
      status: 'declined',
      updatedAt: now,
    });

    // ── Update linked task if present ─────────────────────────────────────────
    if (quotation.taskId) {
      const task = await this.taskRepository.findById(quotation.taskId);
      if (task) {
        const patchedTask: Task = {
          ...task,
          quoteStatus: 'rejected',
          updatedAt: now,
        };
        await this.taskRepository.update(patchedTask);
      }
    }
  }
}
