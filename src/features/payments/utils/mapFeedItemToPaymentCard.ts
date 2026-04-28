import { PaymentFeedItem } from '../domain/PaymentFeedItem';
import { PaymentCardPayment } from '../components/PaymentCard';

/**
 * Maps a PaymentFeedItem (either a standalone Payment or an Invoice)
 * to a PaymentCardPayment for display in PaymentCard / PaymentDetails screen.
 */
export function mapFeedItemToPaymentCard(item: PaymentFeedItem): PaymentCardPayment {
  if (item.kind === 'payment') {
    const payment = item.data;
    return {
      ...payment,
      paidDate: (payment as any).paidAt,
    };
  }

  // kind === 'invoice'
  const inv = item.data;
  const isPaid = inv.paymentStatus === 'paid';

  return {
    id: inv.id,
    projectId: inv.projectId,
    invoiceId: inv.id,
    amount: inv.total,
    currency: inv.currency,
    dueDate: inv.dateDue ?? (inv as any).dueDate,
    status: isPaid ? 'settled' : 'pending',
    contractorName: inv.issuerName ?? (inv as any).vendor ?? 'Invoice Payable',
    invoiceStatus: inv.status,
    paidDate: inv.paymentDate,
    notes: (inv as any).notes,
    createdAt: inv.createdAt,
    updatedAt: inv.updatedAt,
  };
}
