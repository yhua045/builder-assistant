import { LlmVisionReceiptParser } from '../../infrastructure/LlmVisionReceiptParser';
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

describe('LlmVisionReceiptParser', () => {
  const imageUri = 'file:///tmp/receipt.jpg';

  it('strategyType is "llm-vision"', () => {
    const parser = new LlmVisionReceiptParser('test-key', makeImageReader());
    expect(parser.strategyType).toBe('llm-vision');
  });

  it('parses a well-formed vision API JSON response', async () => {
    const responseJson = JSON.stringify({
      vendor: 'Bunnings Warehouse',
      date: '2026-04-15',
      total: 220.0,
      subtotal: 200.0,
      tax: 20.0,
      currency: 'AUD',
      paymentMethod: 'card',
      receiptNumber: 'REC-001',
      lineItems: [
        { description: 'Timber', quantity: 4, unitPrice: 50.0, total: 200.0 },
      ],
      notes: null,
    });

    mockFetchSuccess(responseJson);
    const reader = makeImageReader();
    const parser = new LlmVisionReceiptParser('test-key', reader);
    const result = await parser.parse(imageUri);

    expect(result.vendor).toBe('Bunnings Warehouse');
    expect(result.date).toEqual(new Date('2026-04-15'));
    expect(result.total).toBe(220.0);
    expect(result.tax).toBe(20.0);
    expect(result.currency).toBe('AUD');
    expect(result.paymentMethod).toBe('card');
    expect(result.lineItems).toHaveLength(1);
  });

  it('calls imageReader with the imageUri', async () => {
    mockFetchSuccess(JSON.stringify({ currency: 'AUD', lineItems: [] }));
    const reader = makeImageReader('imgdata', 'image/png');
    const parser = new LlmVisionReceiptParser('test-key', reader);
    await parser.parse(imageUri);

    expect(reader.readAsBase64).toHaveBeenCalledWith(imageUri);
    expect(reader.getMimeType).toHaveBeenCalledWith(imageUri);
  });

  it('sends image as data-URI with correct MIME type in request body', async () => {
    const fetchSpy = mockFetchSuccess(JSON.stringify({ currency: 'AUD', lineItems: [] }));
    const reader = makeImageReader('xyz789', 'image/png');
    const parser = new LlmVisionReceiptParser('test-key', reader);
    await parser.parse('file:///tmp/receipt.png');

    const calledBody = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
    const imageContent = calledBody.messages[1].content[0];
    expect(imageContent.type).toBe('image_url');
    expect(imageContent.image_url.url).toBe('data:image/png;base64,xyz789');
  });

  it('returns empty NormalizedReceipt on malformed JSON', async () => {
    mockFetchSuccess('not valid JSON {{{');
    const parser = new LlmVisionReceiptParser('test-key', makeImageReader());
    const result = await parser.parse(imageUri);

    expect(result.vendor).toBeNull();
    expect(result.total).toBeNull();
    expect(result.lineItems).toEqual([]);
    expect(result.confidence.overall).toBe(0);
  });

  it('throws on HTTP error from Groq Vision API', async () => {
    mockFetchHttpError(403);
    const parser = new LlmVisionReceiptParser('test-key', makeImageReader());
    await expect(parser.parse(imageUri)).rejects.toThrow('Groq Vision API failed: HTTP 403');
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

    const parser = new LlmVisionReceiptParser('test-key', makeImageReader(), 1);
    await expect(parser.parse(imageUri)).rejects.toThrow('Groq Vision timed out after 1ms');
  });
});
