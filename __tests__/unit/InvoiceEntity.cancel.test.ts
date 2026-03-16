import { InvoiceEntity, Invoice } from '../../src/domain/entities/Invoice';
import { Payment } from '../../src/domain/entities/Payment';

const makeInvoice = (overrides: Partial<Invoice> = {}): Invoice => ({
  id: 'inv_1',
  total: 1000,
  currency: 'AUD',
  status: 'issued',
  paymentStatus: 'unpaid',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  ...overrides,
});

const makePayment = (overrides: Partial<Payment> = {}): Payment => ({
  id: 'pay_1',
  amount: 500,
  status: 'pending',
  ...overrides,
});

describe('InvoiceEntity.canBeCancelled', () => {
  it('allows cancellation when there are no linked payments', () => {
    const entity = new InvoiceEntity(makeInvoice());
    expect(entity.canBeCancelled([])).toEqual({ allowed: true });
  });

  it('allows cancellation when all linked payments are pending (not settled)', () => {
    const entity = new InvoiceEntity(makeInvoice());
    const payments = [makePayment({ status: 'pending' })];
    expect(entity.canBeCancelled(payments)).toEqual({ allowed: true });
  });

  it('blocks cancellation when a settled payment exists', () => {
    const entity = new InvoiceEntity(makeInvoice());
    const payments = [makePayment({ status: 'settled' })];
    const result = entity.canBeCancelled(payments);
    expect(result.allowed).toBe(false);
    expect(result.reason).toMatch(/settled/i);
  });

  it('blocks when at least one of several payments is settled', () => {
    const entity = new InvoiceEntity(makeInvoice());
    const payments = [
      makePayment({ id: 'pay_1', status: 'pending' }),
      makePayment({ id: 'pay_2', status: 'settled' }),
    ];
    expect(entity.canBeCancelled(payments).allowed).toBe(false);
  });
});

describe('InvoiceEntity.cancel', () => {
  it('does not throw when no settled payments', () => {
    const entity = new InvoiceEntity(makeInvoice());
    expect(() => entity.cancel([])).not.toThrow();
  });

  it('throws when a settled payment is linked', () => {
    const entity = new InvoiceEntity(makeInvoice());
    const payments = [makePayment({ status: 'settled' })];
    expect(() => entity.cancel(payments)).toThrow(/settled/i);
  });
});
