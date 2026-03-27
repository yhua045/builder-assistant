import { InvoiceEntity } from '../../src/domain/entities/Invoice';

describe('InvoiceEntity validations', () => {
  it('throws when total is negative', () => {
    expect(() =>
      InvoiceEntity.create({ total: -5 } as any)
    ).toThrow('Invoice total must be a non-negative number');
  });

  it('throws when line items do not match subtotal', () => {
    const payload = {
      total: 100,
      subtotal: 90,
      lineItems: [
        { description: 'a', quantity: 1, unitCost: 50 },
        { description: 'b', quantity: 1, unitCost: 30 },
      ],
    } as any;

    expect(() => InvoiceEntity.create(payload)).toThrow('Invoice subtotal does not match sum of line items');
  });

  it('throws when due date is before issue date', () => {
    const payload = {
      total: 10,
      dateIssued: '2023-01-10T00:00:00.000Z',
      dateDue: '2023-01-01T00:00:00.000Z',
    } as any;

    expect(() => InvoiceEntity.create(payload)).toThrow('Invoice due date must be on or after issue date');
  });

  it('creates successfully for valid invoice with matching line items', () => {
    const payload = {
      total: 80,
      subtotal: 80,
      lineItems: [
        { description: 'a', quantity: 1, unitCost: 50 },
        { description: 'b', quantity: 1, unitCost: 30 },
      ],
    } as any;

    const e = InvoiceEntity.create(payload);
    expect(e.data().total).toBe(80);
    expect(e.data().subtotal).toBe(80);
  });

  it('auto-generates externalReference when blank', () => {
    const e = InvoiceEntity.create({ total: 10 } as any);
    const ref = e.data().externalReference;
    expect(ref).toBeDefined();
    expect(ref).toMatch(/^INV-\d{8}-[A-Z0-9]{6}$/);
  });

  it('auto-generates externalReference when explicitly empty string', () => {
    const e = InvoiceEntity.create({ total: 10, externalReference: '' } as any);
    const ref = e.data().externalReference;
    expect(ref).toMatch(/^INV-\d{8}-[A-Z0-9]{6}$/);
  });

  it('preserves externalReference when explicitly provided', () => {
    const e = InvoiceEntity.create({ total: 10, externalReference: 'MY-REF-001' } as any);
    expect(e.data().externalReference).toBe('MY-REF-001');
  });

  it('defaults currency to AUD', () => {
    const e = InvoiceEntity.create({ total: 10 } as any);
    expect(e.data().currency).toBe('AUD');
  });
});
