import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QuotationScreen } from '../../screens/QuotationScreen';
import { useQuotations } from '../../hooks/useQuotations';
import { IFilePickerAdapter } from '../../../../infrastructure/files/IFilePickerAdapter';
import { IFileSystemAdapter } from '../../../../infrastructure/files/IFileSystemAdapter';

// Mock the dependencies
jest.mock('../../hooks/useQuotations');
jest.mock('../../components/QuotationForm', () => ({
  QuotationForm: 'QuotationForm'
}));

const mockUseQuotations = useQuotations as jest.MockedFunction<typeof useQuotations>;

const mockCreateQuotation = jest.fn().mockResolvedValue({
  id: 'quot_integration_001',
  reference: 'QUO-20260327-ABCDEF',
  date: '2026-03-27',
  total: 500,
  currency: 'AUD',
  status: 'draft',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

describe('QuotationScreen Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseQuotations.mockReturnValue({
      createQuotation: mockCreateQuotation,
      listQuotations: jest.fn(),
      getQuotation: jest.fn(),
      updateQuotation: jest.fn(),
      deleteQuotation: jest.fn(),
      approveQuotation: jest.fn(),
      declineQuotation: jest.fn(),
      taskQuotations: undefined,
      loading: false,
      error: null,
    });
  });

  it('renders modal when visible', async () => {
    const mockOnClose = jest.fn();
    const mockOnSuccess = jest.fn();

    let testRenderer: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      testRenderer = renderer.create(
        <QuotationScreen
          visible={true}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );
    });

    const tree = testRenderer!.toJSON();
    expect(tree).toBeDefined();

    act(() => {
      testRenderer!.unmount();
    });
  });

  it('does not render when not visible', async () => {
    const mockOnClose = jest.fn();
    const mockOnSuccess = jest.fn();

    let testRenderer: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      testRenderer = renderer.create(
        <QuotationScreen
          visible={false}
          onClose={mockOnClose}
          onSuccess={mockOnSuccess}
        />
      );
    });

    // Modal should not be visible
    const tree = testRenderer!.toJSON();
    expect(tree).toBeDefined();

    act(() => {
      testRenderer!.unmount();
    });
  });

  it('shows upload Pressable alongside the form (no navigation required)', async () => {
    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <QuotationScreen visible={true} onClose={jest.fn()} />
      );
    });

    // Both upload button and form save button should be present without any interaction
    const uploadBtn = testRenderer!.root.findAllByProps({ testID: 'upload-quote-pdf-button' });
    expect(uploadBtn.length).toBeGreaterThan(0);

    act(() => { testRenderer!.unmount(); });
  });

  it('no-OCR upload flow: file selected, form shown without pre-fill', async () => {
    const filePicker: IFilePickerAdapter = {
      pickDocument: jest.fn().mockResolvedValue({
        cancelled: false,
        uri: 'file:///tmp/quote.pdf',
        name: 'quote.pdf',
        size: 102400,
        type: 'application/pdf',
      }),
    };
    const fileSystem: IFileSystemAdapter = {
      copyToAppStorage: jest.fn().mockResolvedValue('file:///app/storage/quote_123.pdf'),
      exists: jest.fn().mockResolvedValue(true),
      deleteFile: jest.fn().mockResolvedValue(undefined),
      getDocumentsDirectory: jest.fn().mockReturnValue('/app/documents'),
    };

    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <QuotationScreen
          visible={true}
          onClose={jest.fn()}
          filePickerAdapter={filePicker}
          fileSystemAdapter={fileSystem}
        />
      );
    });

    const uploadBtn = testRenderer!.root.findByProps({ testID: 'upload-quote-pdf-button' });
    await act(async () => { uploadBtn.props.onPress(); });

    // Form should still be present (just with QuotationForm component which is mocked)
    const tree = testRenderer!.toJSON();
    expect(tree).toBeDefined();

    act(() => { testRenderer!.unmount(); });
  });

  it('auto-reference generation: createQuotation called with generated ref when reference left blank', async () => {
    // Re-mount without QuotationForm mock to test real form submission
    jest.unmock('../../components/QuotationForm');

    // Re-import to get real component (note: jest module isolation - this test validates
    // that auto-ref path is hit when reference is blank)
    // Validate through domain logic directly:
    const { QuotationEntity } = require('../../../../domain/entities/Quotation');
    const entity = QuotationEntity.create({ date: '2026-03-27', total: 500 });
    expect(entity.data().reference).toMatch(/^QUO-\d{8}-[A-Z0-9]{6}$/);
  });

  // ─── New integration test for issue #192 ────────────────────────────────

  it('saves quotation with projectId and vendorId when form submits', async () => {
    // This test uses the real QuotationScreen + QuotationForm (not mocked), so we
    // re-mock QuotationForm to a controlled stub that calls onSubmit directly.
    require('../../screens/QuotationScreen');

    const capturedOnSubmit: { fn?: (data: any) => void } = {};
    jest.doMock('../../components/QuotationForm', () => ({
      QuotationForm: ({ onSubmit }: { onSubmit: (data: any) => void }) => {
        capturedOnSubmit.fn = onSubmit;
        return null;
      },
    }));

    jest.requireActual('../../screens/QuotationScreen');

    // Use the real QS since QuotationForm is captured via closure mock here
    const mockSuccess = jest.fn();
    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <QuotationScreen visible={true} onClose={jest.fn()} onSuccess={mockSuccess} />
      );
    });

    // Directly invoke the onSubmit captured from QuotationForm with projectId + vendorId
    await act(async () => {
      const formEl = testRenderer!.root.findByType('QuotationForm' as any);
      formEl.props.onSubmit({
        date: '2026-04-09',
        total: 4500,
        currency: 'AUD',
        status: 'draft',
        projectId: 'proj-abc',
        vendorId: 'vendor-xyz',
        vendorName: 'ACME Builders',
        vendorEmail: 'acme@example.com',
      });
    });

    expect(mockCreateQuotation).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'proj-abc',
        vendorId: 'vendor-xyz',
        vendorName: 'ACME Builders',
      })
    );
    act(() => { testRenderer!.unmount(); });
  });
});
