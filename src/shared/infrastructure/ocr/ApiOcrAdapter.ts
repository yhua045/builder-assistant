import { PREMIUM_OCR_ENDPOINT } from '@env';
import { IOcrAdapter, OcrResult } from '../../application/ports/IOcrAdapter';
import { IAuthService } from '../../../shared/domain/services/IAuthService.ts';

/**
 * Pure translator: image URI + Bearer token → premium backend OCR → OcrResult.
 * Does NOT fall back to ML Kit on failure — that is OcrAdapterFactory's responsibility.
 */
export class ApiOcrAdapter implements IOcrAdapter {
  constructor(private readonly authService: IAuthService) {}

  async extractText(imageUri: string): Promise<OcrResult> {
    if (!imageUri) {
      throw new Error('Invalid image URI');
    }

    const token = await this.authService.getAccessToken();

    if (!PREMIUM_OCR_ENDPOINT) {
      throw new Error('PREMIUM_OCR_ENDPOINT is not configured');
    }

    const response = await fetch(PREMIUM_OCR_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ imageUri }),
    });

    if (!response.ok) {
      throw new Error(`Premium OCR request failed with status ${response.status}`);
    }

    const data = await response.json();

    return {
      fullText: data.fullText,
      tokens: data.tokens,
      imageUri,
    };
  }
}
