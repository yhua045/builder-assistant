import { ReceiptFieldParser } from '../../src/application/receipt/ReceiptFieldParser';
import { OcrResult } from '../../src/application/services/IOcrAdapter';

describe('ReceiptFieldParser', () => {
  let parser: ReceiptFieldParser;

  beforeEach(() => {
    parser = new ReceiptFieldParser();
  });

  it('should extract vendor candidates from top lines', () => {
    const mockResult: OcrResult = {
      imageUri: 'file:///test.jpg',
      fullText: 'Home Depot\n123 Main St\nDate: 2026-02-12',
      tokens: [
        { text: 'Home', confidence: 0.9 },
        { text: 'Depot', confidence: 0.9 },
        { text: '123', confidence: 0.8 },
        { text: 'Main', confidence: 0.8 },
        { text: 'St', confidence: 0.8 },
        { text: 'Date:', confidence: 0.9 },
        { text: '2026-02-12', confidence: 0.9 },
      ],
    };

    const result = parser.parse(mockResult);
    expect(result.vendors).toContain('Home Depot');
  });

  it('should extract date candidates', () => {
    const mockResult: OcrResult = {
      imageUri: 'file:///test.jpg',
      fullText: 'Date: 02/12/2026\nTotal: $100.00',
      tokens: [],
    };

    const result = parser.parse(mockResult);
    // 02/12/2026 is Feb 12, 2026
    const expectedDate = new Date(2026, 1, 12); 
    expect(result.dates).toHaveLength(1);
    expect(result.dates[0].toDateString()).toBe(expectedDate.toDateString());
  });

  it('should extract amount candidates', () => {
    const mockResult: OcrResult = {
      imageUri: 'file:///test.jpg',
      fullText: 'Item 1 $10.00\nTotal $100.00',
      tokens: [],
    };

    const result = parser.parse(mockResult);
    expect(result.amounts).toContain(100.00);
    expect(result.amounts).toContain(10.00);
  });

  it('should extract tax candidates', () => {
     const mockResult: OcrResult = {
      imageUri: 'file:///test.jpg',
      fullText: 'Subtotal $90.00\nTax $10.00\nTotal $100.00',
      tokens: [],
    };

    const result = parser.parse(mockResult);
    expect(result.taxAmounts).toContain(10.00);
  });
  
  it('should extract receipt number candidates', () => {
     const mockResult: OcrResult = {
      imageUri: 'file:///test.jpg',
      fullText: 'Receipt # 123456\nTotal $100.00',
      tokens: [],
    };

    const result = parser.parse(mockResult);
    expect(result.receiptNumbers).toContain('123456');
  });

  it('should extract line items with quantity and price', () => {
     const mockResult: OcrResult = {
      imageUri: 'file:///test.jpg',
      fullText: '2 x Widget @ $5.00 = $10.00\nTotal $10.00',
      tokens: [],
    };

    const result = parser.parse(mockResult);
    expect(result.lineItems).toHaveLength(1);
    expect(result.lineItems[0]).toEqual(expect.objectContaining({
        description: expect.stringContaining('Widget'),
        quantity: 2,
        unitPrice: 5.00,
        total: 10.00
    }));
  });
});
