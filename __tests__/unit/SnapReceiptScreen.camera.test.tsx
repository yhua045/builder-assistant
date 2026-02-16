/**
 * Unit tests for SnapReceiptScreen with camera integration
 * Tests camera button, capture flow, error handling, and form population
 */

import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { SnapReceiptScreen } from '../../src/pages/receipts/SnapReceiptScreen';
import { MockCameraAdapter } from '../../src/infrastructure/camera/MockCameraAdapter';

// Mock dependencies
jest.mock('../../src/hooks/useSnapReceipt');
jest.mock('../../src/components/receipts/ReceiptForm', () => ({
  ReceiptForm: ({ onSubmit, onCancel, normalizedData, isProcessing }: any) => {
    const { Text, Pressable, View, ActivityIndicator } = require('react-native');
    
    if (isProcessing) {
      return (
        <View testID="processing-view">
          <ActivityIndicator />
          <Text>Extracting receipt details...</Text>
        </View>
      );
    }
    
    return (
      <Pressable testID="receipt-form">
        <Text>Receipt Form</Text>
        {normalizedData && <Text testID="normalized-vendor">{normalizedData.vendor}</Text>}
        <Pressable testID="submit-button" onPress={() => onSubmit({ vendor: 'Test', amount: 100, date: new Date().toISOString(), paymentMethod: 'card' })}>
          <Text>Submit</Text>
        </Pressable>
      </Pressable>
    );
  },
}));

// Mock Alert
jest.spyOn(Alert, 'alert');

