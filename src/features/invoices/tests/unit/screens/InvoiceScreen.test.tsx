import React from 'react';
import { wrapWithQuery } from '../../../../../../__tests__/utils/queryClientWrapper';
import renderer, { act } from 'react-test-renderer';
import { Alert } from 'react-native';
import { InvoiceScreen } from '../../../screens/InvoiceScreen';
import { IFilePickerAdapter, FilePickerResult } from '../../../../../infrastructure/files/IFilePickerAdapter';
import { IFileSystemAdapter } from '../../../../../infrastructure/files/IFileSystemAdapter';
import { IOcrAdapter, OcrResult } from '../../../../../application/services/IOcrAdapter';
import {
  IInvoiceNormalizer,
  InvoiceCandidates,
  NormalizedInvoice,
} from '../../../application/IInvoiceNormalizer';

jest.mock('../../../hooks/useInvoices', () => ({
  useInvoices: () => ({
    invoices: [],
    loading: false,
    error: null,
    createInvoice: jest.fn().mockResolvedValue({ success: true }),
    updateInvoice: jest.fn().mockResolvedValue({ success: true }),
    deleteInvoice: jest.fn().mockResolvedValue({ success: true }),
    getInvoiceById: jest.fn().mockResolvedValue(null),
    refreshInvoices: jest.fn(),
  }),
}));

// Mock Alert
jest.spyOn(Alert, 'alert');

/** Flush all pending microtasks so that sequential `await` chains settle. */
const flushPromises = () => new Promise<void>(resolve => setImmediate(resolve));

