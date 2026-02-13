import TextRecognition from '@react-native-ml-kit/text-recognition';
import { IOcrAdapter, OcrResult } from '../../application/services/IOcrAdapter';

export class MobileOcrAdapter implements IOcrAdapter {
  async extractText(imageUri: string): Promise<OcrResult> {
    if (!imageUri) {
      throw new Error('Invalid image URI');
    }

    try {
      const result = await TextRecognition.recognize(imageUri);
      
      const tokens = result.blocks.flatMap(block => {
        // If blocks have lines, use lines as tokens for better layout preservation
        if (block.lines && block.lines.length > 0) {
            return block.lines.map(line => ({
                text: line.text,
                confidence: 1.0, // ML Kit might not return confidence at line level easily
                bounds: line.frame ? {
                    x: line.frame.left ?? 0,
                    y: line.frame.top ?? 0,
                    width: line.frame.width ?? 0,
                    height: line.frame.height ?? 0
                } : undefined
            }));
        }
        // Fallback to block if no lines (unlikely with ML Kit)
        return [{
            text: block.text,
            confidence: 1.0,
            bounds: block.frame ? {
                x: block.frame.left ?? 0,
                y: block.frame.top ?? 0,
                width: block.frame.width ?? 0,
                height: block.frame.height ?? 0
            } : undefined
        }];
      });

      return {
        fullText: result.text,
        tokens: tokens,
        imageUri: imageUri
      };
    } catch (error) {
      throw error;
    }
  }
}
