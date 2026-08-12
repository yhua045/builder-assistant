import { ApiOcrAdapter } from '../../../src/infrastructure/ocr/ApiOcrAdapter';
import { IAuthService } from '../../../src/domain/services/IAuthService';
import { AuthState } from '../../../src/domain/entities/AuthUser';

// Silence network in tests
global.fetch = jest.fn();

function makeStubAuthService(overrides: Partial<IAuthService> = {}): IAuthService {
  return {
    login: jest.fn(),
    logout: jest.fn(),
    getAuthState: jest.fn().mockResolvedValue({ status: 'anonymous' } as AuthState),
    getAccessToken: jest.fn().mockResolvedValue('bearer-token-abc'),
    isAuthenticated: jest.fn().mockReturnValue(true),
    ...overrides,
  };
}

const mockOcrApiResponse = {
  fullText: 'Woolworths\nTotal $87.50',
  tokens: [
    { text: 'Woolworths', confidence: 0.98, bounds: { x: 0, y: 0, width: 200, height: 20 } },
    { text: 'Total $87.50', confidence: 0.99, bounds: { x: 0, y: 25, width: 200, height: 20 } },
  ],
  imageUri: 'file:///receipt.jpg',
};

describe('ApiOcrAdapter', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: jest.fn().mockResolvedValue(mockOcrApiResponse),
    });
  });

  it('calls IAuthService.getAccessToken() before making a request', async () => {
    const authService = makeStubAuthService();
    const adapter = new ApiOcrAdapter(authService);

    await adapter.extractText('file:///receipt.jpg');

    expect(authService.getAccessToken).toHaveBeenCalledTimes(1);
  });

  it('sends a POST request with Authorization Bearer header', async () => {
    const authService = makeStubAuthService();
    const adapter = new ApiOcrAdapter(authService);

    await adapter.extractText('file:///receipt.jpg');

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(options.method).toBe('POST');
    expect(options.headers['Authorization']).toBe('Bearer bearer-token-abc');
  });

  it('maps API response to OcrResult domain shape', async () => {
    const authService = makeStubAuthService();
    const adapter = new ApiOcrAdapter(authService);

    const result = await adapter.extractText('file:///receipt.jpg');

    expect(result.fullText).toBe('Woolworths\nTotal $87.50');
    expect(result.imageUri).toBe('file:///receipt.jpg');
    expect(result.tokens).toHaveLength(2);
  });

  it('throws on HTTP error — does NOT fall back internally', async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 503 });
    const authService = makeStubAuthService();
    const adapter = new ApiOcrAdapter(authService);

    await expect(adapter.extractText('file:///receipt.jpg')).rejects.toThrow(/503/);
  });

  it('throws on network failure — does NOT fall back internally', async () => {
    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network request failed'));
    const authService = makeStubAuthService();
    const adapter = new ApiOcrAdapter(authService);

    await expect(adapter.extractText('file:///receipt.jpg')).rejects.toThrow('Network request failed');
  });

  it('throws with a clear message on empty imageUri', async () => {
    const authService = makeStubAuthService();
    const adapter = new ApiOcrAdapter(authService);

    await expect(adapter.extractText('')).rejects.toThrow('Invalid image URI');
  });
});
