import type { TaskRepository } from '../../../domain/repositories/TaskRepository';
import type { PaymentRepository } from '../../../domain/repositories/PaymentRepository';
import type { InvoiceRepository } from '../../../domain/repositories/InvoiceRepository';
import type { QuotationRepository } from '../../../domain/repositories/QuotationRepository';
import { TaskNotFoundError } from '../../errors/TaskCompletionErrors';
import { MarkPaymentAsPaidUseCase } from '../../../features/payments/application/MarkPaymentAsPaidUseCase';
import { CompleteTaskUseCase } from './CompleteTaskUseCase';

export class CompleteTaskAndSettlePaymentsUseCase {
  constructor(
    private readonly taskRepository: TaskRepository,
    private readonly paymentRepository: PaymentRepository,
    private readonly invoiceRepository: InvoiceRepository,
    private readonly quotationRepository: QuotationRepository,
  ) {}

  async execute(taskId: string): Promise<void> {
    const task = await this.taskRepository.findById(taskId);
    if (!task) throw new TaskNotFoundError(taskId);

    // Settle all pending payments linked to the task's quote invoice
    if (task.quoteInvoiceId) {
      const payments = await this.paymentRepository.findByInvoice(task.quoteInvoiceId);
      const markPaid = new MarkPaymentAsPaidUseCase(this.paymentRepository, this.invoiceRepository);
      for (const p of payments.filter(pay => pay.status === 'pending')) {
        await markPaid.execute({ paymentId: p.id });
      }
    }

    // Complete task — payment check now passes since payments are settled
    const completeTask = new CompleteTaskUseCase(
      this.taskRepository,
      this.quotationRepository,
      this.paymentRepository,
    );
    await completeTask.execute(taskId);
  }
}