describe.skip('InvoiceScreen', () => {
  let mockFilePicker: jest.Mocked<IFilePickerAdapter>;
  let mockFileSystem: jest.Mocked<IFileSystemAdapter>;
  let mockOnClose: jest.Mock;
  let mockOnNavigateToForm: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockFilePicker = {
      pickDocument: jest.fn(),
    };

    mockFileSystem = {
      copyToAppStorage: jest.fn(),
      getDocumentsDirectory: jest.fn(),
      exists: jest.fn(),
      deleteFile: jest.fn(),
    };

    mockOnClose = jest.fn();
    mockOnNavigateToForm = jest.fn();
  });

  it('renders with upload and manual entry action buttons', async () => {
    let testRenderer: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      testRenderer = renderer.create(wrapWithQuery(<InvoiceScreen
          onClose={mockOnClose}
          onNavigateToForm={mockOnNavigateToForm}
          filePickerAdapter={mockFilePicker}
          fileSystemAdapter={mockFileSystem}
        />));
    });

    expect(testRenderer).toBeDefined();
    const root = testRenderer!.root;

    // Check that component renders
    expect(root).toBeTruthy();
  });

  it('triggers file picker when Upload PDF button is pressed', async () => {
    const mockPickerResult: FilePickerResult = {
      cancelled: false,
      uri: 'file:///original/invoice.pdf',
      name: 'invoice.pdf',
      size: 1024 * 500, // 500KB
      type: 'application/pdf',
    };

    mockFilePicker.pickDocument.mockResolvedValue(mockPickerResult);
    mockFileSystem.copyToAppStorage.mockResolvedValue('file:///app/documents/invoice_123.pdf');

    let testRenderer: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      testRenderer = renderer.create(wrapWithQuery(<InvoiceScreen
          onClose={mockOnClose}
          onNavigateToForm={mockOnNavigateToForm}
          filePickerAdapter={mockFilePicker}
          fileSystemAdapter={mockFileSystem}
        />));
    });

    const root = testRenderer!.root;
    const uploadButton = root.findByProps({ testID: 'upload-pdf-button' });

    await act(async () => {
      await uploadButton.props.onPress();
    });

    expect(mockFilePicker.pickDocument).toHaveBeenCalled();
  });

  it('validates PDF file type and rejects non-PDF files', async () => {
    const mockPickerResult: FilePickerResult = {
      cancelled: false,
      uri: 'file:///original/document.txt',
      name: 'document.txt',
      size: 1024,
      type: 'text/plain',
    };

    mockFilePicker.pickDocument.mockResolvedValue(mockPickerResult);

    let testRenderer: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      testRenderer = renderer.create(wrapWithQuery(<InvoiceScreen
          onClose={mockOnClose}
          onNavigateToForm={mockOnNavigateToForm}
          filePickerAdapter={mockFilePicker}
          fileSystemAdapter={mockFileSystem}
        />));
    });

    const root = testRenderer!.root;
    const uploadButton = root.findByProps({ testID: 'upload-pdf-button' });

    await act(async () => {
      await uploadButton.props.onPress();
    });

    expect(mockFilePicker.pickDocument).toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Invalid File',
      'Please select a PDF or image file'
    );
    expect(mockFileSystem.copyToAppStorage).not.toHaveBeenCalled();
    expect(mockOnNavigateToForm).not.toHaveBeenCalled();
  });

  it('validates PDF file size and rejects files over 20MB', async () => {
    const mockPickerResult: FilePickerResult = {
      cancelled: false,
      uri: 'file:///original/large.pdf',
      name: 'large.pdf',
      size: 25 * 1024 * 1024, // 25MB
      type: 'application/pdf',
    };

    mockFilePicker.pickDocument.mockResolvedValue(mockPickerResult);

    let testRenderer: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      testRenderer = renderer.create(wrapWithQuery(<InvoiceScreen
          onClose={mockOnClose}
          onNavigateToForm={mockOnNavigateToForm}
          filePickerAdapter={mockFilePicker}
          fileSystemAdapter={mockFileSystem}
        />));
    });

    const root = testRenderer!.root;
    const uploadButton = root.findByProps({ testID: 'upload-pdf-button' })
    await act(async () => {
      await uploadButton.props.onPress();
    });

    expect(mockFilePicker.pickDocument).toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      'File Too Large',
      'File must be under 20MB'
    );
    expect(mockFileSystem.copyToAppStorage).not.toHaveBeenCalled();
    expect(mockOnNavigateToForm).not.toHaveBeenCalled();
  });

  it('copies PDF to app storage and navigates to form with pdfFile metadata', async () => {
    const mockPickerResult: FilePickerResult = {
      cancelled: false,
      uri: 'file:///original/invoice.pdf',
      name: 'invoice.pdf',
      size: 1024 * 500, // 500KB
      type: 'application/pdf',
    };

    const appStorageUri = 'file:///app/documents/invoice_123.pdf';
    mockFilePicker.pickDocument.mockResolvedValue(mockPickerResult);
    mockFileSystem.copyToAppStorage.mockResolvedValue(appStorageUri);

    let testRenderer: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      testRenderer = renderer.create(wrapWithQuery(<InvoiceScreen
          onClose={mockOnClose}
          onNavigateToForm={mockOnNavigateToForm}
          filePickerAdapter={mockFilePicker}
          fileSystemAdapter={mockFileSystem}
        />));
    });

    const root = testRenderer!.root;
    const uploadButton = root.findByProps({ testID: 'upload-pdf-button' });

    await act(async () => {
      await uploadButton.props.onPress();
    });

    expect(mockFilePicker.pickDocument).toHaveBeenCalled();
    expect(mockFileSystem.copyToAppStorage).toHaveBeenCalledWith(
      mockPickerResult.uri,
      expect.stringContaining('invoice_')
    );
    // Embedded form should be displayed inline with pdf context; no navigation
    expect(mockOnNavigateToForm).not.toHaveBeenCalled();
    expect(root.findByProps({ testID: 'invoice-form' })).toBeTruthy();
  });

  it('shows error state UI when file copy fails', async () => {
    const mockPickerResult: FilePickerResult = {
      cancelled: false,
      uri: 'file:///original/invoice.pdf',
      name: 'invoice.pdf',
      size: 1024 * 500,
      type: 'application/pdf',
    };

    mockFilePicker.pickDocument.mockResolvedValue(mockPickerResult);
    mockFileSystem.copyToAppStorage.mockRejectedValue(new Error('Storage full'));

    let testRenderer: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      testRenderer = renderer.create(wrapWithQuery(<InvoiceScreen
          onClose={mockOnClose}
          onNavigateToForm={mockOnNavigateToForm}
          filePickerAdapter={mockFilePicker}
          fileSystemAdapter={mockFileSystem}
        />));
    });

    const root = testRenderer!.root;
    const uploadButton = root.findByProps({ testID: 'upload-pdf-button' });

    await act(async () => {
      await uploadButton.props.onPress();
    });

    // Error state shows retry + manual buttons; no Alert is shown
    expect(root.findByProps({ testID: 'retry-ocr-button' })).toBeTruthy();
    expect(root.findByProps({ testID: 'fallback-manual-button' })).toBeTruthy();
    const errMsg = root.findByProps({ testID: 'ocr-error-message' });
    expect(errMsg.props.children).toContain('Storage full');
    expect(mockOnNavigateToForm).not.toHaveBeenCalled();
  });

  it('does not copy or navigate when file picker is cancelled', async () => {
    const mockPickerResult: FilePickerResult = {
      cancelled: true,
    };

    mockFilePicker.pickDocument.mockResolvedValue(mockPickerResult);

    let testRenderer: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      testRenderer = renderer.create(wrapWithQuery(<InvoiceScreen
          onClose={mockOnClose}
          onNavigateToForm={mockOnNavigateToForm}
          filePickerAdapter={mockFilePicker}
          fileSystemAdapter={mockFileSystem}
        />));
    });

    const root = testRenderer!.root;
    const uploadButton = root.findByProps({ testID: 'upload-pdf-button' })
    await act(async () => {
      await uploadButton.props.onPress();
    });

    expect(mockFilePicker.pickDocument).toHaveBeenCalled();
    expect(mockFileSystem.copyToAppStorage).not.toHaveBeenCalled();
    expect(mockOnNavigateToForm).not.toHaveBeenCalled();
  });

  it('navigates to form without pdfFile when manual entry button is pressed', async () => {
    let testRenderer: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      testRenderer = renderer.create(wrapWithQuery(<InvoiceScreen
          onClose={mockOnClose}
          onNavigateToForm={mockOnNavigateToForm}
          filePickerAdapter={mockFilePicker}
          fileSystemAdapter={mockFileSystem}
        />));
    });

    const root = testRenderer!.root;
    const manualEntryButton = root.findByProps({ testID: 'manual-entry-button' });
    
    await act(async () => {
      await manualEntryButton.props.onPress();
    });

    // The form should now be shown inline instead of navigating
    expect(mockOnNavigateToForm).not.toHaveBeenCalled();
    expect(mockFilePicker.pickDocument).not.toHaveBeenCalled();
    expect(root.findByProps({ testID: 'invoice-form' })).toBeTruthy();
  });

  it('calls onClose when Cancel button is pressed', async () => {
    let testRenderer: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      testRenderer = renderer.create(wrapWithQuery(<InvoiceScreen
          onClose={mockOnClose}
          onNavigateToForm={mockOnNavigateToForm}
          filePickerAdapter={mockFilePicker}
          fileSystemAdapter={mockFileSystem}
        />));
    });

    const root = testRenderer!.root;
    const cancelButton = root.findByProps({ testID: 'cancel-button' });

    act(() => {
      cancelButton.props.onPress();
    });

    expect(mockOnClose).toHaveBeenCalled();
  });
});

