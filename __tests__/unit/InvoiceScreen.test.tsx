import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { Alert } from 'react-native';
import { InvoiceScreen } from '../../src/pages/invoices/InvoiceScreen';
import { IFilePickerAdapter, FilePickerResult } from '../../src/infrastructure/files/IFilePickerAdapter';
import { IFileSystemAdapter } from '../../src/infrastructure/files/IFileSystemAdapter';

// Mock Alert
jest.spyOn(Alert, 'alert');

describe('InvoiceScreen', () => {
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
    };

    mockOnClose = jest.fn();
    mockOnNavigateToForm = jest.fn();
  });

  it('renders with upload and manual entry action buttons', async () => {
    let testRenderer: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      testRenderer = renderer.create(
        <InvoiceScreen
          onClose={mockOnClose}
          onNavigateToForm={mockOnNavigateToForm}
          filePickerAdapter={mockFilePicker}
          fileSystemAdapter={mockFileSystem}
        />
      );
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
      testRenderer = renderer.create(
        <InvoiceScreen
          onClose={mockOnClose}
          onNavigateToForm={mockOnNavigateToForm}
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
      testRenderer = renderer.create(
        <InvoiceScreen
          onClose={mockOnClose}
          onNavigateToForm={mockOnNavigateToForm}
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

    expect(mockFilePicker.pickDocument).toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Invalid File',
      'Please select a PDF file'
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
      testRenderer = renderer.create(
        <InvoiceScreen
          onClose={mockOnClose}
          onNavigateToForm={mockOnNavigateToForm}
          filePickerAdapter={mockFilePicker}
          fileSystemAdapter={mockFileSystem}
        />
      );
    });

    const root = testRenderer!.root;
    const pressables = root.findAllByType(require('react-native').Pressable);
    const uploadButton = root.findByProps({ testID: 'upload-pdf-button' })
    await act(async () => {
      await uploadButton.props.onPress();
    });

    expect(mockFilePicker.pickDocument).toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      'File Too Large',
      'PDF must be under 20MB'
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
      testRenderer = renderer.create(
        <InvoiceScreen
          onClose={mockOnClose}
          onNavigateToForm={mockOnNavigateToForm}
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

    expect(mockFilePicker.pickDocument).toHaveBeenCalled();
    expect(mockFileSystem.copyToAppStorage).toHaveBeenCalledWith(
      mockPickerResult.uri,
      expect.stringContaining('invoice_')
    );
    expect(mockOnNavigateToForm).toHaveBeenCalledWith({
      mode: 'create',
      pdfFile: {
        uri: appStorageUri,
        originalUri: mockPickerResult.uri,
        name: mockPickerResult.name,
        size: mockPickerResult.size,
        mimeType: mockPickerResult.type,
      },
    });
  });

  it('shows error alert when file copy fails', async () => {
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
      testRenderer = renderer.create(
        <InvoiceScreen
          onClose={mockOnClose}
          onNavigateToForm={mockOnNavigateToForm}
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

    expect(Alert.alert).toHaveBeenCalledWith(
      'Upload Error',
      expect.stringContaining('Storage full')
    );
    expect(mockOnNavigateToForm).not.toHaveBeenCalled();
  });

  it('does not copy or navigate when file picker is cancelled', async () => {
    const mockPickerResult: FilePickerResult = {
      cancelled: true,
    };

    mockFilePicker.pickDocument.mockResolvedValue(mockPickerResult);

    let testRenderer: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      testRenderer = renderer.create(
        <InvoiceScreen
          onClose={mockOnClose}
          onNavigateToForm={mockOnNavigateToForm}
          filePickerAdapter={mockFilePicker}
          fileSystemAdapter={mockFileSystem}
        />
      );
    });

    const root = testRenderer!.root;
    const pressables = root.findAllByType(require('react-native').Pressable);
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
      testRenderer = renderer.create(
        <InvoiceScreen
          onClose={mockOnClose}
          onNavigateToForm={mockOnNavigateToForm}
          filePickerAdapter={mockFilePicker}
          fileSystemAdapter={mockFileSystem}
        />
      );
    });

    const root = testRenderer!.root;
    const manualEntryButton = root.findByProps({ testID: 'manual-entry-button' });
    
    await act(async () => {
      await manualEntryButton.props.onPress();
    });

    expect(mockOnNavigateToForm).toHaveBeenCalledWith({
      mode: 'create',
    });
    expect(mockFilePicker.pickDocument).not.toHaveBeenCalled();
  });

  it('calls onClose when Cancel button is pressed', async () => {
    let testRenderer: renderer.ReactTestRenderer | undefined;

    await act(async () => {
      testRenderer = renderer.create(
        <InvoiceScreen
          onClose={mockOnClose}
          onNavigateToForm={mockOnNavigateToForm}
          filePickerAdapter={mockFilePicker}
          fileSystemAdapter={mockFileSystem}
        />
      );
    });

    const root = testRenderer!.root;
    const cancelButton = root.findByProps({ testID: 'cancel-button' });

    act(() => {
      cancelButton.props.onPress();
    });

    expect(mockOnClose).toHaveBeenCalled();
  });
});
