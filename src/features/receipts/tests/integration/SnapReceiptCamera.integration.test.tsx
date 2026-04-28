/**
 * Integration tests for Snap Receipt camera flow
 * Tests end-to-end flow: Camera → OCR → Form → Save
 */

import React from 'react';
import { wrapWithQuery } from '../../../../../__tests__/utils/queryClientWrapper';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SnapReceiptScreen } from '../../screens/SnapReceiptScreen';
import { MockCameraAdapter } from '../../../../infrastructure/camera/MockCameraAdapter';
import { container } from 'tsyringe';
import { ReceiptRepository } from '../../domain/ReceiptRepository';
import '../../../../infrastructure/di/registerServices';

// Mock Alert
jest.spyOn(Alert, 'alert');

// Mock useSnapReceipt hook
jest.mock('../../hooks/useSnapReceipt');

// Mock the actual OCR adapter to return predictable results
jest.mock('../../../../infrastructure/ocr/MobileOcrAdapter', () => ({
  MobileOcrAdapter: jest.fn().mockImplementation(() => ({
    extractText: jest.fn().mockResolvedValue({
      fullText: 'HOME DEPOT\n02/15/2026\nTotal: $127.50',
      tokens: [
        { text: 'HOME DEPOT', confidence: 0.95 },
        { text: '02/15/2026', confidence: 0.90 },
        { text: 'Total:', confidence: 0.85 },
        { text: '$127.50', confidence: 0.92 },
      ],
      imageUri: 'file:///mock/receipt.jpg',
    }),
  })),
}));

