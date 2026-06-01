import { MlKitOcrAdapter } from '../../../src/infrastructure/ocr/MlKitOcrAdapter';

jest.mock('@react-native-ml-kit/text-recognition', () => ({
  recognize: jest.fn(),
}));

import TextRecognition from '@react-native-ml-kit/text-recognition';

describe('MlKitOcrAdapter', () => {
  let adapter: MlKitOcrAdapter;

  beforeEach(() => {
    adapter = new MlKitOcrAdapter();
    jest.resetAllMocks();
  });

  it('calls TextRecognition.recognize with the image URI', async () => {
    const mockResult = {
      text: 'Total $42.00',
      blocks: [
        {
          text: 'Total $42.00',
          frame: { left: 0, top: 0, width: 100, height: 20 },
          lines: [],
        },
      ],
    };
    (TextRecognition.recognize as jest.Mock).mockResolvedValue(mockResult);

    await adapter.extractText('file:///receipt.jpg');

    expect(TextRecognition.recognize).toHaveBeenCalledWith('file:///receipt.jpg');
  });

  it('maps ML Kit blocks to OcrResult shape', async () => {
    const mockResult = {
      text: 'Hello World',
      blocks: [
        {
          text: 'Hello',
          frame: { left: 0, top: 0, width: 50, height: 10 },
          lines: [
            { text: 'Hello', frame: { left: 0, top: 0, width: 50, height: 10 } },
          ],
        },
        {
          text: 'World',
          frame: { left: 0, top: 15, width: 50, height: 10 },
          lines: [],
        },
      ],
    };
    (TextRecognition.recognize as jest.Mock).mockResolvedValue(mockResult);

    const result = await adapter.extractText('file:///receipt.jpg');

    expect(result.fullText).toBe('Hello World');
    expect(result.imageUri).toBe('file:///receipt.jpg');
    expect(result.tokens.length).toBeGreaterThan(0);
    expect(result.tokens[0].text).toBe('Hello');
  });

  it('uses lines as tokens when block has lines', async () => {
    const mockResult = {
      text: 'Line1\nLine2',
      blocks: [
        {
          text: 'Line1\nLine2',
          frame: { left: 0, top: 0, width: 100, height: 30 },
          lines: [
            { text: 'Line1', frame: { left: 0, top: 0, width: 100, height: 15 } },
            { text: 'Line2', frame: { left: 0, top: 15, width: 100, height: 15 } },
          ],
        },
      ],
    };
    (TextRecognition.recognize as jest.Mock).mockResolvedValue(mockResult);

    const result = await adapter.extractText('file:///receipt.jpg');

    expect(result.tokens).toHaveLength(2);
    expect(result.tokens[0].text).toBe('Line1');
    expect(result.tokens[1].text).toBe('Line2');
  });

  it('throws with a clear message on empty imageUri', async () => {
    await expect(adapter.extractText('')).rejects.toThrow('Invalid image URI');
  });
});
