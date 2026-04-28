import { LlmQuotationParser } from '../../infrastructure/ai/LlmQuotationParser';
import { OcrResult } from '../../../../application/services/IOcrAdapter';

const mockOcrResult: OcrResult = {
  fullText: 'Quote from Builder Co\nRef: QUO-001\nTotal: $5,500.00',
  tokens: [],
  imageUri: 'file:///tmp/quote.jpg',
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

describe('LlmQuotationParser', () => {
  it('strategyType is "llm"', () => {
    const parser = new LlmQuotationParser('test-key');
    expect(parser.strategyType).toBe('llm');
  });

  it('parses a well-formed LLM JSON response', async () => {
    const responseJson = JSON.stringify({
      reference: 'QUO-001',
      vendor: 'Builder Co',
      vendorEmail: 'info@builder.co',
      vendorPhone: '0400 123 456',
      vendorAddress: '1 Main St, Sydney NSW 2000',
      taxId: '12 345 678 901',
      date: '2026-03-01',
      expiryDate: '2026-04-01',
      currency: 'AUD',
      subtotal: 5000,
      tax: 500,
      total: 5500,
      lineItems: [
        {
          description: 'Concrete Slab',
          quantity: 2,
          unit: 'm2',
          unitPrice: 2500,
          total: 5000,
          tax: 500,
        },
      ],
      paymentTerms: 'Net 30',
      scope: 'Supply and install concrete slab',
      exclusions: 'Excavation not included',
      notes: 'Valid for 30 days',
    });

    mockFetchSuccess(responseJson);
    const parser = new LlmQuotationParser('test-key');
    const result = await parser.parse(mockOcrResult);

    expect(result.reference).toBe('QUO-001');
    expect(result.vendor).toBe('Builder Co');
    expect(result.vendorEmail).toBe('info@builder.co');
    expect(result.vendorPhone).toBe('0400 123 456');
    expect(result.vendorAddress).toBe('1 Main St, Sydney NSW 2000');
    expect(result.taxId).toBe('12 345 678 901');
    expect(result.date).toEqual(new Date('2026-03-01'));
    expect(result.expiryDate).toEqual(new Date('2026-04-01'));
    expect(result.currency).toBe('AUD');
    expect(result.subtotal).toBe(5000);
    expect(result.tax).toBe(500);
    expect(result.total).toBe(5500);
    expect(result.paymentTerms).toBe('Net 30');
    expect(result.scope).toBe('Supply and install concrete slab');
    expect(result.exclusions).toBe('Excavation not included');
    expect(result.notes).toBe('Valid for 30 days');
    expect(result.lineItems).toHaveLength(1);
    expect(result.lineItems[0]).toMatchObject({
      description: 'Concrete Slab',
      quantity: 2,
      unit: 'm2',
      unitPrice: 2500,
      total: 5000,
      tax: 500,
    });
  });

  it('sets confidence scores for non-null fields', async () => {
    const responseJson = JSON.stringify({
      vendor: 'Builder Co',
      reference: 'QUO-001',
      date: '2026-03-01',
      total: 5500,
      currency: 'AUD',
      lineItems: [],
    });

    mockFetchSuccess(responseJson);
    const parser = new LlmQuotationParser('test-key');
    const result = await parser.parse(mockOcrResult);

    expect(result.confidence.vendor).toBe(0.9);
    expect(result.confidence.reference).toBe(0.9);
    expect(result.confidence.date).toBe(0.9);
    expect(result.confidence.total).toBe(0.9);
    expect(result.confidence.overall).toBeGreaterThan(0);
  });

  it('sets confidence to 0 for null fields', async () => {
    const responseJson = JSON.stringify({
      vendor: null,
      reference: null,
      date: null,
      total: null,
      currency: 'AUD',
      lineItems: [],
    });

    mockFetchSuccess(responseJson);
    const parser = new LlmQuotationParser('test-key');
    const result = await parser.parse(mockOcrResult);

    expect(result.confidence.vendor).toBe(0);
    expect(result.confidence.reference).toBe(0);
    expect(result.confidence.date).toBe(0);
    expect(result.confidence.total).toBe(0);
    expect(result.confidence.overall).toBe(0);
  });

  it('returns empty NormalizedQuotation on JSON parse failure', async () => {
    mockFetchSuccess('this is not valid JSON {{{');
    const parser = new LlmQuotationParser('test-key');
    const result = await parser.parse(mockOcrResult);

    expect(result.vendor).toBeNull();
    expect(result.reference).toBeNull();
    expect(result.total).toBeNull();
    expect(result.currency).toBe('AUD');
    expect(result.lineItems).toHaveLength(0);
    expect(result.confidence.overall).toBe(0);
    expect(result.suggestedCorrections).toHaveLength(0);
  });

  it('returns empty object content ({}) → valid empty result', async () => {
    mockFetchSuccess('{}');
    const parser = new LlmQuotationParser('test-key');
    const result = await parser.parse(mockOcrResult);

    expect(result.vendor).toBeNull();
    expect(result.currency).toBe('AUD');
    expect(result.lineItems).toHaveLength(0);
  });

  it('throws on HTTP error', async () => {
    mockFetchHttpError(429);
    const parser = new LlmQuotationParser('test-key');
    await expect(parser.parse(mockOcrResult)).rejects.toThrow('Groq LLM failed: HTTP 429');
  });

  it('throws timeout error when fetch is aborted', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementationOnce((_url: Parameters<typeof fetch>[0], _options?: RequestInit) => {
      return new Promise((_resolve, reject) => {
        // Simulate abort after a tick
        setTimeout(() => {
          const err = new Error('The operation was aborted.');
          err.name = 'AbortError';
          reject(err);
        }, 10);
      });
    });

    const parser = new LlmQuotationParser('test-key', 50);
    await expect(parser.parse(mockOcrResult)).rejects.toThrow(/timed out/i);
  });

  it('sends OCR text as user message to Groq API', async () => {
    const spy = mockFetchSuccess(JSON.stringify({ currency: 'AUD', lineItems: [] }));
    const parser = new LlmQuotationParser('sk-test-key');
    await parser.parse(mockOcrResult);

    const [url, options] = spy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');

    const body = JSON.parse(options.body as string);
    expect(body.messages[1].role).toBe('user');
    expect(body.messages[1].content).toBe(mockOcrResult.fullText);
    expect(options.headers).toMatchObject({
      Authorization: 'Bearer sk-test-key',
    });
  });
});
