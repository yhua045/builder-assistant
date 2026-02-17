import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { ExtractionResultsPanel } from '../../src/components/invoices/ExtractionResultsPanel';
import { NormalizedInvoice } from '../../src/application/ai/IInvoiceNormalizer';

describe('ExtractionResultsPanel', () => {
  const mockOnAccept = jest.fn();
  const mockOnRetry = jest.fn();
  const mockOnEdit = jest.fn();

  const mockExtractionResult: NormalizedInvoice = {
    vendor: 'ACME Construction',
    invoiceNumber: 'INV-2024-001',
    invoiceDate: new Date('2024-02-15'),
    dueDate: new Date('2024-03-15'),
    subtotal: 13000,
    tax: 2000,
    total: 15000,
    currency: 'USD',
    lineItems: [
      { description: 'Labor - Framing', quantity: 40, unitPrice: 150, total: 6000 },
      { description: 'Materials - Lumber', quantity: 1, unitPrice: 7000, total: 7000 },
    ],
    confidence: {
      overall: 0.85,
      vendor: 0.9,
      invoiceNumber: 0.8,
      invoiceDate: 0.85,
      total: 0.95,
    },
    suggestedCorrections: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render extraction results', () => {
    const { getByDisplayValue, getByText } = render(
      <ExtractionResultsPanel
        extractionResult={mockExtractionResult}
        onAccept={mockOnAccept}
        onRetry={mockOnRetry}
        onEdit={mockOnEdit}
      />
    );

    // Vendor and invoice number are in editable inputs
    expect(getByDisplayValue('ACME Construction')).toBeTruthy();
    expect(getByDisplayValue('INV-2024-001')).toBeTruthy();
    // Line item totals are shown as formatted currency text
    expect(getByText('$6,000.00')).toBeTruthy();
    expect(getByText('$7,000.00')).toBeTruthy();
  });

  it('should display confidence indicators', () => {
    const { getByTestId } = render(
      <ExtractionResultsPanel
        extractionResult={mockExtractionResult}
        onAccept={mockOnAccept}
        onRetry={mockOnRetry}
        onEdit={mockOnEdit}
      />
    );

    expect(getByTestId('confidence-overall')).toBeTruthy();
    expect(getByTestId('confidence-vendor')).toBeTruthy();
  });

  it('should show high confidence as green', () => {
    const { getByTestId } = render(
      <ExtractionResultsPanel
        extractionResult={mockExtractionResult}
        onAccept={mockOnAccept}
        onRetry={mockOnRetry}
        onEdit={mockOnEdit}
      />
    );

    const vendorConfidence = getByTestId('confidence-vendor');
    expect(vendorConfidence.props.accessibilityLabel).toContain('high');
  });

  it('should show medium confidence as yellow', () => {
    const lowConfidenceResult: NormalizedInvoice = {
      ...mockExtractionResult,
      confidence: {
        overall: 0.6,
        vendor: 0.6,
        invoiceNumber: 0.5,
        invoiceDate: 0.7,
        total: 0.6,
      },
    };

    const { getByTestId } = render(
      <ExtractionResultsPanel
        extractionResult={lowConfidenceResult}
        onAccept={mockOnAccept}
        onRetry={mockOnRetry}
        onEdit={mockOnEdit}
      />
    );

    const vendorConfidence = getByTestId('confidence-vendor');
    expect(vendorConfidence.props.accessibilityLabel).toContain('medium');
  });

  it('should show low confidence as red', () => {
    const veryLowConfidenceResult: NormalizedInvoice = {
      ...mockExtractionResult,
      confidence: {
        overall: 0.3,
        vendor: 0.4,
        invoiceNumber: 0.3,
        invoiceDate: 0.2,
        total: 0.4,
      },
    };

    const { getByTestId } = render(
      <ExtractionResultsPanel
        extractionResult={veryLowConfidenceResult}
        onAccept={mockOnAccept}
        onRetry={mockOnRetry}
        onEdit={mockOnEdit}
      />
    );

    const vendorConfidence = getByTestId('confidence-vendor');
    expect(vendorConfidence.props.accessibilityLabel).toContain('low');
  });

  it('should display line items', () => {
    const { getByText } = render(
      <ExtractionResultsPanel
        extractionResult={mockExtractionResult}
        onAccept={mockOnAccept}
        onRetry={mockOnRetry}
        onEdit={mockOnEdit}
      />
    );

    expect(getByText('Labor - Framing')).toBeTruthy();
    expect(getByText('Materials - Lumber')).toBeTruthy();
  });

  it('should allow inline editing of vendor', async () => {
    const { getByTestId } = render(
      <ExtractionResultsPanel
        extractionResult={mockExtractionResult}
        onAccept={mockOnAccept}
        onRetry={mockOnRetry}
        onEdit={mockOnEdit}
      />
    );

    const vendorInput = getByTestId('edit-vendor');
    fireEvent.changeText(vendorInput, 'Updated Vendor');

    expect(mockOnEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        vendor: 'Updated Vendor',
      })
    );
  });

  it('should allow inline editing of total', async () => {
    const { getByTestId } = render(
      <ExtractionResultsPanel
        extractionResult={mockExtractionResult}
        onAccept={mockOnAccept}
        onRetry={mockOnRetry}
        onEdit={mockOnEdit}
      />
    );

    const totalInput = getByTestId('edit-total');
    fireEvent.changeText(totalInput, '16000');

    expect(mockOnEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        total: 16000,
      })
    );
  });

  it('should call onAccept when Accept button is pressed', () => {
    const { getByText } = render(
      <ExtractionResultsPanel
        extractionResult={mockExtractionResult}
        onAccept={mockOnAccept}
        onRetry={mockOnRetry}
        onEdit={mockOnEdit}
      />
    );

    const acceptButton = getByText(/Accept|Save/i);
    fireEvent.press(acceptButton);

    expect(mockOnAccept).toHaveBeenCalledWith(mockExtractionResult);
  });

  it('should call onRetry when Retry button is pressed', () => {
    const { getByTestId } = render(
      <ExtractionResultsPanel
        extractionResult={mockExtractionResult}
        onAccept={mockOnAccept}
        onRetry={mockOnRetry}
        onEdit={mockOnEdit}
      />
    );

    const retryButton = getByTestId('retry-button');
    fireEvent.press(retryButton);

    expect(mockOnRetry).toHaveBeenCalled();
  });

  it('should display suggested corrections', () => {
    const resultWithSuggestions: NormalizedInvoice = {
      ...mockExtractionResult,
      suggestedCorrections: [
        'Please verify vendor name',
        'Please verify total amount',
      ],
    };

    const { getByText } = render(
      <ExtractionResultsPanel
        extractionResult={resultWithSuggestions}
        onAccept={mockOnAccept}
        onRetry={mockOnRetry}
        onEdit={mockOnEdit}
      />
    );

    expect(getByText(/verify vendor name/i)).toBeTruthy();
    expect(getByText(/verify total amount/i)).toBeTruthy();
  });

  it('should show overall confidence badge', () => {
    const { getByTestId } = render(
      <ExtractionResultsPanel
        extractionResult={mockExtractionResult}
        onAccept={mockOnAccept}
        onRetry={mockOnRetry}
        onEdit={mockOnEdit}
      />
    );

    const badge = getByTestId('confidence-overall');
    expect(badge).toBeTruthy();
    // Badge contains confidence percentage (verified by component logic)
  });

  it('should format dates properly', () => {
    const { getByText } = render(
      <ExtractionResultsPanel
        extractionResult={mockExtractionResult}
        onAccept={mockOnAccept}
        onRetry={mockOnRetry}
        onEdit={mockOnEdit}
      />
    );

    // Date should be formatted (e.g., "Feb 15, 2024")
    expect(getByText('Feb 15, 2024')).toBeTruthy();
  });

  it('should format currency amounts properly', () => {
    const { getByText } = render(
      <ExtractionResultsPanel
        extractionResult={mockExtractionResult}
        onAccept={mockOnAccept}
        onRetry={mockOnRetry}
        onEdit={mockOnEdit}
      />
    );

    // Should show formatted amounts with currency symbol
    expect(getByText('$13,000.00')).toBeTruthy();
    expect(getByText('USD')).toBeTruthy();
  });

  it('should disable Accept button when confidence is very low', () => {
    const veryLowConfidenceResult: NormalizedInvoice = {
      ...mockExtractionResult,
      confidence: {
        overall: 0.2,
        vendor: 0.1,
        invoiceNumber: 0.2,
        invoiceDate: 0.3,
        total: 0.15,
      },
    };

    const { getByTestId } = render(
      <ExtractionResultsPanel
        extractionResult={veryLowConfidenceResult}
        onAccept={mockOnAccept}
        onRetry={mockOnRetry}
        onEdit={mockOnEdit}
      />
    );

    const acceptButton = getByTestId('accept-button');
    expect(acceptButton.props.accessibilityState.disabled).toBe(true);
  });

  it('should handle null values gracefully', () => {
    const incompleteResult: NormalizedInvoice = {
      ...mockExtractionResult,
      vendor: null,
      invoiceNumber: null,
      invoiceDate: null,
      dueDate: null,
      subtotal: null,
      tax: null,
    };

    const { getByPlaceholderText, getAllByText } = render(
      <ExtractionResultsPanel
        extractionResult={incompleteResult}
        onAccept={mockOnAccept}
        onRetry={mockOnRetry}
        onEdit={mockOnEdit}
      />
    );

    // Should show "Not detected" for null date values (multiple instances)
    const notDetectedElements = getAllByText('Not detected');
    expect(notDetectedElements.length).toBeGreaterThan(0);
    // Should show placeholder for null input values
    expect(getByPlaceholderText('Vendor name not detected')).toBeTruthy();
  });
});