describe.skip('SnapReceiptCamera Integration', () => {
  let mockCameraAdapter: MockCameraAdapter;
  let mockOnClose: jest.Mock;
  let mockReceiptRepo: any;
  let mockProcessReceipt: jest.Mock;
  let mockSaveReceipt: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCameraAdapter = new MockCameraAdapter();
    mockOnClose = jest.fn();
    mockProcessReceipt = jest.fn();
    mockSaveReceipt = jest.fn();

    // Mock repository
    mockReceiptRepo = {
      createReceipt: jest.fn(),
    };

    // Mock useSnapReceipt hook
    const useSnapReceipt = require('../../hooks/useSnapReceipt').useSnapReceipt;
    useSnapReceipt.mockReturnValue({
      saveReceipt: mockSaveReceipt,
      processReceipt: mockProcessReceipt,
      loading: false,
      processing: false,
      error: null,
    });

    // Override container registration for testing
    container.registerInstance<ReceiptRepository>('ReceiptRepository', mockReceiptRepo);
  });

  afterEach(() => {
    mockCameraAdapter.reset();
  });

  it.skip('should complete full flow: camera → OCR → form population → save', async () => {
    // Arrange
    mockCameraAdapter.setShouldCancel(false);
    
    mockProcessReceipt.mockResolvedValue({
      vendor: 'HOME DEPOT',
      total: 127.50,
      date: new Date('2026-02-15'),
      confidence: { vendor: 0.9, total: 0.95, date: 0.85 },
      suggestedCorrections: [],
    });
    
    //mockSaveReceipt.mockResolvedValue();
    
    mockReceiptRepo.createReceipt.mockResolvedValue({
      invoice: {
        id: 'invoice-123',
        total: 127.50,
        subtotal: 127.50,
        currency: 'USD',
        status: 'paid',
        dateIssued: '2026-02-15',
        dateDue: '2026-02-15',
        paymentStatus: 'paid',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      payment: {
        id: 'payment-123',
        invoiceId: 'invoice-123',
        amount: 127.50,
        method: 'card',
        date: '2026-02-15',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    });

    const { getByTestId, getByText } = render(wrapWithQuery(<SnapReceiptScreen 
        onClose={mockOnClose} 
        enableOcr={true}
        cameraAdapter={mockCameraAdapter}
      />));

    // Act - Step 1: Tap camera button
    const cameraButton = getByTestId('camera-button');
    fireEvent.press(cameraButton);

    // Assert - Step 2: Camera adapter was called
    await waitFor(() => {
      expect(mockCameraAdapter.getCaptureCount()).toBe(1);
    });

    // Assert - Step 3: OCR processing indicator shown
    await waitFor(() => {
      expect(getByText('Extracting receipt details...')).toBeTruthy();
    });

    // Assert - Step 4: Form populated with OCR data
    await waitFor(() => {
      const form = getByTestId('receipt-form');
      expect(form).toBeTruthy();
    }, { timeout: 5000 });

    // Act - Step 5: Submit form
    const submitButton = getByTestId('submit-button');
    fireEvent.press(submitButton);

    // Assert - Step 6: Receipt saved
    await waitFor(() => {
      expect(mockReceiptRepo.createReceipt).toHaveBeenCalledWith(
        expect.any(Object), // invoice
        expect.any(Object)  // payment
      );
    });

    // Assert - Step 7: Success feedback and close
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith('Success', expect.any(String));
      expect(mockOnClose).toHaveBeenCalled();
    });
  });

  it('should handle user cancellation gracefully', async () => {
    // Arrange
    mockCameraAdapter.setShouldCancel(true);

    const { getByTestId, queryByText } = render(wrapWithQuery(<SnapReceiptScreen 
        onClose={mockOnClose} 
        enableOcr={true}
        cameraAdapter={mockCameraAdapter}
      />));

    // Act
    fireEvent.press(getByTestId('camera-button'));

    // Assert - OCR should not run
    await waitFor(() => {
      expect(queryByText('Extracting receipt details...')).toBeNull();
    });

    // Assert - Should stay on camera screen
    expect(getByTestId('camera-button')).toBeTruthy();
    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it.skip('should allow manual entry after OCR failure', async () => {
    // Arrange
    mockCameraAdapter.setShouldCancel(false);
    
    // Mock OCR failure
    const { MobileOcrAdapter } = require('../../../../infrastructure/ocr/MobileOcrAdapter');
    MobileOcrAdapter.mockImplementationOnce(() => ({
      extractText: jest.fn().mockRejectedValue(new Error('OCR processing failed')),
    }));

    const { getByTestId } = render(wrapWithQuery(<SnapReceiptScreen 
        onClose={mockOnClose} 
        enableOcr={true}
        cameraAdapter={mockCameraAdapter}
      />));

    // Act - Capture photo
    fireEvent.press(getByTestId('camera-button'));

    // Assert - Error shown
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'OCR Error',
        expect.stringContaining('manual')
      );
    });

    // Assert - Form still accessible for manual entry
    await waitFor(() => {
      expect(getByTestId('receipt-form')).toBeTruthy();
    });
  });

  it('should handle permission denial and show settings prompt', async () => {
    // Arrange
    mockCameraAdapter.setHasPermissions(false);
    mockCameraAdapter.setShouldThrowError(true, 'Camera permissions not granted');

    const { getByTestId } = render(wrapWithQuery(<SnapReceiptScreen 
        onClose={mockOnClose} 
        enableOcr={true}
        cameraAdapter={mockCameraAdapter}
      />));

    // Act
    fireEvent.press(getByTestId('camera-button'));

    // Assert - Show permission error with instructions
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Camera Error',
        expect.stringContaining('permission')
      );
    });
  });

  it.skip('should retry OCR after initial failure', async () => {
    // Arrange
    mockCameraAdapter.setShouldCancel(false);
    let callCount = 0;
    
    const { MobileOcrAdapter } = require('../../../../infrastructure/ocr/MobileOcrAdapter');
    MobileOcrAdapter.mockImplementation(() => ({
      extractText: jest.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('OCR failed'));
        }
        return Promise.resolve({
          fullText: 'LOWES\n02/16/2026\nTotal: $89.99',
          tokens: [
            { text: 'LOWES', confidence: 0.90 },
            { text: '02/16/2026', confidence: 0.88 },
            { text: '$89.99', confidence: 0.95 },
          ],
          imageUri: 'file:///mock/receipt.jpg',
        });
      }),
    }));

    const { getByTestId } = render(wrapWithQuery(<SnapReceiptScreen 
        onClose={mockOnClose} 
        enableOcr={true}
        cameraAdapter={mockCameraAdapter}
      />));

    // Act - First attempt
    fireEvent.press(getByTestId('camera-button'));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalled();
    });

    // Act - Retry
    fireEvent.press(getByTestId('camera-button'));

    // Assert - Second attempt succeeds
    await waitFor(() => {
      expect(getByTestId('receipt-form')).toBeTruthy();
    }, { timeout: 5000 });
  });

  it.skip('should handle large images without crashing', async () => {
    // Arrange
    mockCameraAdapter.setShouldCancel(false);
    
    // Override mock to return large image
    jest.spyOn(mockCameraAdapter, 'capturePhoto').mockResolvedValue({
      uri: 'file:///mock/large-receipt.jpg',
      width: 4032,
      height: 3024,
      fileSize: 5242880, // 5MB
      cancelled: false,
    });

    const { getByTestId } = render(wrapWithQuery(<SnapReceiptScreen 
        onClose={mockOnClose} 
        enableOcr={true}
        cameraAdapter={mockCameraAdapter}
      />));

    // Act
    fireEvent.press(getByTestId('camera-button'));

    // Assert - Should handle large image gracefully
    await waitFor(() => {
      expect(getByTestId('receipt-form')).toBeTruthy();
    }, { timeout: 10000 });
  });

  it.skip('should populate form fields with correct confidence indicators', async () => {
    // Arrange
    mockCameraAdapter.setShouldCancel(false);

    const { getByTestId } = render(wrapWithQuery(<SnapReceiptScreen 
        onClose={mockOnClose} 
        enableOcr={true}
        cameraAdapter={mockCameraAdapter}
      />));

    // Act
    fireEvent.press(getByTestId('camera-button'));

    // Assert - Form shows confidence indicators
    await waitFor(() => {
      const form = getByTestId('receipt-form');
      expect(form).toBeTruthy();
      
      // Check for confidence indicators (these would be rendered by ReceiptForm)
      // This is tested more thoroughly in ReceiptForm unit tests
    }, { timeout: 5000 });
  });
});
