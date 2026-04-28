import { normalizedQuotationToFormValues } from '../../hooks/normalizedQuotationToFormValues';
import { NormalizedQuotation } from '../../application/ai/IQuotationParsingStrategy';

function makeNormalizedQuotation(
  overrides: Partial<NormalizedQuotation> = {},
): NormalizedQuotation {
  return {
    reference: null,
    vendor: null,
    vendorEmail: null,
    vendorPhone: null,
    vendorAddress: null,
    taxId: null,
    date: null,
    expiryDate: null,
    currency: 'AUD',
    subtotal: null,
    tax: null,
    total: null,
    lineItems: [],
    paymentTerms: null,
    scope: null,
    exclusions: null,
    notes: null,
    confidence: { overall: 0, vendor: 0, reference: 0, date: 0, total: 0 },
    suggestedCorrections: [],
    ...overrides,
  };
}

describe('normalizedQuotationToFormValues', () => {
  it('maps vendor to vendorName', () => {
    const result = normalizedQuotationToFormValues(
      makeNormalizedQuotation({ vendor: 'Builder Co' }),
    );
    expect(result.vendorName).toBe('Builder Co');
  });

  it('maps reference', () => {
    const result = normalizedQuotationToFormValues(
      makeNormalizedQuotation({ reference: 'QUO-001' }),
    );
    expect(result.reference).toBe('QUO-001');
  });

  it('maps date to ISO string', () => {
    const date = new Date('2026-03-01T00:00:00.000Z');
    const result = normalizedQuotationToFormValues(makeNormalizedQuotation({ date }));
    expect(result.date).toBe(date.toISOString());
  });

  it('maps expiryDate to ISO string', () => {
    const expiryDate = new Date('2026-04-01T00:00:00.000Z');
    const result = normalizedQuotationToFormValues(makeNormalizedQuotation({ expiryDate }));
    expect(result.expiryDate).toBe(expiryDate.toISOString());
  });

  it('maps total', () => {
    const result = normalizedQuotationToFormValues(
      makeNormalizedQuotation({ total: 5500 }),
    );
    expect(result.total).toBe(5500);
  });

  it('maps subtotal', () => {
    const result = normalizedQuotationToFormValues(
      makeNormalizedQuotation({ subtotal: 5000 }),
    );
    expect(result.subtotal).toBe(5000);
  });

  it('maps tax to taxTotal', () => {
    const result = normalizedQuotationToFormValues(
      makeNormalizedQuotation({ tax: 500 }),
    );
    expect(result.taxTotal).toBe(500);
  });

  it('maps vendorEmail', () => {
    const result = normalizedQuotationToFormValues(
      makeNormalizedQuotation({ vendorEmail: 'info@builder.co' }),
    );
    expect(result.vendorEmail).toBe('info@builder.co');
  });

  it('maps vendorAddress', () => {
    const result = normalizedQuotationToFormValues(
      makeNormalizedQuotation({ vendorAddress: '1 Main St' }),
    );
    expect(result.vendorAddress).toBe('1 Main St');
  });

  it('maps notes', () => {
    const result = normalizedQuotationToFormValues(
      makeNormalizedQuotation({ notes: 'Valid for 30 days' }),
    );
    expect(result.notes).toBe('Valid for 30 days');
  });

  it('always maps currency', () => {
    const result = normalizedQuotationToFormValues(makeNormalizedQuotation());
    expect(result.currency).toBe('AUD');
  });

  it('maps lineItems', () => {
    const result = normalizedQuotationToFormValues(
      makeNormalizedQuotation({
        lineItems: [
          { description: 'Tiling', quantity: 10, unitPrice: 100, total: 1000, tax: 100 },
        ],
      }),
    );
    expect(result.lineItems).toHaveLength(1);
    expect(result.lineItems![0]).toMatchObject({
      description: 'Tiling',
      quantity: 10,
      unitPrice: 100,
      total: 1000,
      tax: 100,
    });
  });

  it('omits null fields (no vendorName key when vendor is null)', () => {
    const result = normalizedQuotationToFormValues(makeNormalizedQuotation());
    expect(result).not.toHaveProperty('vendorName');
    expect(result).not.toHaveProperty('reference');
    expect(result).not.toHaveProperty('date');
    expect(result).not.toHaveProperty('expiryDate');
    expect(result).not.toHaveProperty('total');
    expect(result).not.toHaveProperty('subtotal');
    expect(result).not.toHaveProperty('taxTotal');
    expect(result).not.toHaveProperty('notes');
    expect(result.lineItems).toBeUndefined();
  });

  it('does not include lineItems when list is empty', () => {
    const result = normalizedQuotationToFormValues(
      makeNormalizedQuotation({ lineItems: [] }),
    );
    expect(result.lineItems).toBeUndefined();
  });
});
