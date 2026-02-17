import { Invoice } from '../../../domain/entities/Invoice';
import { InvoiceRepository } from '../../../domain/repositories/InvoiceRepository';

export interface MarkInvoiceAsPaidOptions {
  actor?: string;
  reason?: string;
}

export class MarkInvoiceAsPaidUseCase {
  constructor(private readonly repo: InvoiceRepository) {}

  async execute(
    invoiceId: string,
    options?: MarkInvoiceAsPaidOptions
  ): Promise<Invoice> {
    // 1. Fetch the invoice
    const invoice = await this.repo.getInvoice(invoiceId);
    
    if (!invoice) {
      throw new Error(`Invoice with ID ${invoiceId} not found`);
    }

    // 2. Validate transitions
    if (invoice.status === 'paid') {
      throw new Error('Invoice is already marked as paid');
    }

    if (invoice.status === 'cancelled') {
      throw new Error('Cannot mark a cancelled invoice as paid');
    }

    if (invoice.status !== 'issued' && invoice.status !== 'overdue') {
      throw new Error('Only issued or overdue invoices can be marked as paid');
    }

    // 3. Prepare audit trail entry
    const now = new Date().toISOString();
    const statusChange = {
      from: invoice.status,
      to: 'paid' as const,
      timestamp: now,
      ...(options?.actor && { actor: options.actor }),
      ...(options?.reason && { reason: options.reason }),
    };

    // 4. Preserve existing metadata and append to status history
    const existingMetadata = invoice.metadata || {};
    const existingHistory = (existingMetadata.statusHistory as any[]) || [];
    
    const updatedMetadata = {
      ...existingMetadata,
      statusHistory: [...existingHistory, statusChange],
    };

    // 5. Update the invoice
    const updates: Partial<Invoice> = {
      status: 'paid',
      paymentStatus: 'paid',
      paymentDate: now,
      metadata: updatedMetadata,
    };

    return this.repo.updateInvoice(invoiceId, updates);
  }
}
