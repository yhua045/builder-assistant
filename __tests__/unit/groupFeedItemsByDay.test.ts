import { PaymentFeedItem } from '../../src/domain/entities/PaymentFeedItem';
import { Payment } from '../../src/domain/entities/Payment';
import { Invoice } from '../../src/domain/entities/Invoice';
import { groupFeedItemsByDay } from '../../src/hooks/usePaymentsTimeline';

function makePaymentItem(overrides: Partial<Payment> = {}): PaymentFeedItem {
  return {
    kind: 'payment',
    data: {
      id: `pay_${Math.random().toString(36).slice(2)}`,
      amount: 500,
      status: 'pending',
      ...overrides,
    },
  };
}

function makeInvoiceItem(overrides: Partial<Invoice> = {}): PaymentFeedItem {
  return {
    kind: 'invoice',
    data: {
      id: `inv_${Math.random().toString(36).slice(2)}`,
      total: 1000,
      currency: 'AUD',
      status: 'issued',
      paymentStatus: 'unpaid',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...overrides,
    },
  };
}

describe('groupFeedItemsByDay', () => {
  // G1: payment and invoice on same date → same bucket
  it('G1: places payment and invoice with the same date in the same day bucket', () => {
    const payment = makePaymentItem({ dueDate: '2026-04-20' });
    const invoice = makeInvoiceItem({ dateDue: '2026-04-20' });

    const groups = groupFeedItemsByDay([payment, invoice]);

    expect(groups).toHaveLength(1);
    expect(groups[0].date).toBe('2026-04-20');
    expect(groups[0].items).toHaveLength(2);
  });

  // G2: item with no date → placed in '__nodate__' bucket at end
  it('G2: places no-date items in __nodate__ bucket at the end', () => {
    const datedPayment = makePaymentItem({ dueDate: '2026-04-10' });
    const nodateInvoice = makeInvoiceItem({ dateDue: undefined, dueDate: undefined, issueDate: undefined });

    const groups = groupFeedItemsByDay([datedPayment, nodateInvoice]);

    expect(groups).toHaveLength(2);
    expect(groups[0].date).toBe('2026-04-10');
    expect(groups[1].date).toBe('__nodate__');
    expect(groups[1].label).toBe('No Date');
  });

  // G3: multiple dates → buckets sorted ascending
  it('G3: sorts day buckets ascending by date', () => {
    const items = [
      makePaymentItem({ dueDate: '2026-04-25' }),
      makeInvoiceItem({ dateDue: '2026-04-10' }),
      makePaymentItem({ dueDate: '2026-04-15' }),
    ];

    const groups = groupFeedItemsByDay(items);

    expect(groups).toHaveLength(3);
    expect(groups[0].date).toBe('2026-04-10');
    expect(groups[1].date).toBe('2026-04-15');
    expect(groups[2].date).toBe('2026-04-25');
  });

  // Invoice uses dateDue field
  it('extracts date from invoice.dateDue', () => {
    const invoice = makeInvoiceItem({ dateDue: '2026-05-01', dueDate: undefined, issueDate: undefined });
    const groups = groupFeedItemsByDay([invoice]);

    expect(groups[0].date).toBe('2026-05-01');
  });

  // Invoice falls back to dueDate alias
  it('falls back to invoice.dueDate alias when dateDue is absent', () => {
    const invoice = makeInvoiceItem({ dateDue: undefined, dueDate: '2026-05-02', issueDate: undefined });
    const groups = groupFeedItemsByDay([invoice]);

    expect(groups[0].date).toBe('2026-05-02');
  });

  // Empty list → empty groups
  it('returns empty array for empty input', () => {
    expect(groupFeedItemsByDay([])).toEqual([]);
  });
});
