import { LlmReceiptParser } from '../../infrastructure/LlmReceiptParser';
import { OcrResult } from '../../../../application/services/IOcrAdapter';

const mockOcrResult: OcrResult = {
  fullText: 'Receipt from Bunnings\nDate: 2026-04-10\nTotal: $150.00\nGST: $13.64',
  tokens: [],
  imageUri: 'file:///tmp/receipt.jpg',
};

function mockFetchSuccess(content: string): jest.SpyInstance {
  return jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      choices: [{ message: { content } }],
    }),
  } as Response);
}

function mockFetchHttpError(status: number): jest.SpyInstance {
  return jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
    ok: false,
    status,
  } as Response);
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('LlmReceiptParser', () => {
  it('strategyType is "llm"', () => {
    const parser = new LlmReceiptParser('test-key');
    expect(parser.strategyType).toBe('llm');
  });

  it('parses a well-formed LLM JSON response', async () => {
    const responseJson = JSON.stringify({
      vendor: 'Bunnings',
      date: '2026-04-10',
      total: 150.0,
      subtotal: 136.36,
      tax: 13.64,
      currency: 'AUD',
      paymentMethod: 'card',
      receiptNumber: 'REC-12345',
      lineItems: [
        {
          description: 'Concrete blocks',
          quantity: 2,
          unitPrice: 45.0,
          total: 90.0,
        },
        {
          description: 'Gravel bags',
          quantity: 5,
          unitPrice: 9.27,
          total: 46.36,
        },
      ],
      notes: 'Paid in store',
    });

    mockFetchSuccess(responseJson);
    const parser = new LlmReceiptParser('test-key');
    const result = await parser.parse(mockOcrResult);

    expect(result.vendor).toBe('Bunnings');
    expect(result.date).toEqual(new Date('2026-04-10'));
    expect(result.total).toBe(150.0);
    expect(result.subtotal).toBe(136.36);
    expect(result.tax).toBe(13.64);
    expect(result.currency).toBe('AUD');
    expect(result.paymentMethod).toBe('card');
    expect(result.receiptNumber).toBe('REC-12345');
    expect(result.notes).toBe('Paid in store');
    expect(result.lineItems).toHaveLength(2);
    expect(result.lineItems[0]).toMatchObject({
      description: 'Concrete blocks',
      quantity: 2,
      unitPrice: 45.0,
      total: 90.0,
    });
    expect(result.lineItems[1]).toMatchObject({
      description: 'Gravel bags',
      quantity: 5,
      unitPrice: 9.27,
      total: 46.36,
    });
  });

  it('sets confidence scores for non-null fields', async () => {
    const responseJson = JSON.stringify({
      vendor: 'Bunnings',
      date: '2026-04-10',
      total: 150.0,
      currency: 'AUD',
      lineItems: [],
    });

    mockFetchSuccess(responseJson);
    const parser = new LlmReceiptParser('test-key');
    const result = await parser.parse(mockOcrResult);

    expect(result.confidence.vendor).toBe(0.9);
    expect(result.confidence.date).toBe(0.9);
    expect(result.confidence.total).toBe(0.9);
    expect(result.confidence.overall).toBeGreaterThan(0);
  });

  it('sets confidence to 0 for null fields', async () => {
    const responseJson = JSON.stringify({
      vendor: null,
      date: null,
      total: null,
      currency: 'AUD',
      lineItems: [],
    });

    mockFetchSuccess(responseJson);
    const parser = new LlmReceiptParser('test-key');
    const result = await parser.parse(mockOcrResult);

    expect(result.confidence.vendor).toBe(0.0);
    expect(result.confidence.date).toBe(0.0);
    expect(result.confidence.total).toBe(0.0);
    expect(result.confidence.overall).toBe(0.0);
  });

  it('throws HTTP error when Groq returns non-ok response', async () => {
    mockFetchHttpError(500);
    const parser = new LlmReceiptParser('test-key');

    await expect(parser.parse(mockOcrResult)).rejects.toThrow(
      'Groq LLM failed: HTTP 500',
    );
  });

  it('throws timeout error when fetch is aborted', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementationOnce(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          (options as RequestInit).signal?.addEventListener('abort', () => {
            const err = new Error('The operation was aborted.');
            err.name = 'AbortError';
            reject(err);
          });
        }),
    );

    const parser = new LlmReceiptParser('test-key', 1); // 1ms timeout
    await expect(parser.parse(mockOcrResult)).rejects.toThrow(
      /Groq LLM timed out after 1ms/,
    );
  });

  it('returns empty normalized receipt on malformed JSON', async () => {
    mockFetchSuccess('not valid json { garbage');
    const parser = new LlmReceiptParser('test-key');
    const result = await parser.parse(mockOcrResult);

    expect(result.vendor).toBeNull();
    expect(result.total).toBeNull();
    expect(result.lineItems).toHaveLength(0);
    expect(result.suggestedCorrections).toEqual([]);
  });

  it('handles missing optional fields gracefully', async () => {
    const responseJson = JSON.stringify({
      vendor: 'Bunnings',
      total: 50.0,
      currency: 'AUD',
      lineItems: [],
    });

    mockFetchSuccess(responseJson);
    const parser = new LlmReceiptParser('test-key');
    const result = await parser.parse(mockOcrResult);

    expect(result.vendor).toBe('Bunnings');
    expect(result.date).toBeNull();
    expect(result.subtotal).toBeNull();
    expect(result.tax).toBeNull();
    expect(result.paymentMethod).toBeNull();
    expect(result.receiptNumber).toBeNull();
    expect(result.notes).toBeNull();
  });

  it('defaults currency to AUD when missing', async () => {
    const responseJson = JSON.stringify({
      vendor: 'Shop',
      total: 10.0,
      lineItems: [],
    });

    mockFetchSuccess(responseJson);
    const parser = new LlmReceiptParser('test-key');
    const result = await parser.parse(mockOcrResult);

    expect(result.currency).toBe('AUD');
  });
});
