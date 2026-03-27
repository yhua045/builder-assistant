import { normalizedInvoiceToQuotationFormValues } from '../../src/utils/normalizedInvoiceToQuotationFormValues';
import { NormalizedInvoice } from '../../src/application/ai/IInvoiceNormalizer';

function makeNormalized(overrides: Partial<NormalizedInvoice> = {}): NormalizedInvoice {
  return {
    vendor: 'Acme Builder Supplies',
    invoiceNumber: 'QUO-2026-001',
    invoiceDate: new Date('2026-03-01T00:00:00.000Z'),
    dueDate: new Date('2026-04-01T00:00:00.000Z'),
    subtotal: 900,
    tax: 90,
    total: 990,
    currency: 'AUD',
    lineItems: [
      { description: 'Bricks', quantity: 100, unitPrice: 5, total: 500, tax: 50 },
      { description: 'Mortar', quantity: 20, unitPrice: 20, total: 400, tax: 40 },
    ],
    confidence: { overall: 0.9, vendor: 0.9, invoiceNumber: 0.8, invoiceDate: 0.9, total: 0.95 },
    suggestedCorrections: [],
    ...overrides,
  };
}

describe('normalizedInvoiceToQuotationFormValues', () => {
  it('maps all fields when a full normalized invoice is provided', () => {
    const result = normalizedInvoiceToQuotationFormValues(makeNormalized());

    expect(result.vendorName).toBe('Acme Builder Supplies');
    expect(result.reference).toBe('QUO-2026-001');
    expect(result.date).toBe('2026-03-01T00:00:00.000Z');
    expect(result.expiryDate).toBe('2026-04-01T00:00:00.000Z');
    expect(result.total).toBe(990);
    expect(result.currency).toBe('AUD');
  });

  it('omits vendorName when vendor is null', () => {
    const result = normalizedInvoiceToQuotationFormValues(makeNormalized({ vendor: null }));
    expect(result).not.toHaveProperty('vendorName');
  });

  it('omits reference when invoiceNumber is null', () => {
    const result = normalizedInvoiceToQuotationFormValues(makeNormalized({ invoiceNumber: null }));
    expect(result).not.toHaveProperty('reference');
  });

  it('omits date when invoiceDate is null', () => {
    const result = normalizedInvoiceToQuotationFormValues(makeNormalized({ invoiceDate: null }));
    expect(result).not.toHaveProperty('date');
  });

  it('omits expiryDate when dueDate is null', () => {
    const result = normalizedInvoiceToQuotationFormValues(makeNormalized({ dueDate: null }));
    expect(result).not.toHaveProperty('expiryDate');
  });

  it('maps lineItems to quotation line item shape', () => {
    const result = normalizedInvoiceToQuotationFormValues(makeNormalized());
    expect(result.lineItems).toHaveLength(2);
    expect(result.lineItems![0]).toEqual({
      description: 'Bricks',
      quantity: 100,
      unitPrice: 5,
      total: 500,
      tax: 50,
    });
    expect(result.lineItems![1]).toEqual({
      description: 'Mortar',
      quantity: 20,
      unitPrice: 20,
      total: 400,
      tax: 40,
    });
  });

  it('omits lineItems when lineItems array is empty', () => {
    const result = normalizedInvoiceToQuotationFormValues(makeNormalized({ lineItems: [] }));
    expect(result).not.toHaveProperty('lineItems');
  });

  it('always maps currency even when other fields are null', () => {
    const result = normalizedInvoiceToQuotationFormValues(
      makeNormalized({
        vendor: null,
        invoiceNumber: null,
        invoiceDate: null,
        dueDate: null,
        lineItems: [],
      })
    );
    expect(result.currency).toBe('AUD');
  });
});
