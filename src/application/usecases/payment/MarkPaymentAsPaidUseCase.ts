import { Payment } from '../../../domain/entities/Payment';
import { PaymentRepository } from '../../../domain/repositories/PaymentRepository';
import { InvoiceRepository } from '../../../domain/repositories/InvoiceRepository';

export interface MarkPaymentAsPaidInput {
  paymentId: string;
  /** Partial amount paid. Defaults to the full outstanding payment amount if omitted. */
  amount?: number;
  method?: Payment['method'];
  notes?: string;
  reference?: string;
}

export interface MarkPaymentAsPaidResult {
  payment: Payment;
  invoicePaymentStatus?: 'unpaid' | 'partial' | 'paid';
}

/**
 * Marks an existing pending payment record as settled.
 *
 * When the payment is linked to an invoice, the invoice's `paymentStatus` (and
 * optionally `status`) are recalculated across all settled payments so that
 * partial payments are reflected correctly.
 */
export class MarkPaymentAsPaidUseCase {
  constructor(
    private readonly paymentRepo: PaymentRepository,
    private readonly invoiceRepo: InvoiceRepository,
  ) {}

  async execute(input: MarkPaymentAsPaidInput): Promise<MarkPaymentAsPaidResult> {
    const { paymentId, amount, method, notes, reference } = input;

    // 1. Load existing payment
    const existing = await this.paymentRepo.findById(paymentId);
    if (!existing) throw new Error(`Payment ${paymentId} not found`);

    if (existing.status === 'settled') {
      throw new Error('Payment is already settled');
    }

    // 2. Build updated payment record
    const updated: Payment = {
      ...existing,
      status: 'settled',
      ...(amount !== undefined && { amount }),
      ...(method && { method }),
      ...(notes !== undefined && { notes }),
      ...(reference !== undefined && { reference }),
      updatedAt: new Date().toISOString(),
    };

    await this.paymentRepo.update(updated);

    // 3. Recalculate invoice payment status when linked
    let invoicePaymentStatus: MarkPaymentAsPaidResult['invoicePaymentStatus'];

    if (updated.invoiceId) {
      const invoice = await this.invoiceRepo.getInvoice(updated.invoiceId);
      if (invoice) {
        const allPayments = await this.paymentRepo.findByInvoice(updated.invoiceId);
        const totalSettled = allPayments
          .filter((p) => p.status === 'settled')
          .reduce((sum, p) => sum + (p.amount ?? 0), 0);

        invoicePaymentStatus =
          totalSettled >= invoice.total
            ? 'paid'
            : totalSettled > 0
              ? 'partial'
              : 'unpaid';

        const invoiceUpdates: any = { paymentStatus: invoicePaymentStatus };

        if (
          invoicePaymentStatus === 'paid' &&
          (invoice.status === 'issued' || invoice.status === 'overdue')
        ) {
          invoiceUpdates.status = 'paid';
          invoiceUpdates.paymentDate = new Date().toISOString();
        }

        await this.invoiceRepo.updateInvoice(invoice.id, invoiceUpdates);
      }
    }

    return { payment: updated, invoicePaymentStatus };
  }
}
