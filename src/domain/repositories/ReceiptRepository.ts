import { Invoice } from '../entities/Invoice';
import { Payment } from '../entities/Payment';

export interface ReceiptRepository {
  createReceipt(invoice: Invoice, payment: Payment): Promise<{ invoice: Invoice; payment: Payment }>;
  createUnpaidInvoice(invoice: Invoice): Promise<Invoice>;
}
