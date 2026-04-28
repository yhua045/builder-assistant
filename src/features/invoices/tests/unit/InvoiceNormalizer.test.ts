import { InvoiceNormalizer } from '../../application/InvoiceNormalizer';
import { InvoiceCandidates } from '../../application/IInvoiceNormalizer';
import { OcrResult } from '../../../../application/services/IOcrAdapter';

describe('InvoiceNormalizer', () => {
  let normalizer: InvoiceNormalizer;

  beforeEach(() => {
    normalizer = new InvoiceNormalizer();
  });

  describe('normalize', () => {
    it('should normalize invoice with complete candidates', async () => {
      const candidates: InvoiceCandidates = {
        vendors: ['ACME Construction Inc.', 'ACME Construction', 'ACME Construction'],
        invoiceNumbers: ['INV-2024-001', '2024-001'],
        dates: [new Date('2024-02-15'), new Date('2024-02-14')],
        dueDates: [new Date('2024-03-15'), new Date('2024-03-16')],
        amounts: [15000, 14500],
        subtotals: [13000],
        taxAmounts: [2000, 1950],
        lineItems: [
          { description: 'Labor - Framing', quantity: 40, unitPrice: 150, total: 6000 },
          { description: 'Materials - Lumber', quantity: 1, unitPrice: 7000, total: 7000 },
        ],
      };

      const ocrResult: OcrResult = {
        fullText: 'ACME Construction Inc.\nInvoice: INV-2024-001\nDate: 02/15/2024\nDue: 03/15/2024\nSubtotal: $13,000.00\nTax: $2,000.00\nTotal: $15,000.00',
        tokens: [],
        imageUri: '',
      };

      const result = await normalizer.normalize(candidates, ocrResult);

      expect(result.vendor).toBe('ACME Construction');
      expect(result.invoiceNumber).toBe('INV-2024-001');
      expect(result.invoiceDate).toEqual(new Date('2024-02-15'));
      expect(result.dueDate).toEqual(new Date('2024-03-15'));
      expect(result.subtotal).toBe(13000);
      expect(result.tax).toBe(2000);
      expect(result.total).toBe(15000);
      expect(result.currency).toBe('USD');
      expect(result.lineItems).toHaveLength(2);
      expect(result.confidence.overall).toBeGreaterThan(0.7);
      expect(result.confidence.vendor).toBeGreaterThan(0.8);
    });

    it('should handle empty candidates gracefully', async () => {
      const candidates: InvoiceCandidates = {
        vendors: [],
        invoiceNumbers: [],
        dates: [],
        dueDates: [],
        amounts: [],
        subtotals: [],
        taxAmounts: [],
        lineItems: [],
      };

      const ocrResult: OcrResult = {
        fullText: 'Random text without invoice data',
        tokens: [],
        imageUri: '',
      };

      const result = await normalizer.normalize(candidates, ocrResult);

      expect(result.vendor).toBeNull();
      expect(result.invoiceNumber).toBeNull();
      expect(result.invoiceDate).toBeNull();
      expect(result.total).toBeNull();
      expect(result.confidence.overall).toBeLessThan(0.3);
      expect(result.suggestedCorrections.length).toBeGreaterThan(0);
    });

    it('should normalize vendor name by removing legal suffixes', async () => {
      const candidates: InvoiceCandidates = {
        vendors: ['ABC Company LLC', 'ABC Company Ltd.', 'ABC Company Inc.'],
        invoiceNumbers: ['INV-001'],
        dates: [new Date('2024-02-15')],
        dueDates: [],
        amounts: [1000],
        subtotals: [],
        taxAmounts: [],
        lineItems: [],
      };

      const ocrResult: OcrResult = { fullText: '', tokens: [], imageUri: '' };

      const result = await normalizer.normalize(candidates, ocrResult);

      expect(result.vendor).toBe('ABC Company');
    });

    it('should select most recent invoice date within reasonable range', async () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);  // 1 year ago
      const recentDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);  // 5 days ago
      const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days from now

      const candidates: InvoiceCandidates = {
        vendors: ['Test Vendor'],
        invoiceNumbers: [],
        dates: [oldDate, recentDate, futureDate],
        dueDates: [],
        amounts: [1000],
        subtotals: [],
        taxAmounts: [],
        lineItems: [],
      };

      const ocrResult: OcrResult = { fullText: '', tokens: [], imageUri: '' };

      const result = await normalizer.normalize(candidates, ocrResult);

      expect(result.invoiceDate).toEqual(recentDate);
    });

    it('should validate total matches line items sum', async () => {
      const candidates: InvoiceCandidates = {
        vendors: ['Test Vendor'],
        invoiceNumbers: [],
        dates: [],
        dueDates: [],
        amounts: [5000, 5100],  // Candidate totals
        subtotals: [],
        taxAmounts: [],
        lineItems: [
          { description: 'Item 1', quantity: 1, unitPrice: 2000, total: 2000 },
          { description: 'Item 2', quantity: 1, unitPrice: 3000, total: 3000 },
        ],
      };

      const ocrResult: OcrResult = { fullText: '', tokens: [], imageUri: '' };

      const result = await normalizer.normalize(candidates, ocrResult);

      // Should pick 5000 as it matches line items sum (2000 + 3000)
      expect(result.total).toBe(5000);
      expect(result.confidence.total).toBeGreaterThan(0.8);
    });

    it('should detect currency from OCR text', async () => {
      const candidates: InvoiceCandidates = {
        vendors: ['Test Vendor'],
        invoiceNumbers: [],
        dates: [],
        dueDates: [],
        amounts: [1000],
        subtotals: [],
        taxAmounts: [],
        lineItems: [],
      };

      const ocrResult: OcrResult = {
        fullText: 'Total: €1,000.00',
        tokens: [],
        imageUri: '',
      };

      const result = await normalizer.normalize(candidates, ocrResult);

      expect(result.currency).toBe('EUR');
    });

    it('should provide suggestions when confidence is low', async () => {
      const candidates: InvoiceCandidates = {
        vendors: ['A', 'B', 'C'],  // Multiple ambiguous vendors
        invoiceNumbers: [],
        dates: [],
        dueDates: [],
        amounts: [100, 200, 300, 400],  // Multiple different amounts
        subtotals: [],
        taxAmounts: [],
        lineItems: [],
      };

      const ocrResult: OcrResult = { fullText: '', tokens: [], imageUri: '' };

      const result = await normalizer.normalize(candidates, ocrResult);

      expect(result.suggestedCorrections.length).toBeGreaterThan(0);
      expect(result.confidence.overall).toBeLessThan(0.5);
    });

    it('should normalize line items correctly', async () => {
      const candidates: InvoiceCandidates = {
        vendors: ['Test Vendor'],
        invoiceNumbers: [],
        dates: [],
        dueDates: [],
        amounts: [10500],
        subtotals: [],
        taxAmounts: [],
        lineItems: [
          { description: 'Consulting', quantity: 10, unitPrice: 100 },  // Missing total
          { description: 'Materials', total: 500 },  // Missing quantity/unit price
        ],
      };

      const ocrResult: OcrResult = { fullText: '', tokens: [], imageUri: '' };

      const result = await normalizer.normalize(candidates, ocrResult);

      expect(result.lineItems).toHaveLength(2);
      expect(result.lineItems[0].total).toBe(1000);  // 10 * 100
      expect(result.lineItems[0].quantity).toBe(10);
      expect(result.lineItems[1].total).toBe(500);
      expect(result.lineItems[1].quantity).toBe(1);  // Default quantity
    });

    it('should validate due date is after invoice date', async () => {
      const invoiceDate = new Date('2024-02-15');
      const invalidDueDate = new Date('2024-02-10');  // Before invoice date
      const validDueDate = new Date('2024-03-15');

      const candidates: InvoiceCandidates = {
        vendors: ['Test Vendor'],
        invoiceNumbers: [],
        dates: [invoiceDate],
        dueDates: [invalidDueDate, validDueDate],
        amounts: [1000],
        subtotals: [],
        taxAmounts: [],
        lineItems: [],
      };

      const ocrResult: OcrResult = { fullText: '', tokens: [], imageUri: '' };

      const result = await normalizer.normalize(candidates, ocrResult);

      expect(result.invoiceDate).toEqual(invoiceDate);
      expect(result.dueDate).toEqual(validDueDate);
    });

    it('should validate tax amount is less than total', async () => {
      const candidates: InvoiceCandidates = {
        vendors: ['Test Vendor'],
        invoiceNumbers: [],
        dates: [],
        dueDates: [],
        amounts: [1000],
        subtotals: [],
        taxAmounts: [1500, 150],  // First is invalid (> total), second is valid
        lineItems: [],
      };

      const ocrResult: OcrResult = { fullText: '', tokens: [], imageUri: '' };

      const result = await normalizer.normalize(candidates, ocrResult);

      expect(result.total).toBe(1000);
      expect(result.tax).toBe(150);  // Should pick valid tax
    });
  });
});
