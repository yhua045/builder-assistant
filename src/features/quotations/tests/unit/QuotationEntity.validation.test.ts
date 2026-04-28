import { QuotationEntity } from '../../../../domain/entities/Quotation';

describe('QuotationEntity validations', () => {
  it('auto-generates reference when reference is missing', () => {
    const entity = QuotationEntity.create({
      reference: '',
      date: '2026-01-15',
      total: 100,
    } as any);
    expect(entity.data().reference).toMatch(/^QUO-\d{8}-[A-Z0-9]{6}$/);
  });

  it('throws when date is missing', () => {
    expect(() =>
      QuotationEntity.create({
        reference: 'QT-001',
        total: 100,
      } as any)
    ).toThrow('Quotation date is required');
  });

  it('throws when date is invalid', () => {
    expect(() =>
      QuotationEntity.create({
        reference: 'QT-001',
        date: 'invalid-date',
        total: 100,
      } as any)
    ).toThrow('Quotation date must be a valid ISO date');
  });

  it('throws when total is negative', () => {
    expect(() =>
      QuotationEntity.create({
        reference: 'QT-001',
        date: '2026-01-15',
        total: -5,
      } as any)
    ).toThrow('Quotation total must be a non-negative number');
  });

  it('throws when expiry date is invalid', () => {
    expect(() =>
      QuotationEntity.create({
        reference: 'QT-001',
        date: '2026-01-15',
        expiryDate: 'invalid-date',
        total: 100,
      } as any)
    ).toThrow('Quotation expiry date must be a valid ISO date');
  });

  it('throws when expiry date is before quotation date', () => {
    expect(() =>
      QuotationEntity.create({
        reference: 'QT-001',
        date: '2026-01-15',
        expiryDate: '2026-01-10',
        total: 100,
      } as any)
    ).toThrow('Quotation expiry date must be on or after quotation date');
  });

  it('throws when line items do not match subtotal', () => {
    const payload = {
      reference: 'QT-001',
      date: '2026-01-15',
      total: 100,
      subtotal: 90,
      lineItems: [
        { description: 'Item A', quantity: 1, unitPrice: 50 },
        { description: 'Item B', quantity: 1, unitPrice: 30 },
      ],
    } as any;

    expect(() => QuotationEntity.create(payload)).toThrow(
      'Quotation subtotal does not match sum of line items'
    );
  });

  it('creates successfully for valid quotation with matching line items', () => {
    const payload = {
      reference: 'QT-001',
      date: '2026-01-15',
      total: 80,
      subtotal: 80,
      lineItems: [
        { description: 'Item A', quantity: 1, unitPrice: 50 },
        { description: 'Item B', quantity: 1, unitPrice: 30 },
      ],
    } as any;

    const entity = QuotationEntity.create(payload);
    expect(entity.data().reference).toBe('QT-001');
    expect(entity.data().total).toBe(80);
    expect(entity.data().subtotal).toBe(80);
    expect(entity.data().status).toBe('draft');
    expect(entity.data().currency).toBe('USD');
  });

  it('creates successfully for valid quotation without line items', () => {
    const payload = {
      reference: 'QT-002',
      date: '2026-01-15',
      expiryDate: '2026-02-15',
      total: 1500.50,
      vendorName: 'ABC Supplies',
      notes: 'Test quotation',
    } as any;

    const entity = QuotationEntity.create(payload);
    const data = entity.data();
    
    expect(data.reference).toBe('QT-002');
    expect(data.date).toBe('2026-01-15');
    expect(data.expiryDate).toBe('2026-02-15');
    expect(data.total).toBe(1500.50);
    expect(data.vendorName).toBe('ABC Supplies');
    expect(data.notes).toBe('Test quotation');
    expect(data.status).toBe('draft');
    expect(data.id).toBeTruthy();
    expect(data.createdAt).toBeTruthy();
    expect(data.updatedAt).toBeTruthy();
  });

  it('allows custom status during creation', () => {
    const payload = {
      reference: 'QT-003',
      date: '2026-01-15',
      total: 100,
      status: 'sent' as const,
    } as any;

    const entity = QuotationEntity.create(payload);
    expect(entity.data().status).toBe('sent');
  });

  it('allows custom currency during creation', () => {
    const payload = {
      reference: 'QT-004',
      date: '2026-01-15',
      total: 100,
      currency: 'EUR',
    } as any;

    const entity = QuotationEntity.create(payload);
    expect(entity.data().currency).toBe('EUR');
  });

  it('accepts expiry date equal to quotation date', () => {
    const payload = {
      reference: 'QT-005',
      date: '2026-01-15',
      expiryDate: '2026-01-15',
      total: 100,
    } as any;

    const entity = QuotationEntity.create(payload);
    expect(entity.data().expiryDate).toBe('2026-01-15');
  });
});
