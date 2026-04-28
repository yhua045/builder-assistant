import { Invoice, InvoiceEntity } from '../../../domain/entities/Invoice';
import { InvoiceRepository } from '../../../domain/repositories/InvoiceRepository';
import { PaymentRepository } from '../../../domain/repositories/PaymentRepository';

export interface CancelInvoiceOptions {
  reason?: string;
  actor?: string;
}

export class CancelInvoiceUseCase {
  constructor(
    private readonly repo: InvoiceRepository,
    private readonly paymentRepo?: PaymentRepository,
  ) {}

  async execute(
    invoiceId: string,
    options?: CancelInvoiceOptions
  ): Promise<Invoice> {
    // 1. Fetch the invoice
    const invoice = await this.repo.getInvoice(invoiceId);
    
    if (!invoice) {
      throw new Error(`Invoice with ID ${invoiceId} not found`);
    }

    // 2. Validate transitions
    if (invoice.status === 'cancelled') {
      throw new Error('Invoice is already cancelled');
    }

    if (invoice.status === 'paid') {
      throw new Error('Cannot cancel a paid invoice');
    }

    // 3. Guard: reject if any settled payment is linked to this invoice
    if (this.paymentRepo) {
      const linkedPayments = await this.paymentRepo.findByInvoice(invoiceId);
      const entity = new InvoiceEntity(invoice);
      entity.cancel(linkedPayments); // throws if settled payments exist
    }

    // 4. Prepare audit trail entry
    const now = new Date().toISOString();
    const statusChange = {
      from: invoice.status,
      to: 'cancelled' as const,
      timestamp: now,
      ...(options?.actor && { actor: options.actor }),
      ...(options?.reason && { reason: options.reason }),
    };

    // 5. Preserve existing metadata and append to status history
    const existingMetadata = invoice.metadata || {};
    const existingHistory = (existingMetadata.statusHistory as any[]) || [];
    
    const updatedMetadata = {
      ...existingMetadata,
      statusHistory: [...existingHistory, statusChange],
      ...(options?.reason && { cancellationReason: options.reason }),
    };

    // 6. Update the invoice
    const updates: Partial<Invoice> = {
      status: 'cancelled',
      metadata: updatedMetadata,
    };

    return this.repo.updateInvoice(invoiceId, updates);
  }
}
