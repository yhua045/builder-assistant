import { DeterministicReceiptNormalizer } from '../../src/application/receipt/DeterministicReceiptNormalizer';
import { ReceiptCandidates } from '../../src/application/receipt/ReceiptFieldParser';
import { OcrResult } from '../../src/application/services/IOcrAdapter';

describe('DeterministicReceiptNormalizer', () => {
  let normalizer: DeterministicReceiptNormalizer;

  beforeEach(() => {
    normalizer = new DeterministicReceiptNormalizer();
  });

  it('normalizes vendor with cleanup rules', async () => {
    const candidates: ReceiptCandidates = {
      vendors: ['Home Depot Inc.', 'Home Depot LLC'],
      dates: [],
      amounts: [],
      taxAmounts: [],
      receiptNumbers: [],
      lineItems: []
    };

    const ocrResult: OcrResult = {
      fullText: 'Home Depot Inc.',
      tokens: [],
      imageUri: 'test.jpg'
    };

    const result = await normalizer.normalize(candidates, ocrResult);
    
    expect(result.vendor).toBe('Home Depot');  // Cleaned "Inc." suffix
    expect(result.confidence.vendor).toBeGreaterThanOrEqual(0.7);
  });

  it('selects most recent date from candidates', async () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const lastMonth = new Date(today);
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    const candidates: ReceiptCandidates = {
      vendors: ['Store'],
      dates: [lastMonth, yesterday, today],
      amounts: [100],
      taxAmounts: [],
      receiptNumbers: [],
      lineItems: []
    };

    const ocrResult: OcrResult = {
      fullText: 'Test',
      tokens: [],
      imageUri: 'test.jpg'
    };

    const result = await normalizer.normalize(candidates, ocrResult);
    
    // Should pick most recent date (today)
    expect(result.date?.toDateString()).toBe(today.toDateString());
    expect(result.confidence.date).toBeGreaterThanOrEqual(0.7);
  });

  it('validates total > sum of line items', async () => {
    const candidates: ReceiptCandidates = {
      vendors: ['Store'],
      dates: [new Date()],
      amounts: [50, 100],  // Multiple amounts found
      taxAmounts: [10],
      receiptNumbers: [],
      lineItems: [
        { description: 'Item 1', quantity: 2, unitPrice: 20, total: 40, confidence: 0.8 },
        { description: 'Item 2', quantity: 1, unitPrice: 10, total: 10, confidence: 0.8 }
      ]  // Sum = 50
    };

    const ocrResult: OcrResult = {
      fullText: 'Test',
      tokens: [],
      imageUri: 'test.jpg'
    };

    const result = await normalizer.normalize(candidates, ocrResult);
    
    // Line items sum to 50, so total should be at least 50
    // Should pick 100 as more likely total (larger than line items sum)
    expect(result.total).toBeGreaterThanOrEqual(50);
    expect(result.confidence.total).toBeGreaterThan(0);
  });

  it('validates tax < total', async () => {
    const candidates: ReceiptCandidates = {
      vendors: ['Store'],
      dates: [new Date()],
      amounts: [100],
      taxAmounts: [10, 150],  // 150 is invalid (> total)
      receiptNumbers: [],
      lineItems: []
    };

    const ocrResult: OcrResult = {
      fullText: 'Test',
      tokens: [],
      imageUri: 'test.jpg'
    };

    const result = await normalizer.normalize(candidates, ocrResult);
    
    // Should pick 10 (valid tax < total)
    expect(result.tax).toBe(10);
    expect(result.tax).toBeLessThan(result.total!);
  });

  it('calculates confidence scores correctly', async () => {
    const candidates: ReceiptCandidates = {
      vendors: ['Home Depot'],
      dates: [new Date()],
      amounts: [100],
      taxAmounts: [10],
      receiptNumbers: ['INV-123'],
      lineItems: []
    };

    const ocrResult: OcrResult = {
      fullText: 'Home Depot\nDate: 2026-02-12\nTotal: $100.00\nTax: $10.00',
      tokens: [],
      imageUri: 'test.jpg'
    };

    const result = await normalizer.normalize(candidates, ocrResult);
    
    expect(result.confidence.overall).toBeGreaterThan(0);
    expect(result.confidence.overall).toBeLessThanOrEqual(1);
    expect(result.confidence.vendor).toBeGreaterThan(0.5);
    expect(result.confidence.date).toBeGreaterThan(0.5);
    expect(result.confidence.total).toBeGreaterThan(0.5);
  });

  it('returns suggested corrections for ambiguous fields', async () => {
    const candidates: ReceiptCandidates = {
      vendors: [],  // No vendor found
      dates: [],    // No date found
      amounts: [10, 20, 30],  // Multiple amounts, unclear which is total
      taxAmounts: [],
      receiptNumbers: [],
      lineItems: []
    };

    const ocrResult: OcrResult = {
      fullText: 'Low quality receipt',
      tokens: [],
      imageUri: 'test.jpg'
    };

    const result = await normalizer.normalize(candidates, ocrResult);
    
    expect(result.suggestedCorrections.length).toBeGreaterThan(0);
    expect(result.suggestedCorrections.some(s => s.toLowerCase().includes('vendor'))).toBe(true);
    expect(result.suggestedCorrections.some(s => s.toLowerCase().includes('date'))).toBe(true);
  });

  it('handles empty candidates gracefully', async () => {
    const candidates: ReceiptCandidates = {
      vendors: [],
      dates: [],
      amounts: [],
      taxAmounts: [],
      receiptNumbers: [],
      lineItems: []
    };

    const ocrResult: OcrResult = {
      fullText: '',
      tokens: [],
      imageUri: 'test.jpg'
    };

    const result = await normalizer.normalize(candidates, ocrResult);
    
    expect(result.vendor).toBeNull();
    expect(result.date).toBeNull();
    expect(result.total).toBeNull();
    expect(result.currency).toBe('USD');
    expect(result.confidence.overall).toBeLessThan(0.3);
  });

  it('defaults to USD currency', async () => {
    const candidates: ReceiptCandidates = {
      vendors: ['Store'],
      dates: [new Date()],
      amounts: [100],
      taxAmounts: [],
      receiptNumbers: [],
      lineItems: []
    };

    const ocrResult: OcrResult = {
      fullText: 'Store Total $100',
      tokens: [],
      imageUri: 'test.jpg'
    };

    const result = await normalizer.normalize(candidates, ocrResult);
    
    expect(result.currency).toBe('USD');
  });

  it('detects currency symbols', async () => {
    const candidates: ReceiptCandidates = {
      vendors: ['Store'],
      dates: [new Date()],
      amounts: [100],
      taxAmounts: [],
      receiptNumbers: [],
      lineItems: []
    };

    const ocrResult: OcrResult = {
      fullText: 'Store Total €100',
      tokens: [],
      imageUri: 'test.jpg'
    };

    const result = await normalizer.normalize(candidates, ocrResult);
    
    expect(result.currency).toBe('EUR');
  });
});
