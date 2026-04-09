import { Quotation } from '../../../domain/entities/Quotation';
import { Task } from '../../../domain/entities/Task';
import { QuotationRepository } from '../../../domain/repositories/QuotationRepository';
import { TaskRepository } from '../../../domain/repositories/TaskRepository';

export interface CreateQuotationWithTaskInput {
  quotation: Omit<Quotation, 'id' | 'createdAt' | 'updatedAt' | 'taskId' | 'status'>;
}

export interface CreateQuotationWithTaskOutput {
  quotation: Quotation;
  task: Task;
}

/**
 * CreateQuotationWithTaskUseCase
 *
 * Orchestration use case that:
 * 1. Validates projectId is present.
 * 2. Creates a Task linked to the same project (type=contract_work, quoteStatus=issued).
 * 3. Creates the Quotation with status=pending_approval and taskId pointing to the new task.
 * 4. Returns both created entities.
 */
export class CreateQuotationWithTaskUseCase {
  constructor(
    private readonly quotationRepository: QuotationRepository,
    private readonly taskRepository: TaskRepository,
  ) {}

  async execute(input: CreateQuotationWithTaskInput): Promise<CreateQuotationWithTaskOutput> {
    const { quotation: quotationInput } = input;

    // ── Validate required project ────────────────────────────────────────────
    if (!quotationInput.projectId || quotationInput.projectId.trim() === '') {
      throw new Error('QUOTATION_PROJECT_REQUIRED');
    }

    const now = new Date().toISOString();
    const taskId = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // ── Derive task title ────────────────────────────────────────────────────
    const titleSuffix = quotationInput.vendorName?.trim() || quotationInput.reference?.trim() || 'Quotation';
    const taskTitle = `Review Quotation: ${titleSuffix}`;

    // ── Create the linked task ───────────────────────────────────────────────
    const task: Task = {
      id: taskId,
      title: taskTitle,
      status: 'pending',
      taskType: 'contract_work',
      quoteStatus: 'issued',
      quoteAmount: quotationInput.total,
      projectId: quotationInput.projectId,
      subcontractorId: quotationInput.vendorId,
      createdAt: now,
      updatedAt: now,
    };

    await this.taskRepository.save(task);

    // ── Create the quotation ─────────────────────────────────────────────────
    const quotationId = `quot_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const quotationData: Quotation = {
      ...(quotationInput as Quotation),
      id: quotationId,
      taskId,
      status: 'pending_approval',
      createdAt: now,
      updatedAt: now,
    };

    const createdQuotation = await this.quotationRepository.createQuotation(quotationData);

    return { quotation: createdQuotation, task };
  }
}
