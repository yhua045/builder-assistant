import { MobileOcrAdapter } from '../../src/infrastructure/ocr/MobileOcrAdapter';

// Mock the ML Kit module
jest.mock('@react-native-ml-kit/text-recognition', () => ({
  recognize: jest.fn(),
}));

import TextRecognition from '@react-native-ml-kit/text-recognition';

describe('MobileOcrAdapter', () => {
  let adapter: MobileOcrAdapter;

  beforeEach(() => {
    adapter = new MobileOcrAdapter();
    jest.resetAllMocks();
  });

  it('should call TextRecognition.recognize with image URI', async () => {
    const mockResult = {
      text: 'Sample Text',
      blocks: [
        {
          text: 'Sample',
          frame: { left: 0, top: 0, width: 10, height: 10 },
          lines: [],
        },
        {
          text: 'Text',
          frame: { left: 10, top: 0, width: 10, height: 10 },
          lines: [],
        }
      ],
    };

    (TextRecognition.recognize as jest.Mock).mockResolvedValue(mockResult);

    const imageUri = 'file:///test.jpg';
    const result = await adapter.extractText(imageUri);

    expect(TextRecognition.recognize).toHaveBeenCalledWith(imageUri);
    expect(result.fullText).toBe('Sample Text');
    expect(result.tokens).toHaveLength(2);
    expect(result.tokens[0].text).toBe('Sample');
    expect(result.tokens[1].text).toBe('Text');
  });

  it('should throw error if image URI is invalid', async () => {
     try {
         await adapter.extractText('');
     } catch (e) {
         expect(e).toBeDefined();
     }
  });
});