describe('SnapReceiptScreen - Camera Integration', () => {
  let mockCameraAdapter: MockCameraAdapter;
  let mockOnClose: jest.Mock;
  let mockProcessReceipt: jest.Mock;
  let mockSaveReceipt: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCameraAdapter = new MockCameraAdapter();
    mockOnClose = jest.fn();
    mockProcessReceipt = jest.fn();
    mockSaveReceipt = jest.fn();

    // Mock useSnapReceipt hook
    const useSnapReceipt = require('../../src/hooks/useSnapReceipt').useSnapReceipt;
    useSnapReceipt.mockReturnValue({
      saveReceipt: mockSaveReceipt,
      processReceipt: mockProcessReceipt,
      loading: false,
      processing: false,
      error: null,
    });
  });

  describe('Camera Button', () => {
    it('should render camera button when OCR enabled and no image provided', () => {
      const { getByTestId } = render(
        <SnapReceiptScreen 
          onClose={mockOnClose} 
          enableOcr={true}
        />
      );

      expect(getByTestId('camera-button')).toBeTruthy();
    });

    it('should not render camera button when OCR disabled', () => {
      const { queryByTestId } = render(
        <SnapReceiptScreen 
          onClose={mockOnClose} 
          enableOcr={false}
        />
      );

      expect(queryByTestId('camera-button')).toBeNull();
    });

    it('should call camera adapter when button pressed', async () => {
      const capturePhotoSpy = jest.spyOn(mockCameraAdapter, 'capturePhoto');
      mockCameraAdapter.setShouldCancel(false);

      const { getByTestId } = render(
        <SnapReceiptScreen 
          onClose={mockOnClose} 
          enableOcr={true}
          cameraAdapter={mockCameraAdapter}
        />
      );

      fireEvent.press(getByTestId('camera-button'));

      await waitFor(() => {
        expect(capturePhotoSpy).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Photo Capture Flow', () => {
    it('should process receipt after successful capture', async () => {
      mockCameraAdapter.setShouldCancel(false);
      mockProcessReceipt.mockResolvedValue({
        vendor: 'Home Depot',
        total: 127.50,
        date: new Date('2026-02-15'),
        confidence: { vendor: 0.9, total: 0.95, date: 0.85 },
        suggestedCorrections: [],
      });

      const { getByTestId } = render(
        <SnapReceiptScreen 
          onClose={mockOnClose} 
          enableOcr={true}
          cameraAdapter={mockCameraAdapter}
        />
      );

      fireEvent.press(getByTestId('camera-button'));

      await waitFor(() => {
        expect(mockProcessReceipt).toHaveBeenCalledWith('file:///mock/path/to/receipt.jpg');
      });
    });

    it('should show loading indicator during OCR processing', async () => {
      // Arrange - Mock hook to show processing UI by passing imageUri
      const useSnapReceipt = require('../../src/hooks/useSnapReceipt').useSnapReceipt;
      useSnapReceipt.mockReturnValue({
        saveReceipt: mockSaveReceipt,
        processReceipt: mockProcessReceipt,
        loading: false,
        processing: true, // Processing state
        error: null,
      });

      mockProcessReceipt.mockImplementation(() => new Promise(() => {})); // Never resolves

      // Act - Render with imageUri to trigger processing
      const { getByText } = render(
        <SnapReceiptScreen 
          onClose={mockOnClose} 
          enableOcr={true}
          imageUri="file:///test/receipt.jpg"
        />
      );

      // Assert - Should show extracting message
      expect(getByText('Extracting receipt details...')).toBeTruthy();
    });

    it('should populate form with parsed data after OCR', async () => {
      const normalizedData = {
        vendor: 'Home Depot',
        total: 127.50,
        date: new Date('2026-02-15'),
        confidence: { vendor: 0.9, total: 0.95, date: 0.85 },
        suggestedCorrections: [],
      };

      mockProcessReceipt.mockResolvedValue(normalizedData);

      const { getByTestId, getByText } = render(
        <SnapReceiptScreen 
          onClose={mockOnClose} 
          enableOcr={true}
          imageUri="file:///captured/receipt.jpg"
        />
      );

      await waitFor(() => {
        expect(getByTestId('receipt-form')).toBeTruthy();
        expect(getByTestId('normalized-vendor').props.children).toBe('Home Depot');
      });
    });
  });

  describe('Cancellation Flow', () => {
    it('should not process receipt when user cancels capture', async () => {
      mockCameraAdapter.setShouldCancel(true);

      const { getByTestId } = render(
        <SnapReceiptScreen 
          onClose={mockOnClose} 
          enableOcr={true}
          cameraAdapter={mockCameraAdapter}
        />
      );

      fireEvent.press(getByTestId('camera-button'));

      await waitFor(() => {
        expect(mockProcessReceipt).not.toHaveBeenCalled();
      });
    });

    it('should remain on screen when user cancels', async () => {
      mockCameraAdapter.setShouldCancel(true);

      const { getByTestId } = render(
        <SnapReceiptScreen 
          onClose={mockOnClose} 
          enableOcr={true}
          cameraAdapter={mockCameraAdapter}
        />
      );

      fireEvent.press(getByTestId('camera-button'));

      await waitFor(() => {
        expect(mockOnClose).not.toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    it('should show error alert when camera permissions denied', async () => {
      mockCameraAdapter.setShouldThrowError(true, 'Camera permission denied');

      const { getByTestId } = render(
        <SnapReceiptScreen 
          onClose={mockOnClose} 
          enableOcr={true}
          cameraAdapter={mockCameraAdapter}
        />
      );

      fireEvent.press(getByTestId('camera-button'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Camera Error',
          expect.stringContaining('permission')
        );
      });
    });

    it('should show error alert when camera unavailable', async () => {
      mockCameraAdapter.setShouldThrowError(true, 'Camera not available');

      const { getByTestId } = render(
        <SnapReceiptScreen 
          onClose={mockOnClose} 
          enableOcr={true}
          cameraAdapter={mockCameraAdapter}
        />
      );

      fireEvent.press(getByTestId('camera-button'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Camera Error',
          expect.stringContaining('not available')
        );
      });
    });

    it('should show error alert when OCR fails', async () => {
      mockProcessReceipt.mockResolvedValue(null);
      
      const useSnapReceipt = require('../../src/hooks/useSnapReceipt').useSnapReceipt;
      useSnapReceipt.mockReturnValue({
        saveReceipt: mockSaveReceipt,
        processReceipt: mockProcessReceipt,
        loading: false,
        processing: false,
        error: 'OCR failed',
      });

      const { getByTestId } = render(
        <SnapReceiptScreen 
          onClose={mockOnClose} 
          enableOcr={true}
          imageUri="file:///captured/receipt.jpg"
        />
      );

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'OCR Error',
          expect.stringContaining('OCR failed')
        );
      });
    });

    it('should offer manual entry fallback after OCR error', async () => {
      mockProcessReceipt.mockResolvedValue(null);

      const { getByTestId } = render(
        <SnapReceiptScreen 
          onClose={mockOnClose} 
          enableOcr={true}
          imageUri="file:///captured/receipt.jpg"
        />
      );

      await waitFor(() => {
        expect(getByTestId('receipt-form')).toBeTruthy();
      });
    });
  });

  describe('Manual Entry Fallback', () => {
    it('should show manual entry option alongside camera button', () => {
      const { getByTestId, getByText } = render(
        <SnapReceiptScreen 
          onClose={mockOnClose} 
          enableOcr={true}
        />
      );

      expect(getByTestId('camera-button')).toBeTruthy();
      expect(getByText(/or enter manually/i)).toBeTruthy();
    });

    it('should allow direct manual entry without camera', () => {
      const { getByTestId } = render(
        <SnapReceiptScreen 
          onClose={mockOnClose} 
          enableOcr={false}
        />
      );

      expect(getByTestId('receipt-form')).toBeTruthy();
    });
  });
});
