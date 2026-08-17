import { IOcrAdapter, OcrResult } from '../../application/ports/IOcrAdapter';
import { IAuthService } from '../../../shared/domain/services/IAuthService.ts';
import { FeatureFlags } from '../config/featureFlags.ts';
import { MlKitOcrAdapter } from './MlKitOcrAdapter.ts';
import { ApiOcrAdapter } from './ApiOcrAdapter.ts';

/**
 * Selects the appropriate IOcrAdapter based on auth state and feature flag.
 * Also owns the graceful-degradation policy: API failure → ML Kit fallback.
 */
export class OcrAdapterFactory {
  constructor(
    private readonly authService: IAuthService,
    private readonly mlKitAdapter: MlKitOcrAdapter,
    private readonly apiAdapter: ApiOcrAdapter,
  ) {}

  /**
   * Returns an IOcrAdapter whose extractText() is ready to call.
   * When authenticated and premiumOcr flag is enabled, returns a wrapped
   * ApiOcrAdapter that falls back to MlKitOcrAdapter on any error.
   */
  getAdapter(): IOcrAdapter {
    if (!FeatureFlags.premiumOcr || !this.authService.isAuthenticated()) {
      return this.mlKitAdapter;
    }

    const { mlKitAdapter, apiAdapter } = this;

    // Inline degradation decorator — tries API, demotes to ML Kit on any failure.
    return {
      extractText: async (imageUri: string): Promise<OcrResult> => {
        try {
          return await apiAdapter.extractText(imageUri);
        } catch (err) {
          console.warn('[OcrAdapterFactory] API OCR failed, degrading to ML Kit:', err);
          return mlKitAdapter.extractText(imageUri);
        }
      },
    };
  }
}
