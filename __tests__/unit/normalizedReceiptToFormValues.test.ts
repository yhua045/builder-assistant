import { normalizedReceiptToFormValues } from '../../src/utils/normalizedReceiptToFormValues';
import { NormalizedReceipt } from '../../src/application/receipt/IReceiptNormalizer';

function makeReceipt(overrides: Partial<NormalizedReceipt> = {}): NormalizedReceipt {
  return {
    vendor: 'Bunnings',
    date: new Date('2026-04-10T00:00:00.000Z'),
    total: 150.0,
    subtotal: 136.36,
    tax: 13.64,
    currency: 'AUD',
    paymentMethod: 'card',
    receiptNumber: 'REC-001',
    lineItems: [],
    notes: 'Store purchase',
    confidence: { overall: 0.9, vendor: 0.9, date: 0.9, total: 0.9 },
    suggestedCorrections: [],
    ...overrides,
  };
}

describe('normalizedReceiptToFormValues', () => {
  it('maps vendor to vendor field', () => {
    const result = normalizedReceiptToFormValues(makeReceipt({ vendor: 'Bunnings' }));
    expect(result.vendor).toBe('Bunnings');
  });

  it('maps total to amount field', () => {
    const result = normalizedReceiptToFormValues(makeReceipt({ total: 150.0 }));
    expect(result.amount).toBe(150.0);
  });

  it('maps date to ISO string', () => {
    const date = new Date('2026-04-10T00:00:00.000Z');
    const result = normalizedReceiptToFormValues(makeReceipt({ date }));
    expect(result.date).toBe(date.toISOString());
  });

  it('maps paymentMethod', () => {
    const result = normalizedReceiptToFormValues(makeReceipt({ paymentMethod: 'cash' }));
    expect(result.paymentMethod).toBe('cash');
  });

  it('maps currency', () => {
    const result = normalizedReceiptToFormValues(makeReceipt({ currency: 'AUD' }));
    expect(result.currency).toBe('AUD');
  });

  it('maps notes', () => {
    const result = normalizedReceiptToFormValues(makeReceipt({ notes: 'Store purchase' }));
    expect(result.notes).toBe('Store purchase');
  });

  it('maps lineItems to ReceiptLineItemDTO array', () => {
    const receipt = makeReceipt({
      lineItems: [
        { description: 'Concrete blocks', quantity: 2, unitPrice: 45.0, total: 90.0 },
        { description: 'Gravel bags', quantity: 5, unitPrice: 9.27, total: 46.36 },
      ],
    });

    const result = normalizedReceiptToFormValues(receipt);
    expect(result.lineItems).toHaveLength(2);
    expect(result.lineItems![0]).toMatchObject({
      description: 'Concrete blocks',
      quantity: 2,
      unitPrice: 45.0,
      total: 90.0,
    });
    expect(result.lineItems![1]).toMatchObject({
      description: 'Gravel bags',
      quantity: 5,
      unitPrice: 9.27,
      total: 46.36,
    });
  });

  it('omits lineItems field when empty', () => {
    const result = normalizedReceiptToFormValues(makeReceipt({ lineItems: [] }));
    expect(result.lineItems).toBeUndefined();
  });

  it('omits null fields from result', () => {
    const result = normalizedReceiptToFormValues(
      makeReceipt({ vendor: null, total: null, date: null, paymentMethod: null, notes: null }),
    );
    expect(result.vendor).toBeUndefined();
    expect(result.amount).toBeUndefined();
    expect(result.date).toBeUndefined();
    expect(result.paymentMethod).toBeUndefined();
    expect(result.notes).toBeUndefined();
  });

  it('always includes currency (has a default)', () => {
    const result = normalizedReceiptToFormValues(makeReceipt({ currency: 'USD' }));
    expect(result.currency).toBe('USD');
  });
});
