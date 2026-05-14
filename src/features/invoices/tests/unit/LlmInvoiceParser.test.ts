import { LlmInvoiceParser } from '../../infrastructure/LlmInvoiceParser';
import { OcrResult } from '../../../../application/services/IOcrAdapter';

const mockOcrResult: OcrResult = {
  fullText:
    'ACME Supplies Pty Ltd\nInvoice #INV-20260101\nDate: 2026-01-15\nDue: 2026-02-15\nSubtotal: $450.00\nGST: $45.00\nTotal: $495.00',
  tokens: [],
  imageUri: 'file:///tmp/invoice.jpg',
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

describe('LlmInvoiceParser', () => {
  it('strategyType is "llm"', () => {
    const parser = new LlmInvoiceParser('test-key');
    expect(parser.strategyType).toBe('llm');
  });

  it('parses a well-formed LLM JSON response', async () => {
    const responseJson = JSON.stringify({
      vendor: 'ACME Supplies Pty Ltd',
      invoiceNumber: 'INV-20260101',
      invoiceDate: '2026-01-15',
      dueDate: '2026-02-15',
      subtotal: 450.0,
      tax: 45.0,
      total: 495.0,
      currency: 'AUD',
      lineItems: [
        {
          description: 'Timber framing',
          quantity: 10,
          unitPrice: 45.0,
          total: 450.0,
        },
      ],
    });

    mockFetchSuccess(responseJson);
    const parser = new LlmInvoiceParser('test-key');
    const result = await parser.parse(mockOcrResult);

    expect(result.vendor).toBe('ACME Supplies Pty Ltd');
    expect(result.invoiceNumber).toBe('INV-20260101');
    expect(result.invoiceDate).toEqual(new Date('2026-01-15'));
    expect(result.dueDate).toEqual(new Date('2026-02-15'));
    expect(result.subtotal).toBe(450.0);
    expect(result.tax).toBe(45.0);
    expect(result.total).toBe(495.0);
    expect(result.currency).toBe('AUD');
    expect(result.lineItems).toHaveLength(1);
    expect(result.lineItems[0]).toMatchObject({
      description: 'Timber framing',
      quantity: 10,
      unitPrice: 45.0,
      total: 450.0,
    });
  });

  it('returns empty NormalizedInvoice on malformed JSON response (graceful degradation)', async () => {
    mockFetchSuccess('not valid JSON {{{');
    const parser = new LlmInvoiceParser('test-key');
    const result = await parser.parse(mockOcrResult);

    expect(result.vendor).toBeNull();
    expect(result.invoiceNumber).toBeNull();
    expect(result.total).toBeNull();
    expect(result.lineItems).toEqual([]);
    expect(result.confidence.overall).toBe(0);
  });

  it('sets confidence scores for non-null fields', async () => {
    const responseJson = JSON.stringify({
      vendor: 'ACME Supplies',
      invoiceNumber: 'INV-001',
      invoiceDate: '2026-01-15',
      total: 495.0,
      currency: 'AUD',
      lineItems: [],
    });

    mockFetchSuccess(responseJson);
    const parser = new LlmInvoiceParser('test-key');
    const result = await parser.parse(mockOcrResult);

    expect(result.confidence.vendor).toBeGreaterThan(0);
    expect(result.confidence.total).toBeGreaterThan(0);
    expect(result.confidence.overall).toBeGreaterThan(0);
  });

  it('throws on HTTP error from Groq API', async () => {
    mockFetchHttpError(401);
    const parser = new LlmInvoiceParser('test-key');
    await expect(parser.parse(mockOcrResult)).rejects.toThrow('Groq LLM failed: HTTP 401');
  });

  it('throws timeout error when request exceeds timeoutMs', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(
      (_url, opts) =>
        new Promise((_resolve, reject) => {
          if (opts?.signal) {
            opts.signal.addEventListener('abort', () =>
              reject(Object.assign(new Error('AbortError'), { name: 'AbortError' })),
            );
          }
        }),
    );

    const parser = new LlmInvoiceParser('test-key', 1);
    await expect(parser.parse(mockOcrResult)).rejects.toThrow('timed out');
  });

  it('handles null/missing fields gracefully', async () => {
    const responseJson = JSON.stringify({
      vendor: null,
      invoiceNumber: null,
      invoiceDate: null,
      dueDate: null,
      subtotal: null,
      tax: null,
      total: null,
      currency: 'AUD',
      lineItems: [],
    });

    mockFetchSuccess(responseJson);
    const parser = new LlmInvoiceParser('test-key');
    const result = await parser.parse(mockOcrResult);

    expect(result.vendor).toBeNull();
    expect(result.invoiceNumber).toBeNull();
    expect(result.invoiceDate).toBeNull();
    expect(result.dueDate).toBeNull();
    expect(result.total).toBeNull();
    expect(result.currency).toBe('AUD');
    expect(result.lineItems).toEqual([]);
  });
});
