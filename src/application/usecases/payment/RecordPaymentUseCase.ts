import { Payment } from '../../../domain/entities/Payment';
import { PaymentRepository } from '../../../domain/repositories/PaymentRepository';
import { InvoiceRepository } from '../../../domain/repositories/InvoiceRepository';

export class RecordPaymentUseCase {
  constructor(private readonly paymentRepo: PaymentRepository, private readonly invoiceRepo: InvoiceRepository) {}

  async execute(payment: Payment): Promise<void> {
    // Save payment
    await this.paymentRepo.save(payment);

    // If payment is linked to an invoice, recalculate status
    if (payment.invoiceId) {
      const invoice = await this.invoiceRepo.getInvoice(payment.invoiceId);
      if (!invoice) return;

      const payments = await this.paymentRepo.findByInvoice(payment.invoiceId);
      const paid = payments
        .filter(p => p.status !== 'cancelled' && p.status !== 'reverse_payment')
        .reduce((s, p) => s + (p.amount || 0), 0);

      const newPaymentStatus = paid >= invoice.total ? 'paid' : (paid > 0 ? 'partial' : 'unpaid');
      const updates: any = { paymentStatus: newPaymentStatus };
      
      // Only change status to 'paid' if invoice is issued or overdue
      if (newPaymentStatus === 'paid' && (invoice.status === 'issued' || invoice.status === 'overdue')) {
        updates.status = 'paid';
        updates.paymentDate = new Date().toISOString();
      }

      await this.invoiceRepo.updateInvoice(invoice.id, updates);
    }
  }
}
