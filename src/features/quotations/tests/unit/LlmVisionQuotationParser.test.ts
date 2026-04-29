import { LlmVisionQuotationParser } from '../../infrastructure/ai/LlmVisionQuotationParser';
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

describe('LlmVisionQuotationParser', () => {
  const imageUri = 'file:///tmp/quotation.jpg';

  it('strategyType is "llm-vision"', () => {
    const parser = new LlmVisionQuotationParser('test-key', makeImageReader());
    expect(parser.strategyType).toBe('llm-vision');
  });

  it('parses a well-formed vision API JSON response', async () => {
    const responseJson = JSON.stringify({
      reference: 'QT-2026-001',
      vendor: 'Ace Roofing Co',
      vendorEmail: 'info@aceroofing.com',
      vendorPhone: null,
      vendorAddress: null,
      taxId: null,
      date: '2026-04-20',
      expiryDate: '2026-05-20',
      currency: 'AUD',
      subtotal: 5000.0,
      tax: 500.0,
      total: 5500.0,
      lineItems: [
        {
          description: 'Roof installation',
          quantity: 1,
          unit: 'job',
          unitPrice: 5000.0,
          total: 5000.0,
          tax: 500.0,
        },
      ],
      paymentTerms: '30 days',
      scope: 'Full roof replacement',
      exclusions: null,
      notes: null,
    });

    mockFetchSuccess(responseJson);
    const reader = makeImageReader();
    const parser = new LlmVisionQuotationParser('test-key', reader);
    const result = await parser.parse(imageUri);

    expect(result.reference).toBe('QT-2026-001');
    expect(result.vendor).toBe('Ace Roofing Co');
    expect(result.date).toEqual(new Date('2026-04-20'));
    expect(result.total).toBe(5500.0);
    expect(result.currency).toBe('AUD');
    expect(result.lineItems).toHaveLength(1);
    expect(result.lineItems[0].description).toBe('Roof installation');
  });

  it('calls imageReader with the imageUri', async () => {
    mockFetchSuccess(JSON.stringify({ currency: 'AUD', lineItems: [] }));
    const reader = makeImageReader('qdata', 'image/jpeg');
    const parser = new LlmVisionQuotationParser('test-key', reader);
    await parser.parse(imageUri);

    expect(reader.readAsBase64).toHaveBeenCalledWith(imageUri);
    expect(reader.getMimeType).toHaveBeenCalledWith(imageUri);
  });

  it('sends image as data-URI with correct MIME type in request body', async () => {
    const fetchSpy = mockFetchSuccess(JSON.stringify({ currency: 'AUD', lineItems: [] }));
    const reader = makeImageReader('pngdata', 'image/png');
    const parser = new LlmVisionQuotationParser('test-key', reader);
    await parser.parse('file:///tmp/quote.png');

    const calledBody = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    const imageContent = calledBody.messages[1].content[0];
    expect(imageContent.type).toBe('image_url');
    expect(imageContent.image_url.url).toBe('data:image/png;base64,pngdata');
  });

  it('returns empty NormalizedQuotation on malformed JSON', async () => {
    mockFetchSuccess('not valid JSON {{{');
    const parser = new LlmVisionQuotationParser('test-key', makeImageReader());
    const result = await parser.parse(imageUri);

    expect(result.vendor).toBeNull();
    expect(result.total).toBeNull();
    expect(result.lineItems).toEqual([]);
    expect(result.confidence.overall).toBe(0);
  });

  it('throws on HTTP error from Groq Vision API', async () => {
    mockFetchHttpError(500);
    const parser = new LlmVisionQuotationParser('test-key', makeImageReader());
    await expect(parser.parse(imageUri)).rejects.toThrow('Groq Vision API failed: HTTP 500');
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

    const parser = new LlmVisionQuotationParser('test-key', makeImageReader(), 1);
    await expect(parser.parse(imageUri)).rejects.toThrow('Groq Vision timed out after 1ms');
  });
});
