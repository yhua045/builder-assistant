import { Invoice, InvoiceEntity } from '../../../domain/entities/Invoice';
import { Payment, PaymentEntity } from '../../../domain/entities/Payment';
import { ReceiptRepository } from '../../../domain/repositories/ReceiptRepository';

export interface SnapReceiptDTO {
  vendor: string;
  amount: number;
  date: string;
  paymentMethod: Payment['method'];
  projectId?: string;
  category?: string;
  currency?: string;
  notes?: string;
}

export class SnapReceiptUseCase {
  constructor(
    private readonly receiptRepo: ReceiptRepository
  ) {}

  async execute(input: SnapReceiptDTO): Promise<{ invoice: Invoice; payment: Payment }> {
    if (input.amount <= 0) {
      throw new Error('Amount must be positive');
    }
    if (!input.vendor) {
        throw new Error('Vendor is required');
    }
    if (!input.date) {
        throw new Error('Date is required');
    }

    // 1. Create Invoice
    const invoiceEntity = InvoiceEntity.create({
      issuerName: input.vendor,
      total: input.amount,
      currency: input.currency || 'USD', // Default to USD or App settings
      status: 'paid', // Immediately paid
      paymentStatus: 'paid',
      dateIssued: input.date,
      paymentDate: input.date, // Paid on same day
      projectId: input.projectId,
      notes: input.notes,
      // We might want to store category in metadata or tags
      metadata: input.category ? { category: input.category } : undefined
    });

    const invoice = invoiceEntity.data();

    // 2. Create Payment
    const paymentEntity = PaymentEntity.create({
      amount: input.amount,
      date: input.date,
      projectId: input.projectId,
      invoiceId: invoice.id,
      method: input.paymentMethod,
      currency: input.currency || 'USD',
      status: 'settled',
      notes: input.notes
    });

    // Check if Payment project ID is problematic
    const payment = paymentEntity.data();
    if (!payment.projectId && !input.projectId) {
        // If unknown project, what to do?
        // Maybe we don't enforce it here, but repo might complain.
        // Or we pass undefined/null if repo supports it.
        // Payment interface validation is what matters.
    }

    // 3. Persist atomically
    try {
      return await this.receiptRepo.createReceipt(invoice, payment);
    } catch (error) {
      throw new Error('Failed to save receipt');
    }
  }
}
