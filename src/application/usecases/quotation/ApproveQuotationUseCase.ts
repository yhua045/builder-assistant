import { Invoice } from '../../../domain/entities/Invoice';
import { Quotation } from '../../../domain/entities/Quotation';
import { Task } from '../../../domain/entities/Task';
import { InvoiceRepository } from '../../../domain/repositories/InvoiceRepository';
import { QuotationRepository } from '../../../domain/repositories/QuotationRepository';
import { TaskRepository } from '../../../domain/repositories/TaskRepository';

export interface ApproveQuotationInput {
  quotationId: string;
}

export interface ApproveQuotationOutput {
  invoice: Invoice;
  quotation: Quotation;
  task?: Task;
}

/**
 * ApproveQuotationUseCase
 *
 * Approves a quotation that is in 'pending_approval' status:
 * 1. Validates quotation exists and is pending_approval.
 * 2. Creates an Invoice from the quotation data.
 * 3. Transitions quotation to 'accepted'.
 * 4. If quotation.taskId is set: updates task.quoteStatus = 'accepted' and task.quoteInvoiceId.
 */
export class ApproveQuotationUseCase {
  constructor(
    private readonly invoiceRepository: InvoiceRepository,
    private readonly quotationRepository: QuotationRepository,
    private readonly taskRepository: TaskRepository,
  ) {}

  async execute(input: ApproveQuotationInput): Promise<ApproveQuotationOutput> {
    const { quotationId } = input;

    // ── Load and validate quotation ──────────────────────────────────────────
    const quotation = await this.quotationRepository.getQuotation(quotationId);
    if (!quotation) throw new Error('QUOTATION_NOT_FOUND');
    if (quotation.status !== 'pending_approval') throw new Error('QUOTATION_NOT_PENDING_APPROVAL');

    const now = new Date().toISOString();
    const invoiceId = `inv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // ── Create invoice ───────────────────────────────────────────────────────
    const invoice = await this.invoiceRepository.createInvoice({
      id: invoiceId,
      projectId: quotation.projectId,
      quoteId: quotationId,
      issuerName: quotation.vendorName,
      issuerAddress: quotation.vendorAddress,
      status: 'issued',
      paymentStatus: 'unpaid',
      total: quotation.total,
      subtotal: quotation.subtotal ?? quotation.total,
      currency: quotation.currency ?? 'AUD',
      notes: `Auto-generated from approved quotation: ${quotation.reference}`,
      metadata: {
        source: 'approve-quotation',
        quotationReference: quotation.reference,
      },
      dateIssued: now,
      createdAt: now,
      updatedAt: now,
    } as Invoice);

    // ── Transition quotation to accepted ─────────────────────────────────────
    const updatedQuotation = await this.quotationRepository.updateQuotation(quotationId, {
      status: 'accepted',
      updatedAt: now,
    });

    // ── Update linked task if present ────────────────────────────────────────
    let updatedTask: Task | undefined;
    if (quotation.taskId) {
      const task = await this.taskRepository.findById(quotation.taskId);
      if (task) {
        const patchedTask: Task = {
          ...task,
          quoteStatus: 'accepted',
          quoteInvoiceId: invoice.id,
          updatedAt: now,
        };
        await this.taskRepository.update(patchedTask);
        updatedTask = patchedTask;
      }
    }

    return { invoice, quotation: updatedQuotation, task: updatedTask };
  }
}
