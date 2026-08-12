import { OcrAdapterFactory } from '../../../src/infrastructure/ocr/OcrAdapterFactory';
import { MlKitOcrAdapter } from '../../../src/infrastructure/ocr/MlKitOcrAdapter';
import { ApiOcrAdapter } from '../../../src/infrastructure/ocr/ApiOcrAdapter';
import { IAuthService } from '../../../src/domain/services/IAuthService';
import { AuthState } from '../../../src/domain/entities/AuthUser';
import { OcrResult } from '../../../src/application/services/IOcrAdapter';

// Control FeatureFlags.premiumOcr in tests
jest.mock('../../../src/infrastructure/config/featureFlags', () => ({
  FeatureFlags: { premiumOcr: true },
}));

function makeStubAuthService(authenticated: boolean): IAuthService {
  return {
    login: jest.fn(),
    logout: jest.fn(),
    getAuthState: jest.fn().mockResolvedValue({ status: 'anonymous' } as AuthState),
    getAccessToken: jest.fn().mockResolvedValue('token'),
    isAuthenticated: jest.fn().mockReturnValue(authenticated),
  };
}

const mlKitResult: OcrResult = {
  fullText: 'ML Kit result',
  tokens: [{ text: 'ML Kit result', confidence: 1 }],
  imageUri: 'file:///img.jpg',
};

const apiResult: OcrResult = {
  fullText: 'API result',
  tokens: [{ text: 'API result', confidence: 0.99 }],
  imageUri: 'file:///img.jpg',
};

describe('OcrAdapterFactory', () => {
  describe('when user is NOT authenticated', () => {
    it('returns the MlKitOcrAdapter path', async () => {
      const authService = makeStubAuthService(false);
      const mlKit = { extractText: jest.fn().mockResolvedValue(mlKitResult) } as unknown as MlKitOcrAdapter;
      const api = { extractText: jest.fn().mockResolvedValue(apiResult) } as unknown as ApiOcrAdapter;
      const factory = new OcrAdapterFactory(authService, mlKit, api);

      const result = await factory.getAdapter().extractText('file:///img.jpg');

      expect(mlKit.extractText).toHaveBeenCalledTimes(1);
      expect(api.extractText).not.toHaveBeenCalled();
      expect(result.fullText).toBe('ML Kit result');
    });
  });

  describe('when user IS authenticated and premiumOcr flag is ON', () => {
    it('returns the ApiOcrAdapter path', async () => {
      const authService = makeStubAuthService(true);
      const mlKit = { extractText: jest.fn().mockResolvedValue(mlKitResult) } as unknown as MlKitOcrAdapter;
      const api = { extractText: jest.fn().mockResolvedValue(apiResult) } as unknown as ApiOcrAdapter;
      const factory = new OcrAdapterFactory(authService, mlKit, api);

      const result = await factory.getAdapter().extractText('file:///img.jpg');

      expect(api.extractText).toHaveBeenCalledTimes(1);
      expect(result.fullText).toBe('API result');
    });

    it('degrades to MlKitOcrAdapter when ApiOcrAdapter throws', async () => {
      const authService = makeStubAuthService(true);
      const mlKit = { extractText: jest.fn().mockResolvedValue(mlKitResult) } as unknown as MlKitOcrAdapter;
      const api = {
        extractText: jest.fn().mockRejectedValue(new Error('Network error')),
      } as unknown as ApiOcrAdapter;
      const factory = new OcrAdapterFactory(authService, mlKit, api);

      const result = await factory.getAdapter().extractText('file:///img.jpg');

      expect(api.extractText).toHaveBeenCalledTimes(1);
      expect(mlKit.extractText).toHaveBeenCalledTimes(1);
      expect(result.fullText).toBe('ML Kit result');
    });
  });

  describe('when premiumOcr flag is OFF', () => {
    it('falls back to MlKitOcrAdapter even when authenticated', async () => {
      // Mutate the already-mocked FeatureFlags object for this test only
      const { FeatureFlags } = require('../../../src/infrastructure/config/featureFlags');
      const original = FeatureFlags.premiumOcr;
      FeatureFlags.premiumOcr = false;

      try {
        const authService = makeStubAuthService(true);
        const mlKit = { extractText: jest.fn().mockResolvedValue(mlKitResult) } as unknown as MlKitOcrAdapter;
        const api = { extractText: jest.fn().mockResolvedValue(apiResult) } as unknown as ApiOcrAdapter;
        const factory = new OcrAdapterFactory(authService, mlKit, api);

        const result = await factory.getAdapter().extractText('file:///img.jpg');

        expect(mlKit.extractText).toHaveBeenCalledTimes(1);
        expect(api.extractText).not.toHaveBeenCalled();
        expect(result.fullText).toBe('ML Kit result');
      } finally {
        FeatureFlags.premiumOcr = original;
      }
    });
  });
});