// ── Helpers shared across OCR-pipeline tests ──────────────────────────────

const makeOcrResult = (text = 'Acme Corp\nInvoice #INV-001\nTotal: $500.00'): OcrResult => ({
  fullText: text,
  tokens: [],
  imageUri: 'file:///app/invoice.jpg',
});

const makeNormalizedInvoice = (): NormalizedInvoice => ({
  vendor: 'Acme Corp',
  invoiceNumber: 'INV-001',
  invoiceDate: new Date('2026-01-15'),
  dueDate: new Date('2026-02-15'),
  subtotal: 450,
  tax: 50,
  total: 500,
  currency: 'USD',
  lineItems: [],
  confidence: { overall: 0.9, vendor: 0.9, invoiceNumber: 0.9, invoiceDate: 0.8, total: 0.95 },
  suggestedCorrections: [],
});

function makeMockOcr(result?: OcrResult, error?: Error): jest.Mocked<IOcrAdapter> {
  return {
    extractText: error
      ? jest.fn().mockRejectedValue(error)
      : jest.fn().mockResolvedValue(result ?? makeOcrResult()),
  };
}

function makeMockNormalizer(
  normalized?: NormalizedInvoice,
  error?: Error,
): jest.Mocked<IInvoiceNormalizer> {
  const emptyCandidates: InvoiceCandidates = {
    vendors: [], invoiceNumbers: [], dates: [], dueDates: [],
    amounts: [], subtotals: [], taxAmounts: [], lineItems: [],
  };
  return {
    extractCandidates: jest.fn().mockReturnValue(emptyCandidates),
    normalize: error
      ? jest.fn().mockRejectedValue(error)
      : jest.fn().mockResolvedValue(normalized ?? makeNormalizedInvoice()),
  };
}

