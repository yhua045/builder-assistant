/**
 * Unit tests for mapFeedItemToPaymentCard — Issue #203 (Reqs 5, 6, 7)
 */

import { mapFeedItemToPaymentCard } from '../../src/utils/mapFeedItemToPaymentCard';
import { PaymentFeedItem } from '../../src/domain/entities/PaymentFeedItem';
import { Payment } from '../../src/domain/entities/Payment';
import { Invoice } from '../../src/domain/entities/Invoice';

function makePaymentFeedItem(overrides: Partial<Payment> = {}): PaymentFeedItem {
  const payment: Payment = {
    id: 'pay-001',
    amount: 500,
    invoiceId: 'inv-001',
    projectId: 'proj-001',
    contractorName: 'Bob Builder',
    status: 'pending',
    createdAt: '2026-04-01T00:00:00Z',
    updatedAt: '2026-04-01T00:00:00Z',
    ...overrides,
  };
  return { kind: 'payment', data: payment };
}

function makeInvoiceFeedItem(overrides: Partial<Invoice> = {}): PaymentFeedItem {
  const invoice: Invoice = {
    id: 'inv-001',
    total: 2000,
    currency: 'AUD',
    status: 'issued',
    paymentStatus: 'unpaid',
    issuerName: 'Elite Plumbing',
    projectId: 'proj-001',
    createdAt: '2026-03-01T00:00:00Z',
    updatedAt: '2026-03-01T00:00:00Z',
    ...overrides,
  };
  return { kind: 'invoice', data: invoice };
}

describe('mapFeedItemToPaymentCard', () => {
  describe('kind: payment', () => {
    it('maps paidDate from payment.paidAt', () => {
      const item = makePaymentFeedItem({ paidAt: '2026-04-05T00:00:00Z' } as any);
      const card = mapFeedItemToPaymentCard(item);
      expect(card.paidDate).toBe('2026-04-05T00:00:00Z');
    });

    it('preserves payment status', () => {
      const item = makePaymentFeedItem({ status: 'settled' });
      const card = mapFeedItemToPaymentCard(item);
      expect(card.status).toBe('settled');
    });

    it('retains contractorName', () => {
      const item = makePaymentFeedItem({ contractorName: 'Sue Sparks' });
      const card = mapFeedItemToPaymentCard(item);
      expect(card.contractorName).toBe('Sue Sparks');
    });
  });

  describe('kind: invoice (unpaid)', () => {
    it('maps status to pending', () => {
      const item = makeInvoiceFeedItem({ paymentStatus: 'unpaid' });
      const card = mapFeedItemToPaymentCard(item);
      expect(card.status).toBe('pending');
    });

    it('maps dueDate from invoice.dateDue', () => {
      const item = makeInvoiceFeedItem({ dateDue: '2026-05-01T00:00:00Z' });
      const card = mapFeedItemToPaymentCard(item);
      expect(card.dueDate).toBe('2026-05-01T00:00:00Z');
    });

    it('maps contractorName from invoice.issuerName', () => {
      const item = makeInvoiceFeedItem({ issuerName: 'Elite Plumbing' });
      const card = mapFeedItemToPaymentCard(item);
      expect(card.contractorName).toBe('Elite Plumbing');
    });

    it('defaults contractorName to "Invoice Payable" when issuerName is absent', () => {
      const item = makeInvoiceFeedItem({ issuerName: undefined });
      const card = mapFeedItemToPaymentCard(item);
      expect(card.contractorName).toBe('Invoice Payable');
    });

    it('maps amount from invoice.total', () => {
      const item = makeInvoiceFeedItem({ total: 3500 });
      const card = mapFeedItemToPaymentCard(item);
      expect(card.amount).toBe(3500);
    });
  });

  describe('kind: invoice (paid)', () => {
    it('maps status to settled when paymentStatus is paid', () => {
      const item = makeInvoiceFeedItem({ paymentStatus: 'paid' });
      const card = mapFeedItemToPaymentCard(item);
      expect(card.status).toBe('settled');
    });

    it('maps paidDate from invoice.paymentDate', () => {
      const item = makeInvoiceFeedItem({
        paymentStatus: 'paid',
        paymentDate: '2026-04-10T00:00:00Z',
      });
      const card = mapFeedItemToPaymentCard(item);
      expect(card.paidDate).toBe('2026-04-10T00:00:00Z');
    });
  });
});
