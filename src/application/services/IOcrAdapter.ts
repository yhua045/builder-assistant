export interface OcrToken {
  text: string;
  confidence: number;
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface OcrResult {
  fullText: string;
  tokens: OcrToken[];
  imageUri: string;
}

export interface IOcrAdapter {
  /**
   * Extract text from receipt image
   * @param imageUri - Local file URI or base64 image
   * @returns OCR result with full text and token positions
   */
  extractText(imageUri: string): Promise<OcrResult>;
}