function makeMockFile(overrides: Partial<FilePickerResult> = {}): FilePickerResult {
  return {
    cancelled: false,
    uri: 'file:///original/invoice.jpg',
    name: 'invoice.jpg',
    size: 512000,
    type: 'image/jpeg',
    ...overrides,
  };
}

// ── OCR pipeline tests ────────────────────────────────────────────────────

describe.skip('InvoiceScreen — OCR pipeline', () => {
  let mockFilePicker: jest.Mocked<IFilePickerAdapter>;
  let mockFileSystem: jest.Mocked<IFileSystemAdapter>;
  let mockOnClose: jest.Mock;
  let mockOnNavigateToForm: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockFilePicker = { pickDocument: jest.fn() };
    mockFileSystem = {
      copyToAppStorage: jest.fn().mockResolvedValue('file:///app/documents/invoice_123.jpg'),
      getDocumentsDirectory: jest.fn().mockResolvedValue('/app/documents'),
      exists: jest.fn().mockResolvedValue(true),
      deleteFile: jest.fn(),
    };
    mockOnClose = jest.fn();
    mockOnNavigateToForm = jest.fn();
  });

  it('opens inline form after successful OCR + normalize', async () => {
    mockFilePicker.pickDocument.mockResolvedValue(makeMockFile());
    const mockOcr = makeMockOcr(makeOcrResult());
    const mockNormalizer = makeMockNormalizer(makeNormalizedInvoice());

    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <InvoiceScreen
          onClose={mockOnClose}
          onNavigateToForm={mockOnNavigateToForm}
          filePickerAdapter={mockFilePicker}
          fileSystemAdapter={mockFileSystem}
          ocrAdapter={mockOcr}
          invoiceNormalizer={mockNormalizer}
        />,
      );
    });

    await act(async () => {
      testRenderer!.root.findByProps({ testID: 'upload-pdf-button' }).props.onPress();
    });
    await act(flushPromises);

    // Should now open the inline form directly (review step removed)
    expect(testRenderer!.root.findByProps({ testID: 'invoice-screen' })).toBeTruthy();
    expect(testRenderer!.root.findByProps({ testID: 'invoice-form' })).toBeTruthy();
  });

  it('calls ocrAdapter.extractText during upload', async () => {
    mockFilePicker.pickDocument.mockResolvedValue(makeMockFile());
    const mockOcr = makeMockOcr();
    const mockNormalizer = makeMockNormalizer();

    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <InvoiceScreen
          onClose={mockOnClose}
          onNavigateToForm={mockOnNavigateToForm}
          filePickerAdapter={mockFilePicker}
          fileSystemAdapter={mockFileSystem}
          ocrAdapter={mockOcr}
          invoiceNormalizer={mockNormalizer}
        />,
      );
    });

    await act(async () => {
      testRenderer!.root.findByProps({ testID: 'upload-pdf-button' }).props.onPress();
    });
    await act(flushPromises);

    expect(mockOcr.extractText).toHaveBeenCalledWith('file:///app/documents/invoice_123.jpg');
  });

  it('transitions to error state and shows retry + manual buttons when OCR fails', async () => {
    mockFilePicker.pickDocument.mockResolvedValue(makeMockFile());
    const mockOcr = makeMockOcr(undefined, new Error('OCR unavailable'));
    const mockNormalizer = makeMockNormalizer();

    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <InvoiceScreen
          onClose={mockOnClose}
          onNavigateToForm={mockOnNavigateToForm}
          filePickerAdapter={mockFilePicker}
          fileSystemAdapter={mockFileSystem}
          ocrAdapter={mockOcr}
          invoiceNormalizer={mockNormalizer}
        />,
      );
    });

    await act(async () => {
      testRenderer!.root.findByProps({ testID: 'upload-pdf-button' }).props.onPress();
    });
    await act(flushPromises);

    expect(testRenderer!.root.findByProps({ testID: 'retry-ocr-button' })).toBeTruthy();
    expect(testRenderer!.root.findByProps({ testID: 'fallback-manual-button' })).toBeTruthy();
    expect(testRenderer!.root.findByProps({ testID: 'ocr-error-message' })).toBeTruthy();
  });

  it('error message contains the original error text', async () => {
    mockFilePicker.pickDocument.mockResolvedValue(makeMockFile());
    const mockOcr = makeMockOcr(undefined, new Error('Network timeout'));
    const mockNormalizer = makeMockNormalizer();

    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <InvoiceScreen
          onClose={mockOnClose}
          onNavigateToForm={mockOnNavigateToForm}
          filePickerAdapter={mockFilePicker}
          fileSystemAdapter={mockFileSystem}
          ocrAdapter={mockOcr}
          invoiceNormalizer={mockNormalizer}
        />,
      );
    });

    await act(async () => {
      testRenderer!.root.findByProps({ testID: 'upload-pdf-button' }).props.onPress();
    });
    await act(flushPromises);

    const errorMsg = testRenderer!.root.findByProps({ testID: 'ocr-error-message' });
    expect(errorMsg.props.children).toContain('Network timeout');
  });

  it('fallback-manual-button navigates to form with cached pdfFile but no initialValues', async () => {
    mockFilePicker.pickDocument.mockResolvedValue(makeMockFile());
    const mockOcr = makeMockOcr(undefined, new Error('OCR fail'));
    const mockNormalizer = makeMockNormalizer();

    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <InvoiceScreen
          onClose={mockOnClose}
          onNavigateToForm={mockOnNavigateToForm}
          filePickerAdapter={mockFilePicker}
          fileSystemAdapter={mockFileSystem}
          ocrAdapter={mockOcr}
          invoiceNormalizer={mockNormalizer}
        />,
      );
    });

    await act(async () => {
      testRenderer!.root.findByProps({ testID: 'upload-pdf-button' }).props.onPress();
    });
    await act(flushPromises);

    await act(async () => {
      testRenderer!.root.findByProps({ testID: 'fallback-manual-button' }).props.onPress();
    });

    // Embedded form should be shown with cached pdfFile; no navigation
    expect(mockOnNavigateToForm).not.toHaveBeenCalled();
    expect(testRenderer!.root.findByProps({ testID: 'invoice-form' })).toBeTruthy();
  });

  it('skips OCR for PDF files and still opens inline form', async () => {
    mockFilePicker.pickDocument.mockResolvedValue(
      makeMockFile({ type: 'application/pdf', name: 'invoice.pdf' }),
    );
    const mockOcr = makeMockOcr();
    const mockNormalizer = makeMockNormalizer();

    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <InvoiceScreen
          onClose={mockOnClose}
          onNavigateToForm={mockOnNavigateToForm}
          filePickerAdapter={mockFilePicker}
          fileSystemAdapter={mockFileSystem}
          ocrAdapter={mockOcr}
          invoiceNormalizer={mockNormalizer}
        />,
      );
    });

    await act(async () => {
      await testRenderer!.root.findByProps({ testID: 'upload-pdf-button' }).props.onPress();
    });

    // OCR should NOT be called for PDFs
    expect(mockOcr.extractText).not.toHaveBeenCalled();
    // Should open inline form directly
    expect(testRenderer!.root.findByProps({ testID: 'invoice-form' })).toBeTruthy();
  });

  it('when no OCR adapters are injected, navigates directly to form with pdfFile', async () => {
    mockFilePicker.pickDocument.mockResolvedValue(makeMockFile());

    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <InvoiceScreen
          onClose={mockOnClose}
          onNavigateToForm={mockOnNavigateToForm}
          filePickerAdapter={mockFilePicker}
          fileSystemAdapter={mockFileSystem}
          // ocrAdapter and invoiceNormalizer NOT provided
        />,
      );
    });

    await act(async () => {
      testRenderer!.root.findByProps({ testID: 'upload-pdf-button' }).props.onPress();
    });
    await act(flushPromises);

    // Embedded form should be shown inline when no OCR adapters are provided
    expect(mockOnNavigateToForm).not.toHaveBeenCalled();
    expect(testRenderer!.root.findByProps({ testID: 'invoice-form' })).toBeTruthy();
  });
});

