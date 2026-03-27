// Mock react-native-sqlite-storage with in-memory better-sqlite3
jest.mock('react-native-sqlite-storage', () => {
  function createAdapter(db: any) {
    return {
      executeSql: async (sql: string, params: any[] = []) => {
        const stmt = sql.trim();
        const upper = stmt.toUpperCase();

        if (upper.startsWith('SELECT')) {
          const rows = db.prepare(stmt).all(...params);
          return [{ rows: { length: rows.length, item: (i: number) => rows[i] } }];
        }

        if (params && params.length > 0) {
          try {
            const prepared = db.prepare(stmt);
            prepared.run(...params);
            return [{ rows: { length: 0, item: (_: number) => undefined } }];
          } catch (e) {
            console.error('SQL Error mock (write):', e, sql, params);
            throw e;
          }
        }

        if (stmt) db.exec(stmt);
        return [{ rows: { length: 0, item: (_: number) => undefined } }];
      },
      transaction: async (fn: any) => {
        db.exec('BEGIN');
        try {
          const tx = {
            executeSql: (sql: string, params?: any[]) => createAdapter(db).executeSql(sql, params),
          };
          await fn(tx);
          db.exec('COMMIT');
        } catch (err) {
          db.exec('ROLLBACK');
          throw err;
        }
      },
      close: async () => db.close(),
    };
  }

  return {
    enablePromise: (_: boolean) => {},
    openDatabase: async (_: any) => {
      const BetterSqlite3 = require('better-sqlite3');
      const db = new BetterSqlite3(':memory:');
      return createAdapter(db);
    },
  };
});

jest.mock('../../src/hooks/useInvoices', () => ({
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

import React from 'react';
import { wrapWithQuery } from '../utils/queryClientWrapper';
import renderer, { act } from 'react-test-renderer';
import { InvoiceScreen } from '../../src/pages/invoices/InvoiceScreen';
import { IFilePickerAdapter, FilePickerResult } from '../../src/infrastructure/files/IFilePickerAdapter';
import { IFileSystemAdapter } from '../../src/infrastructure/files/IFileSystemAdapter';
import { IOcrAdapter, OcrResult } from '../../src/application/services/IOcrAdapter';
import {
  IInvoiceNormalizer,
  InvoiceCandidates,
  NormalizedInvoice,
} from '../../src/application/ai/IInvoiceNormalizer';
import { initDatabase } from '../../src/infrastructure/database/connection';

/** Flush all pending microtasks so that sequential `await` chains settle. */
const flushPromises = () => new Promise<void>(resolve => setImmediate(resolve));

describe.skip('InvoiceScreen integration', () => {
  let mockFilePicker: jest.Mocked<IFilePickerAdapter>;
  let mockFileSystem: jest.Mocked<IFileSystemAdapter>;

  // Track files in mock file system
  const mockFileStorage = new Map<string, string>();

  beforeEach(async () => {
    jest.clearAllMocks();
    mockFileStorage.clear();

    // Initialize database
    await initDatabase();

    // Mock file picker
    mockFilePicker = {
      pickDocument: jest.fn(),
    };

    // Mock file system with in-memory storage
    mockFileSystem = {
      copyToAppStorage: jest.fn(async (sourceUri: string, destFilename: string) => {
        const destUri = `/app/documents/${destFilename}`;
        
        // Simulate file copy by creating entry in mock storage
        const fileContent = `Mock PDF content from ${sourceUri}`;
        mockFileStorage.set(destUri, fileContent);
        
        return destUri;
      }),
      getDocumentsDirectory: jest.fn(async () => '/app/documents'),
      exists: jest.fn(async (filePath: string) => {
        return mockFileStorage.has(filePath);
      }),
      deleteFile: jest.fn(async (_filePath: string) => {}),
    };
  });

  it('upload PDF flow copies file to app storage and navigates with pdfFile metadata', async () => {
    const mockPickerResult: FilePickerResult = {
      cancelled: false,
      uri: 'file:///original/invoice-123.pdf',
      name: 'invoice-123.pdf',
      size: 1024 * 500, // 500KB
      type: 'application/pdf',
    };

    mockFilePicker.pickDocument.mockResolvedValue(mockPickerResult);

    const mockNavigate = jest.fn();
    let testRenderer: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      testRenderer = renderer.create(wrapWithQuery(<InvoiceScreen
          onClose={jest.fn()}
          onNavigateToForm={mockNavigate}
          filePickerAdapter={mockFilePicker}
          fileSystemAdapter={mockFileSystem}
        />));
    });

    const root = testRenderer!.root;
    const uploadButton = root.findByProps({ testID: 'upload-pdf-button' });

    // Trigger upload
    await act(async () => {
      await uploadButton.props.onPress();
    });

    // Verify file picker was called
    expect(mockFilePicker.pickDocument).toHaveBeenCalled();

    // Verify file was copied to app storage
    expect(mockFileSystem.copyToAppStorage).toHaveBeenCalledWith(
      mockPickerResult.uri,
      expect.stringContaining('invoice_')
    );

    // Embedded form should be rendered inline with pdf context; no navigation
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(root.findByProps({ testID: 'invoice-form' })).toBeTruthy();
    // Verify the mock storage received the copied file
    const storageKeys = Array.from(mockFileStorage.keys());
    expect(storageKeys.find(k => k.includes('/app/documents/invoice_'))).toBeDefined();
  });

  it('copied PDF file exists in app storage after upload', async () => {
    const mockPickerResult: FilePickerResult = {
      cancelled: false,
      uri: 'file:///original/test.pdf',
      name: 'test.pdf',
      size: 1024,
      type: 'application/pdf',
    };

    mockFilePicker.pickDocument.mockResolvedValue(mockPickerResult);

    const mockNavigate = jest.fn();
    let testRenderer: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      testRenderer = renderer.create(wrapWithQuery(<InvoiceScreen
          onClose={jest.fn()}
          onNavigateToForm={mockNavigate}
          filePickerAdapter={mockFilePicker}
          fileSystemAdapter={mockFileSystem}
        />));
    });

    const root = testRenderer!.root;
    const uploadButton = root.findByProps({ testID: 'upload-pdf-button' });

    await act(async () => {
      await uploadButton.props.onPress();
    });

    // Get the app storage URI from the mock storage created by the mock file system
    const storageKeys = Array.from(mockFileStorage.keys());
    const appStorageUri = storageKeys[0];

    // Verify file exists in mock storage
    const fileExists = await mockFileSystem.exists(appStorageUri);
    expect(fileExists).toBe(true);
  });

  // NOTE: The following tests (InvoiceForm atomic save) require the InvoiceForm
  // to be rendered in integration with a real DB — deferred to a future ticket
  // because InvoiceForm render relies on native navigation/modal patterns.
});

