// Must mock featureFlags before importing OcrAdapterFactory
jest.mock('../../../../infrastructure/config/featureFlags', () => ({
  FeatureFlags: { premiumOcr: false },
}));

// Mock native ML Kit to prevent native module errors
jest.mock('@react-native-ml-kit/text-recognition', () => ({ recognize: jest.fn() }));

import { OcrAdapterFactory } from '../../../../infrastructure/ocr/OcrAdapterFactory';
import { MlKitOcrAdapter } from '../../../../infrastructure/ocr/MlKitOcrAdapter';
import { ApiOcrAdapter } from '../../../../infrastructure/ocr/ApiOcrAdapter';
import { IAuthService } from '../../../../domain/services/IAuthService';
import { OcrResult } from '../../../../application/services/IOcrAdapter';
import { FeatureFlags } from '../../../../infrastructure/config/featureFlags';

const mlKitResult: OcrResult = { fullText: 'ML Kit result', tokens: [], imageUri: 'uri' };
const apiResult: OcrResult = { fullText: 'API result', tokens: [], imageUri: 'uri' };

function makeAuthService(authenticated: boolean): IAuthService {
  return {
    login: jest.fn(),
    logout: jest.fn(),
    getAuthState: jest.fn(),
    getAccessToken: jest.fn().mockResolvedValue('tok'),
    isAuthenticated: jest.fn().mockReturnValue(authenticated),
  };
}

function makeMlKitAdapter(): MlKitOcrAdapter {
  const adapter = Object.create(MlKitOcrAdapter.prototype) as MlKitOcrAdapter;
  adapter.extractText = jest.fn().mockResolvedValue(mlKitResult);
  return adapter;
}

function makeApiAdapter(_authService: IAuthService): ApiOcrAdapter {
  const adapter = Object.create(ApiOcrAdapter.prototype) as ApiOcrAdapter;
  adapter.extractText = jest.fn().mockResolvedValue(apiResult);
  return adapter;
}

describe('OcrAdapterFactory — routing + degradation policy', () => {
  beforeEach(() => {
    // Reset flag to default (off) before each test
    (FeatureFlags as { premiumOcr: boolean }).premiumOcr = false;
  });

  it('returns MlKitAdapter when user is unauthenticated (flag irrelevant)', async () => {
    const authService = makeAuthService(false);
    const mlKit = makeMlKitAdapter();
    const api = makeApiAdapter(authService);
    const factory = new OcrAdapterFactory(authService, mlKit, api);

    const result = await factory.getAdapter().extractText('file:///img.jpg');

    expect(result.fullText).toBe('ML Kit result');
    expect(mlKit.extractText).toHaveBeenCalledWith('file:///img.jpg');
    expect(api.extractText).not.toHaveBeenCalled();
  });

  it('returns MlKitAdapter when authenticated but premiumOcr flag is off', async () => {
    (FeatureFlags as { premiumOcr: boolean }).premiumOcr = false;
    const authService = makeAuthService(true);
    const mlKit = makeMlKitAdapter();
    const api = makeApiAdapter(authService);
    const factory = new OcrAdapterFactory(authService, mlKit, api);

    const result = await factory.getAdapter().extractText('file:///img.jpg');

    expect(result.fullText).toBe('ML Kit result');
    expect(api.extractText).not.toHaveBeenCalled();
  });

  it('routes to ApiAdapter when authenticated AND premiumOcr flag is on', async () => {
    (FeatureFlags as { premiumOcr: boolean }).premiumOcr = true;
    const authService = makeAuthService(true);
    const mlKit = makeMlKitAdapter();
    const api = makeApiAdapter(authService);
    const factory = new OcrAdapterFactory(authService, mlKit, api);

    const result = await factory.getAdapter().extractText('file:///img.jpg');

    expect(result.fullText).toBe('API result');
    expect(api.extractText).toHaveBeenCalledWith('file:///img.jpg');
    expect(mlKit.extractText).not.toHaveBeenCalled();
  });

  it('degrades to MlKit when ApiAdapter throws (graceful degradation policy)', async () => {
    (FeatureFlags as { premiumOcr: boolean }).premiumOcr = true;
    const authService = makeAuthService(true);
    const mlKit = makeMlKitAdapter();
    const api = makeApiAdapter(authService);
    (api.extractText as jest.Mock).mockRejectedValue(new Error('API down'));
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const factory = new OcrAdapterFactory(authService, mlKit, api);

    const result = await factory.getAdapter().extractText('file:///img.jpg');

    expect(result.fullText).toBe('ML Kit result');
    expect(mlKit.extractText).toHaveBeenCalledWith('file:///img.jpg');
    expect(warnSpy).toHaveBeenCalledWith(
      '[OcrAdapterFactory] API OCR failed, degrading to ML Kit:',
      expect.any(Error),
    );
    warnSpy.mockRestore();
  });
});
