import { LlmVisionInvoiceParser } from '../../infrastructure/LlmVisionInvoiceParser';
import { IImageReader } from '../../../../application/services/IImageReader';

function makeImageReader(base64 = 'base64imagedata', mimeType = 'image/jpeg'): IImageReader {
  return {
    readAsBase64: jest.fn().mockResolvedValue(base64),
    getMimeType: jest.fn().mockReturnValue(mimeType),
  };
}

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

describe('LlmVisionInvoiceParser', () => {
  const imageUri = 'file:///tmp/invoice.jpg';

  it('strategyType is "llm-vision"', () => {
    const parser = new LlmVisionInvoiceParser('test-key', makeImageReader());
    expect(parser.strategyType).toBe('llm-vision');
  });

  it('parses a well-formed vision API JSON response', async () => {
    const responseJson = JSON.stringify({
      vendor: 'BuildRight Pty Ltd',
      invoiceNumber: 'INV-2026-042',
      invoiceDate: '2026-04-01',
      dueDate: '2026-05-01',
      subtotal: 900.0,
      tax: 90.0,
      total: 990.0,
      currency: 'AUD',
      lineItems: [
        {
          description: 'Concrete supply',
          quantity: 5,
          unitPrice: 180.0,
          total: 900.0,
          tax: 90.0,
        },
      ],
    });

    mockFetchSuccess(responseJson);
    const reader = makeImageReader();
    const parser = new LlmVisionInvoiceParser('test-key', reader);
    const result = await parser.parse(imageUri);

    expect(result.vendor).toBe('BuildRight Pty Ltd');
    expect(result.invoiceNumber).toBe('INV-2026-042');
    expect(result.invoiceDate).toEqual(new Date('2026-04-01'));
    expect(result.dueDate).toEqual(new Date('2026-05-01'));
    expect(result.subtotal).toBe(900.0);
    expect(result.tax).toBe(90.0);
    expect(result.total).toBe(990.0);
    expect(result.currency).toBe('AUD');
    expect(result.lineItems).toHaveLength(1);
    expect(result.lineItems[0]).toMatchObject({
      description: 'Concrete supply',
      quantity: 5,
      unitPrice: 180.0,
      total: 900.0,
    });
  });

  it('calls imageReader.readAsBase64 and getMimeType with the imageUri', async () => {
    mockFetchSuccess(JSON.stringify({ currency: 'AUD', lineItems: [] }));
    const reader = makeImageReader('myBase64', 'image/png');
    const parser = new LlmVisionInvoiceParser('test-key', reader);
    await parser.parse(imageUri);

    expect(reader.readAsBase64).toHaveBeenCalledWith(imageUri);
    expect(reader.getMimeType).toHaveBeenCalledWith(imageUri);
  });

  it('sends image as data-URI with correct MIME type in request body', async () => {
    const fetchSpy = mockFetchSuccess(JSON.stringify({ currency: 'AUD', lineItems: [] }));
    const reader = makeImageReader('abc123', 'image/png');
    const parser = new LlmVisionInvoiceParser('test-key', reader);
    await parser.parse('file:///tmp/invoice.png');

    const calledBody = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    const imageContent = calledBody.messages[1].content[0];
    expect(imageContent.type).toBe('image_url');
    expect(imageContent.image_url.url).toBe('data:image/png;base64,abc123');
  });

  it('returns empty NormalizedInvoice on malformed JSON response (graceful degradation)', async () => {
    mockFetchSuccess('not valid JSON {{{');
    const parser = new LlmVisionInvoiceParser('test-key', makeImageReader());
    const result = await parser.parse(imageUri);

    expect(result.vendor).toBeNull();
    expect(result.invoiceNumber).toBeNull();
    expect(result.total).toBeNull();
    expect(result.lineItems).toEqual([]);
    expect(result.confidence.overall).toBe(0);
  });

  it('throws on HTTP error from Groq Vision API', async () => {
    mockFetchHttpError(429);
    const parser = new LlmVisionInvoiceParser('test-key', makeImageReader());
    await expect(parser.parse(imageUri)).rejects.toThrow('Groq Vision API failed: HTTP 429');
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

    const parser = new LlmVisionInvoiceParser('test-key', makeImageReader(), 1);
    await expect(parser.parse(imageUri)).rejects.toThrow('Groq Vision timed out after 1ms');
  });
});