// ── OCR pipeline integration tests ───────────────────────────────────────

const makeOcrResult = (text = 'Acme Corp\nINV-001\nTotal $500.00'): OcrResult => ({
  fullText: text,
  tokens: [],
  imageUri: 'file:///app/invoice.jpg',
});

const makeNormalizedInvoice = (overrides: Partial<NormalizedInvoice> = {}): NormalizedInvoice => ({
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
  ...overrides,
});

function makeMockOcrAdapter(result?: OcrResult, error?: Error): jest.Mocked<IOcrAdapter> {
  return {
    extractText: error
      ? jest.fn().mockRejectedValue(error)
      : jest.fn().mockResolvedValue(result ?? makeOcrResult()),
  };
}

function makeMockNormalizerAdapter(
  normalized?: NormalizedInvoice,
  error?: Error,
): jest.Mocked<IInvoiceNormalizer> {
  const empty: InvoiceCandidates = {
    vendors: [], invoiceNumbers: [], dates: [], dueDates: [],
    amounts: [], subtotals: [], taxAmounts: [], lineItems: [],
  };
  return {
    extractCandidates: jest.fn().mockReturnValue(empty),
    normalize: error
      ? jest.fn().mockRejectedValue(error)
      : jest.fn().mockResolvedValue(normalized ?? makeNormalizedInvoice()),
  };
}

