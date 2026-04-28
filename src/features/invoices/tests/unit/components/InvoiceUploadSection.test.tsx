import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { InvoiceUploadSection } from '../../../components/InvoiceUploadSection';
import { launchImageLibrary } from 'react-native-image-picker';

// Mock react-native-image-picker
jest.mock('react-native-image-picker');

describe('InvoiceUploadSection', () => {
  const mockOnUpload = jest.fn();
  const mockOnError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render upload button', () => {
    const { getByText } = render(
      <InvoiceUploadSection onUpload={mockOnUpload} onError={mockOnError} />
    );

    expect(getByText('Upload Invoice')).toBeTruthy();
  });

  it('should open file picker when upload button is pressed', async () => {
    const mockResponse = {
      didCancel: false,
      assets: [
        {
          uri: 'file:///path/to/invoice.pdf',
          fileName: 'invoice.pdf',
          fileSize: 1024,
          type: 'application/pdf',
        },
      ],
    };

    (launchImageLibrary as jest.Mock).mockResolvedValue(mockResponse);

    const { getByText } = render(
      <InvoiceUploadSection onUpload={mockOnUpload} onError={mockOnError} />
    );

    const uploadButton = getByText('Upload Invoice');
    fireEvent.press(uploadButton);

    await waitFor(() => {
      expect(launchImageLibrary).toHaveBeenCalledWith(
        expect.objectContaining({
          mediaType: 'photo',
          selectionLimit: 1,
        })
      );
    });
  });

  it('should show file preview after selection', async () => {
    const mockResponse = {
      didCancel: false,
      assets: [
        {
          uri: 'file:///path/to/invoice.pdf',
          fileName: 'invoice.pdf',
          fileSize: 1024,
          type: 'application/pdf',
        },
      ],
    };

    (launchImageLibrary as jest.Mock).mockResolvedValue(mockResponse);

    const { getByText, findByText } = render(
      <InvoiceUploadSection onUpload={mockOnUpload} onError={mockOnError} />
    );

    const uploadButton = getByText('Upload Invoice');
    fireEvent.press(uploadButton);

    await waitFor(async () => {
      expect(await findByText('invoice.pdf')).toBeTruthy();
    });
  });

  it('should call onUpload when file is uploaded', async () => {
    const mockResponse = {
      didCancel: false,
      assets: [
        {
          uri: 'file:///path/to/invoice.pdf',
          fileName: 'invoice.pdf',
          fileSize: 1024,
          type: 'application/pdf',
        },
      ],
    };

    (launchImageLibrary as jest.Mock).mockResolvedValue(mockResponse);

    const { getByText } = render(
      <InvoiceUploadSection onUpload={mockOnUpload} onError={mockOnError} />
    );

    const uploadButton = getByText('Upload Invoice');
    fireEvent.press(uploadButton);

    await waitFor(() => {
      expect(mockOnUpload).toHaveBeenCalledWith(
        expect.objectContaining({
          uri: 'file:///path/to/invoice.pdf',
          fileName: 'invoice.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
        })
      );
    });
  });

  it('should show upload progress', async () => {
    const mockResponse = {
      didCancel: false,
      assets: [
        {
          uri: 'file:///path/to/invoice.pdf',
          fileName: 'invoice.pdf',
          fileSize: 1024,
          type: 'application/pdf',
        },
      ],
    };

    (launchImageLibrary as jest.Mock).mockResolvedValue(mockResponse);

    const { queryByTestId } = render(
      <InvoiceUploadSection 
        onUpload={mockOnUpload} 
        onError={mockOnError}
        uploading={true}
      />
    );

    expect(queryByTestId('upload-progress')).toBeTruthy();
  });

  it('should handle file picker cancellation gracefully', async () => {
    const mockResponse = {
      didCancel: true,
    };

    (launchImageLibrary as jest.Mock).mockResolvedValue(mockResponse);

    const { getByText } = render(
      <InvoiceUploadSection onUpload={mockOnUpload} onError={mockOnError} />
    );

    const uploadButton = getByText('Upload Invoice');
    fireEvent.press(uploadButton);

    await waitFor(() => {
      expect(mockOnUpload).not.toHaveBeenCalled();
      expect(mockOnError).not.toHaveBeenCalled();
    });
  });

  it('should handle file picker error', async () => {
    const mockError = new Error('File picker failed');
    (launchImageLibrary as jest.Mock).mockRejectedValue(mockError);

    const { getByText } = render(
      <InvoiceUploadSection onUpload={mockOnUpload} onError={mockOnError} />
    );

    const uploadButton = getByText('Upload Invoice');
    fireEvent.press(uploadButton);

    await waitFor(() => {
      expect(mockOnError).toHaveBeenCalledWith(expect.stringContaining('File picker failed'));
    });
  });

  it('should accept PDF and image files only', async () => {
    const { getByText } = render(
      <InvoiceUploadSection onUpload={mockOnUpload} onError={mockOnError} />
    );

    const uploadButton = getByText('Upload Invoice');
    fireEvent.press(uploadButton);

    await waitFor(() => {
      expect(launchImageLibrary).toHaveBeenCalledWith(
        expect.objectContaining({
          mediaType: 'photo',
        })
      );
    });
  });

  it('should show file size in human-readable format', async () => {
    const mockResponse = {
      didCancel: false,
      assets: [
        {
          uri: 'file:///path/to/invoice.pdf',
          fileName: 'invoice.pdf',
          fileSize: 1024 * 1024 * 2.5,  // 2.5 MB
          type: 'application/pdf',
        },
      ],
    };

    (launchImageLibrary as jest.Mock).mockResolvedValue(mockResponse);

    const { getByText, findByText } = render(
      <InvoiceUploadSection onUpload={mockOnUpload} onError={mockOnError} />
    );

    const uploadButton = getByText('Upload Invoice');
    fireEvent.press(uploadButton);

    await waitFor(async () => {
      expect(await findByText(/2\.5 MB/)).toBeTruthy();
    });
  });

  it('should allow removing selected file', async () => {
    const mockResponse = {
      didCancel: false,
      assets: [
        {
          uri: 'file:///path/to/invoice.pdf',
          fileName: 'invoice.pdf',
          fileSize: 1024,
          type: 'application/pdf',
        },
      ],
    };

    (launchImageLibrary as jest.Mock).mockResolvedValue(mockResponse);

    const { getByText, findByText, queryByText, getByTestId } = render(
      <InvoiceUploadSection onUpload={mockOnUpload} onError={mockOnError} />
    );

    const uploadButton = getByText('Upload Invoice');
    fireEvent.press(uploadButton);

    await waitFor(async () => {
      expect(await findByText('invoice.pdf')).toBeTruthy();
    });

    const removeButton = getByTestId('remove-file-button');
    fireEvent.press(removeButton);

    await waitFor(() => {
      expect(queryByText('invoice.pdf')).toBeNull();
    });
  });

  it('should show accepted file types hint', () => {
    const { getByText } = render(
      <InvoiceUploadSection onUpload={mockOnUpload} onError={mockOnError} />
    );

    expect(getByText(/PDF|Image/i)).toBeTruthy();
  });
});
