import { normalizedInvoiceToFormValues } from '../../utils/normalizedInvoiceToFormValues';
import { NormalizedInvoice } from '../../application/IInvoiceNormalizer';

const makeNormalized = (overrides: Partial<NormalizedInvoice> = {}): NormalizedInvoice => ({
  vendor: 'Acme Corp',
  invoiceNumber: 'INV-2026-001',
  invoiceDate: new Date('2026-01-15T00:00:00.000Z'),
  dueDate: new Date('2026-02-15T00:00:00.000Z'),
  subtotal: 900,
  tax: 100,
  total: 1000,
  currency: 'USD',
  lineItems: [],
  confidence: { overall: 0.9, vendor: 0.9, invoiceNumber: 0.9, invoiceDate: 0.8, total: 0.95 },
  suggestedCorrections: [],
  ...overrides,
});

describe('normalizedInvoiceToFormValues', () => {
  describe('field mapping', () => {
    it('maps vendor to issuerName', () => {
      const result = normalizedInvoiceToFormValues(makeNormalized({ vendor: 'Test Vendor' }));
      expect(result.issuerName).toBe('Test Vendor');
    });

    it('maps invoiceNumber to externalReference', () => {
      const result = normalizedInvoiceToFormValues(makeNormalized({ invoiceNumber: 'INV-123' }));
      expect(result.externalReference).toBe('INV-123');
    });

    it('maps invoiceDate to dateIssued as ISO string', () => {
      const date = new Date('2026-01-15T00:00:00.000Z');
      const result = normalizedInvoiceToFormValues(makeNormalized({ invoiceDate: date }));
      expect(result.dateIssued).toBe(date.toISOString());
    });

    it('maps dueDate to dateDue as ISO string', () => {
      const date = new Date('2026-02-15T00:00:00.000Z');
      const result = normalizedInvoiceToFormValues(makeNormalized({ dueDate: date }));
      expect(result.dateDue).toBe(date.toISOString());
    });

    it('maps total', () => {
      const result = normalizedInvoiceToFormValues(makeNormalized({ total: 1234.56 }));
      expect(result.total).toBe(1234.56);
    });

    it('maps subtotal', () => {
      const result = normalizedInvoiceToFormValues(makeNormalized({ subtotal: 1100 }));
      expect(result.subtotal).toBe(1100);
    });

    it('maps tax', () => {
      const result = normalizedInvoiceToFormValues(makeNormalized({ tax: 134.56 }));
      expect(result.tax).toBe(134.56);
    });

    it('always maps currency', () => {
      const result = normalizedInvoiceToFormValues(makeNormalized({ currency: 'EUR' }));
      expect(result.currency).toBe('EUR');
    });
  });

  describe('null / undefined handling', () => {
    it('omits issuerName when vendor is null', () => {
      const result = normalizedInvoiceToFormValues(makeNormalized({ vendor: null }));
      expect(result.issuerName).toBeUndefined();
    });

    it('omits externalReference when invoiceNumber is null', () => {
      const result = normalizedInvoiceToFormValues(makeNormalized({ invoiceNumber: null }));
      expect(result.externalReference).toBeUndefined();
    });

    it('omits dateIssued when invoiceDate is null', () => {
      const result = normalizedInvoiceToFormValues(makeNormalized({ invoiceDate: null }));
      expect(result.dateIssued).toBeUndefined();
    });

    it('omits dateDue when dueDate is null', () => {
      const result = normalizedInvoiceToFormValues(makeNormalized({ dueDate: null }));
      expect(result.dateDue).toBeUndefined();
    });

    it('omits total when normalized total is null', () => {
      const result = normalizedInvoiceToFormValues(makeNormalized({ total: null }));
      expect(result.total).toBeUndefined();
    });

    it('omits subtotal when normalized subtotal is null', () => {
      const result = normalizedInvoiceToFormValues(makeNormalized({ subtotal: null }));
      expect(result.subtotal).toBeUndefined();
    });

    it('omits tax when normalized tax is null', () => {
      const result = normalizedInvoiceToFormValues(makeNormalized({ tax: null }));
      expect(result.tax).toBeUndefined();
    });
  });

  describe('line items mapping', () => {
    it('maps lineItems array to InvoiceLineItem shape', () => {
      const normalized = makeNormalized({
        lineItems: [
          { description: 'Labour', quantity: 8, unitPrice: 100, total: 800, tax: 80 },
          { description: 'Materials', quantity: 1, unitPrice: 200, total: 200 },
        ],
      });

      const result = normalizedInvoiceToFormValues(normalized);

      expect(result.lineItems).toHaveLength(2);
      expect(result.lineItems![0]).toEqual({
        description: 'Labour',
        quantity: 8,
        unitCost: 100,
        total: 800,
        tax: 80,
      });
      expect(result.lineItems![1]).toEqual({
        description: 'Materials',
        quantity: 1,
        unitCost: 200,
        total: 200,
        tax: undefined,
      });
    });

    it('omits lineItems when the array is empty', () => {
      const result = normalizedInvoiceToFormValues(makeNormalized({ lineItems: [] }));
      expect(result.lineItems).toBeUndefined();
    });
  });

  describe('complete empty normalized invoice', () => {
    it('returns only currency when all other fields are null', () => {
      const empty: NormalizedInvoice = {
        vendor: null,
        invoiceNumber: null,
        invoiceDate: null,
        dueDate: null,
        subtotal: null,
        tax: null,
        total: null,
        currency: 'USD',
        lineItems: [],
        confidence: { overall: 0, vendor: 0, invoiceNumber: 0, invoiceDate: 0, total: 0 },
        suggestedCorrections: [],
      };

      const result = normalizedInvoiceToFormValues(empty);

      expect(Object.keys(result)).toEqual(['currency']);
      expect(result.currency).toBe('USD');
    });
  });
});
