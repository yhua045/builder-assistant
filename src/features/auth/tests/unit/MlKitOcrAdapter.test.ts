// Mock ML Kit before importing the adapter
jest.mock('@react-native-ml-kit/text-recognition', () => ({
  recognize: jest.fn(),
}));

import TextRecognition from '@react-native-ml-kit/text-recognition';
import { MlKitOcrAdapter } from '../../../../infrastructure/ocr/MlKitOcrAdapter';

describe('MlKitOcrAdapter — pure ML Kit translator', () => {
  let adapter: MlKitOcrAdapter;

  beforeEach(() => {
    adapter = new MlKitOcrAdapter();
    jest.resetAllMocks();
  });

  it('passes imageUri to TextRecognition.recognize', async () => {
    (TextRecognition.recognize as jest.Mock).mockResolvedValue({
      text: 'Hello',
      blocks: [{ text: 'Hello', frame: null, lines: [] }],
    });

    await adapter.extractText('file:///receipt.jpg');

    expect(TextRecognition.recognize).toHaveBeenCalledWith('file:///receipt.jpg');
  });

  it('maps line-level tokens when block has lines', async () => {
    (TextRecognition.recognize as jest.Mock).mockResolvedValue({
      text: 'Total $42.50',
      blocks: [
        {
          text: 'Total $42.50',
          frame: { left: 0, top: 0, width: 120, height: 20 },
          lines: [
            {
              text: 'Total $42.50',
              frame: { left: 0, top: 0, width: 120, height: 20 },
            },
          ],
        },
      ],
    });

    const result = await adapter.extractText('file:///receipt.jpg');

    expect(result.fullText).toBe('Total $42.50');
    expect(result.tokens).toHaveLength(1);
    expect(result.tokens[0]).toMatchObject({
      text: 'Total $42.50',
      confidence: 1.0,
      bounds: { x: 0, y: 0, width: 120, height: 20 },
    });
    expect(result.imageUri).toBe('file:///receipt.jpg');
  });

  it('maps block-level tokens when block has no lines', async () => {
    (TextRecognition.recognize as jest.Mock).mockResolvedValue({
      text: 'RECEIPT',
      blocks: [
        {
          text: 'RECEIPT',
          frame: { left: 5, top: 10, width: 80, height: 15 },
          lines: [],
        },
      ],
    });

    const result = await adapter.extractText('file:///receipt.jpg');

    expect(result.tokens).toHaveLength(1);
    expect(result.tokens[0]).toMatchObject({
      text: 'RECEIPT',
      confidence: 1.0,
      bounds: { x: 5, y: 10, width: 80, height: 15 },
    });
  });

  it('handles null frame gracefully (sets bounds to undefined)', async () => {
    (TextRecognition.recognize as jest.Mock).mockResolvedValue({
      text: 'Text',
      blocks: [{ text: 'Text', frame: null, lines: [] }],
    });

    const result = await adapter.extractText('file:///receipt.jpg');

    expect(result.tokens[0].bounds).toBeUndefined();
  });

  it('throws when imageUri is empty — no auth dependency required', async () => {
    await expect(adapter.extractText('')).rejects.toThrow('Invalid image URI');
    expect(TextRecognition.recognize).not.toHaveBeenCalled();
  });
});
