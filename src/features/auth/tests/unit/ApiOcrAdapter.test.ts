import { ApiOcrAdapter } from '../../../../shared/infrastructure/ocr/ApiOcrAdapter';
import { IAuthService } from '../../../../shared/domain/services/IAuthService';

function makeAuthService(token = 'bearer-token'): IAuthService {
  return {
    login: jest.fn(),
    logout: jest.fn(),
    getAuthState: jest.fn(),
    getAccessToken: jest.fn().mockResolvedValue(token),
    isAuthenticated: jest.fn().mockReturnValue(true),
  };
}

describe('ApiOcrAdapter — pure HTTP translator', () => {
  let fetchMock: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    fetchMock = jest.fn() as unknown as jest.MockedFunction<typeof fetch>;
    global.fetch = fetchMock;
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('calls IAuthService.getAccessToken() once per request', async () => {
    const authService = makeAuthService('my-token');
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ fullText: 'Receipt text', tokens: [] }),
    } as Response);

    const adapter = new ApiOcrAdapter(authService);
    await adapter.extractText('file:///receipt.jpg');

    expect(authService.getAccessToken).toHaveBeenCalledTimes(1);
  });

  it('sends Bearer token in Authorization header', async () => {
    const authService = makeAuthService('my-token');
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ fullText: '', tokens: [] }),
    } as Response);

    const adapter = new ApiOcrAdapter(authService);
    await adapter.extractText('file:///receipt.jpg');

    // URL comes from @env (PREMIUM_OCR_ENDPOINT) — assert on the second arg only
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, requestInit] = fetchMock.mock.calls[0];
    expect((requestInit as RequestInit).headers).toMatchObject({
      Authorization: 'Bearer my-token',
    });
  });

  it('maps backend JSON response to OcrResult domain shape', async () => {
    const tokens = [{ text: 'Total', confidence: 0.99 }];
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ fullText: 'Total $10', tokens }),
    } as Response);

    const adapter = new ApiOcrAdapter(makeAuthService());
    const result = await adapter.extractText('file:///receipt.jpg');

    expect(result.fullText).toBe('Total $10');
    expect(result.tokens).toEqual(tokens);
    expect(result.imageUri).toBe('file:///receipt.jpg');
  });

  it('throws on non-OK HTTP response and does NOT fall back internally', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 } as Response);

    const adapter = new ApiOcrAdapter(makeAuthService());
    await expect(adapter.extractText('file:///receipt.jpg')).rejects.toThrow(
      'Premium OCR request failed with status 503',
    );
  });

  it('throws when imageUri is empty — never reaches network', async () => {
    const adapter = new ApiOcrAdapter(makeAuthService());
    await expect(adapter.extractText('')).rejects.toThrow('Invalid image URI');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('propagates network errors without any internal fallback', async () => {
    fetchMock.mockRejectedValue(new Error('Network unreachable'));

    const adapter = new ApiOcrAdapter(makeAuthService());
    await expect(adapter.extractText('file:///receipt.jpg')).rejects.toThrow(
      'Network unreachable',
    );
  });
});