describe.skip('InvoiceScreen integration — OCR pipeline', () => {
  let mockFilePicker: jest.Mocked<IFilePickerAdapter>;
  let mockFileSystem: jest.Mocked<IFileSystemAdapter>;
  const mockFileStorage = new Map<string, string>();

  beforeEach(async () => {
    jest.clearAllMocks();
    mockFileStorage.clear();
    await initDatabase();

    mockFilePicker = { pickDocument: jest.fn() };
    mockFileSystem = {
      copyToAppStorage: jest.fn(async (_src: string, destFilename: string) => {
        const destUri = `/app/documents/${destFilename}`;
        mockFileStorage.set(destUri, 'mock-content');
        return destUri;
      }),
      getDocumentsDirectory: jest.fn(async () => '/app/documents'),
      exists: jest.fn(async (p: string) => mockFileStorage.has(p)),
      deleteFile: jest.fn(async (_filePath: string) => {}),
    };
  });

  it('happy path: image upload → OCR → normalize → opens inline form', async () => {
    const pickerResult: FilePickerResult = {
      cancelled: false,
      uri: 'file:///original/invoice.jpg',
      name: 'invoice.jpg',
      size: 512000,
      type: 'image/jpeg',
    };
    mockFilePicker.pickDocument.mockResolvedValue(pickerResult);
    const mockOcr = makeMockOcrAdapter(makeOcrResult());
    const mockNormalizer = makeMockNormalizerAdapter(makeNormalizedInvoice());
    const mockNavigate = jest.fn();

    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <InvoiceScreen
          onClose={jest.fn()}
          onNavigateToForm={mockNavigate}
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

    // OCR was called with the app-storage URI
    expect(mockOcr.extractText).toHaveBeenCalledWith(
      expect.stringContaining('/app/documents/invoice_'),
    );
    expect(mockNormalizer.normalize).toHaveBeenCalled();

    // Inline form is shown directly (review step removed)
    expect(testRenderer!.root.findByProps({ testID: 'invoice-form' })).toBeTruthy();

    // Navigate was NOT called yet (user hasn't accepted)
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('happy path: opens form with prefilled initialValues after normalize', async () => {
    const pickerResult: FilePickerResult = {
      cancelled: false,
      uri: 'file:///original/inv.jpg',
      name: 'inv.jpg',
      size: 100000,
      type: 'image/jpeg',
    };
    mockFilePicker.pickDocument.mockResolvedValue(pickerResult);
    const normalized = makeNormalizedInvoice();
    const mockOcr = makeMockOcrAdapter();
    const mockNormalizer = makeMockNormalizerAdapter(normalized);
    const mockNavigate = jest.fn();

    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <InvoiceScreen
          onClose={jest.fn()}
          onNavigateToForm={mockNavigate}
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

    // The embedded form should be rendered with prefilled initial values
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(testRenderer!.root.findByProps({ testID: 'invoice-form' })).toBeTruthy();
    const vendorInput = testRenderer!.root.findByProps({ testID: 'invoice-form-vendor-input' });
    expect(vendorInput.props.value).toBe('Acme Corp');
  });

  it('OCR failure → error state → retry succeeds → inline form', async () => {
    const pickerResult: FilePickerResult = {
      cancelled: false,
      uri: 'file:///original/inv.jpg',
      name: 'inv.jpg',
      size: 100000,
      type: 'image/jpeg',
    };
    mockFilePicker.pickDocument.mockResolvedValue(pickerResult);

    // First call fails; second call succeeds
    const mockOcr: jest.Mocked<IOcrAdapter> = {
      extractText: jest
        .fn()
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce(makeOcrResult()),
    };
    const mockNormalizer = makeMockNormalizerAdapter();
    const mockNavigate = jest.fn();

    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <InvoiceScreen
          onClose={jest.fn()}
          onNavigateToForm={mockNavigate}
          filePickerAdapter={mockFilePicker}
          fileSystemAdapter={mockFileSystem}
          ocrAdapter={mockOcr}
          invoiceNormalizer={mockNormalizer}
        />,
      );
    });

    // First attempt — should fail
    await act(async () => {
      testRenderer!.root.findByProps({ testID: 'upload-pdf-button' }).props.onPress();
    });
    await act(flushPromises);
    expect(testRenderer!.root.findByProps({ testID: 'retry-ocr-button' })).toBeTruthy();

    // Retry — should succeed
    await act(async () => {
      testRenderer!.root.findByProps({ testID: 'retry-ocr-button' }).props.onPress();
    });
    await act(flushPromises);

    expect(testRenderer!.root.findByProps({ testID: 'invoice-form' })).toBeTruthy();
  });

  it('OCR failure → fallback to manual entry includes cached pdfFile', async () => {
    const pickerResult: FilePickerResult = {
      cancelled: false,
      uri: 'file:///original/inv.jpg',
      name: 'inv.jpg',
      size: 100000,
      type: 'image/jpeg',
    };
    mockFilePicker.pickDocument.mockResolvedValue(pickerResult);
    const mockOcr = makeMockOcrAdapter(undefined, new Error('OCR failed'));
    const mockNormalizer = makeMockNormalizerAdapter();
    const mockNavigate = jest.fn();

    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <InvoiceScreen
          onClose={jest.fn()}
          onNavigateToForm={mockNavigate}
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
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(testRenderer!.root.findByProps({ testID: 'invoice-form' })).toBeTruthy();
    const texts = testRenderer!.root
      .findAllByType(require('react-native').Text)
      .map((t: any) => t.props.children)
      .flat()
      .join(' ');
    expect(texts).toContain('inv.jpg');
  });

  it('PDF upload skips OCR and opens inline form with empty extraction', async () => {
    const pickerResult: FilePickerResult = {
      cancelled: false,
      uri: 'file:///original/invoice.pdf',
      name: 'invoice.pdf',
      size: 200000,
      type: 'application/pdf',
    };
    mockFilePicker.pickDocument.mockResolvedValue(pickerResult);
    const mockOcr = makeMockOcrAdapter();
    const mockNormalizer = makeMockNormalizerAdapter();
    const mockNavigate = jest.fn();

    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <InvoiceScreen
          onClose={jest.fn()}
          onNavigateToForm={mockNavigate}
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

    // OCR should NOT have been called
    expect(mockOcr.extractText).not.toHaveBeenCalled();

    // Inline form should be shown
    expect(testRenderer!.root.findByProps({ testID: 'invoice-form' })).toBeTruthy();
  });
});
