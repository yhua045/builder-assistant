import { PaymentRepository } from '../../../domain/repositories/PaymentRepository';
import { InvoiceRepository } from '../../../domain/repositories/InvoiceRepository';
import { PaymentNotPendingError, InvoiceNotEditableError } from './PaymentErrors';

// ── Input ─────────────────────────────────────────────────────────────────────

export interface AssignProjectToPaymentRecordInput {
  /** Determines which repository path is taken. */
  recordContext: 'synthetic-invoice' | 'standalone-payment';
  /** The invoice ID (for synthetic-invoice) or payment ID (for standalone-payment). */
  targetId: string;
  /** Project to assign, or undefined to unlink. */
  projectId: string | undefined;
}

// ── Use case ──────────────────────────────────────────────────────────────────

export class AssignProjectToPaymentRecordUseCase {
  constructor(
    private readonly paymentRepo: PaymentRepository,
    private readonly invoiceRepo: InvoiceRepository,
  ) {}

  async execute({ recordContext, targetId, projectId }: AssignProjectToPaymentRecordInput): Promise<void> {
    if (recordContext === 'synthetic-invoice') {
      await this.assignToInvoice(targetId, projectId);
    } else {
      await this.assignToPayment(targetId, projectId);
    }
  }

  // ── Branch: invoice ───────────────────────────────────────────────────────

  private async assignToInvoice(invoiceId: string, projectId: string | undefined): Promise<void> {
    const invoice = await this.invoiceRepo.getInvoice(invoiceId);
    if (!invoice) {
      throw new Error(`Invoice not found: ${invoiceId}`);
    }
    if (invoice.status === 'cancelled') {
      throw new InvoiceNotEditableError(invoiceId, 'invoice is cancelled');
    }
    if (invoice.paymentStatus === 'paid') {
      throw new InvoiceNotEditableError(invoiceId, 'invoice is paid');
    }
    if (projectId !== undefined) {
      await this.invoiceRepo.assignProject(invoiceId, projectId);
    } else {
      await this.invoiceRepo.updateInvoice(invoiceId, { projectId: undefined });
    }
  }

  // ── Branch: standalone payment ────────────────────────────────────────────

  private async assignToPayment(paymentId: string, projectId: string | undefined): Promise<void> {
    const payment = await this.paymentRepo.findById(paymentId);
    if (!payment) {
      throw new Error(`Payment not found: ${paymentId}`);
    }
    if (payment.status !== 'pending') {
      throw new PaymentNotPendingError(paymentId, payment.status ?? 'unknown');
    }
    const updated = { ...payment, projectId };
    await this.paymentRepo.update(updated);
  }
}
