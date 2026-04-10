/**
 * Unit tests for MobileFilePickerAdapter — Issue #203 (Req 2)
 * Verifies that pickDocument accepts images in addition to PDFs.
 */

import { MobileFilePickerAdapter } from '../../src/infrastructure/files/MobileFilePickerAdapter';

// ─── Mock react-native-document-picker ────────────────────────────────────────

const mockPick = jest.fn();
const mockIsCancel = jest.fn().mockReturnValue(false);

jest.mock('react-native-document-picker', () => ({
  __esModule: true,
  default: {
    pick: (...args: any[]) => mockPick(...args),
    isCancel: (...args: any[]) => mockIsCancel(...args),
    types: {
      pdf: 'public.adobe.pdf',
      images: 'public.image',
    },
  },
}));

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('MobileFilePickerAdapter.pickDocument', () => {
  let adapter: MobileFilePickerAdapter;

  beforeEach(() => {
    adapter = new MobileFilePickerAdapter();
    jest.clearAllMocks();
  });

  it('calls DocumentPicker.pick with both pdf and images types', async () => {
    mockPick.mockResolvedValueOnce([
      {
        uri: 'file:///tmp/doc.pdf',
        fileCopyUri: 'file:///tmp/copy.pdf',
        name: 'doc.pdf',
        size: 1024,
        type: 'application/pdf',
      },
    ]);

    await adapter.pickDocument();

    expect(mockPick).toHaveBeenCalledWith(
      expect.objectContaining({
        type: expect.arrayContaining(['public.adobe.pdf', 'public.image']),
      }),
    );
  });

  it('returns a valid result with uri and name when a file is picked', async () => {
    mockPick.mockResolvedValueOnce([
      {
        uri: 'file:///tmp/img.jpg',
        fileCopyUri: 'file:///tmp/copy.jpg',
        name: 'img.jpg',
        size: 2048,
        type: 'image/jpeg',
      },
    ]);

    const result = await adapter.pickDocument();

    expect(result.cancelled).toBe(false);
    expect(result.uri).toBe('file:///tmp/copy.jpg');
    expect(result.name).toBe('img.jpg');
  });

  it('returns { cancelled: true } when the user cancels', async () => {
    const cancelError = new Error('cancel');
    mockIsCancel.mockReturnValueOnce(true);
    mockPick.mockRejectedValueOnce(cancelError);

    const result = await adapter.pickDocument();

    expect(result.cancelled).toBe(true);
  });

  it('re-throws non-cancel errors', async () => {
    const networkError = new Error('network failure');
    mockIsCancel.mockReturnValueOnce(false);
    mockPick.mockRejectedValueOnce(networkError);

    await expect(adapter.pickDocument()).rejects.toThrow('network failure');
  });
});
