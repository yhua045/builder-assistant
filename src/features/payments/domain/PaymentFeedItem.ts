import { Payment } from '../../../shared/domain/entities/Payment';
import { Invoice } from '../../../shared/domain/entities/Invoice';

/**
 * Discriminated union representing one row in the project payments feed.
 * 'payment' → an unlinked, standalone Payment (no invoiceId)
 * 'invoice' → an Invoice record (any status)
 */
export type PaymentFeedItem =
  | { kind: 'payment'; data: Payment }
  | { kind: 'invoice'; data: Invoice };
