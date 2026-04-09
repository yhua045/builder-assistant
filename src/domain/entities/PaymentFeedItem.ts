import { Payment } from './Payment';
import { Invoice } from './Invoice';

/**
 * Discriminated union representing one row in the project payments feed.
 * 'payment' → an unlinked, standalone Payment (no invoiceId)
 * 'invoice' → an Invoice record (any status)
 */
export type PaymentFeedItem =
  | { kind: 'payment'; data: Payment }
  | { kind: 'invoice'; data: Invoice };
