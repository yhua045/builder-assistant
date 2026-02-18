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

import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { InvoiceScreen } from '../../src/pages/invoices/InvoiceScreen';
import { IFilePickerAdapter, FilePickerResult } from '../../src/infrastructure/files/IFilePickerAdapter';
import { IFileSystemAdapter } from '../../src/infrastructure/files/IFileSystemAdapter';
import { initDatabase } from '../../src/infrastructure/database/connection';

describe('InvoiceScreen integration', () => {
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
      testRenderer = renderer.create(
        <InvoiceScreen
          onClose={jest.fn()}
          onNavigateToForm={mockNavigate}
          filePickerAdapter={mockFilePicker}
          fileSystemAdapter={mockFileSystem}
        />
      );
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

    // Verify navigation was called with pdfFile metadata
    expect(mockNavigate).toHaveBeenCalledWith({
      mode: 'create',
      pdfFile: expect.objectContaining({
        uri: expect.stringContaining('/app/documents/invoice_'),
        originalUri: mockPickerResult.uri,
        name: mockPickerResult.name,
        size: mockPickerResult.size,
        mimeType: mockPickerResult.type,
      }),
    });
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
      testRenderer = renderer.create(
        <InvoiceScreen
          onClose={jest.fn()}
          onNavigateToForm={mockNavigate}
          filePickerAdapter={mockFilePicker}
          fileSystemAdapter={mockFileSystem}
        />
      );
    });

    const root = testRenderer!.root;
    const uploadButton = root.findByProps({ testID: 'upload-pdf-button' });

    await act(async () => {
      await uploadButton.props.onPress();
    });

    // Get the app storage URI from the navigation call
    const pdfFile = mockNavigate.mock.calls[0][0].pdfFile;
    const appStorageUri = pdfFile.uri;

    // Verify file exists in mock storage
    const fileExists = await mockFileSystem.exists(appStorageUri);
    expect(fileExists).toBe(true);
  });

  // NOTE: The following tests are commented out because they require
  // use case implementations that don't exist yet. They should be
  // implemented when we wire up CreateInvoiceUseCase and handle the
  // atomic Document+Invoice save flow.
  
  /*
  it('InvoiceForm with pdfFile creates Document with localPath and Invoice with documentId atomically', async () => {
    // TODO: Implement when CreateInvoiceUseCase is wired up with atomic save
  });

  it('user cancels InvoiceForm after PDF upload → no DB records created, file remains', async () => {
    // TODO: Implement when InvoiceForm cancel flow is wired up
  });

  it('manual entry flow creates Invoice without documentId', async () => {
    // TODO: Implement when CreateInvoiceUseCase exists
  });

  it('Document-Invoice link is valid after atomic save', async () => {
    // TODO: Implement when atomic save use case exists
  });
  */
});
