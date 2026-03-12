import { Task } from '../../../domain/entities/Task';
import { Invoice, InvoiceEntity } from '../../../domain/entities/Invoice';
import { TaskRepository } from '../../../domain/repositories/TaskRepository';
import { InvoiceRepository } from '../../../domain/repositories/InvoiceRepository';

export class AcceptQuoteUseCase {
  constructor(
    private readonly taskRepo: TaskRepository,
    private readonly invoiceRepo: InvoiceRepository,
  ) {}

  /**
   * Marks a contract-work task's quote as accepted and auto-generates an Invoice.
   *
   * @returns The updated task and the newly created invoice.
   * @throws 'TASK_NOT_FOUND'         — task id does not exist
   * @throws 'NOT_CONTRACT_WORK'      — task is not a contract_work task
   * @throws 'QUOTE_ALREADY_ACCEPTED' — quote was already accepted
   */
  async execute(taskId: string): Promise<{ task: Task; invoice: Invoice }> {
    const task = await this.taskRepo.findById(taskId);
    if (!task) throw new Error('TASK_NOT_FOUND');
    if (task.taskType !== 'contract_work') throw new Error('NOT_CONTRACT_WORK');
    if (task.quoteStatus === 'accepted') throw new Error('QUOTE_ALREADY_ACCEPTED');

    const invoiceEntity = InvoiceEntity.create({
      projectId: task.projectId,
      issuerName: task.subcontractorId, // subcontractor id used as name placeholder
      total: task.quoteAmount ?? 0,
      currency: 'AUD',
      status: 'issued',
      paymentStatus: 'unpaid',
      dateIssued: new Date().toISOString(),
      notes: `Auto-generated from accepted quote on task: ${task.title}`,
    });

    const invoice = await this.invoiceRepo.createInvoice(invoiceEntity.data());

    const now = new Date().toISOString();
    const updatedTask: Task = {
      ...task,
      quoteStatus: 'accepted',
      quoteInvoiceId: invoice.id,
      updatedAt: now,
    };
    await this.taskRepo.update(updatedTask);

    return { task: updatedTask, invoice };
  }
}
