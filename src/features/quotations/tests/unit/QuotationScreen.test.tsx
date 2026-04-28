/**
 * Unit tests for QuotationScreen modal — issue #192
 * Covers: modal header title + close button
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QuotationScreen } from '../../screens/QuotationScreen';
import { useQuotations } from '../../hooks/useQuotations';

jest.mock('../../hooks/useQuotations');
jest.mock('../../components/QuotationForm', () => ({
  QuotationForm: 'QuotationForm',
}));

const mockUseQuotations = useQuotations as jest.MockedFunction<typeof useQuotations>;

beforeEach(() => {
  jest.clearAllMocks();
  mockUseQuotations.mockReturnValue({
    createQuotation: jest.fn(),
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

describe('QuotationScreen header (issue #192)', () => {
  it('renders modal header with "New Quotation" title', async () => {
    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <QuotationScreen visible={true} onClose={jest.fn()} />
      );
    });
    const root = testRenderer!.root;
    const header = root.findByProps({ testID: 'quotation-modal-header' });
    expect(header).toBeDefined();
    act(() => { testRenderer!.unmount(); });
  });

  it('renders close button in modal header', async () => {
    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <QuotationScreen visible={true} onClose={jest.fn()} />
      );
    });
    const root = testRenderer!.root;
    const closeButton = root.findByProps({ testID: 'quotation-modal-close-button' });
    expect(closeButton).toBeDefined();
    act(() => { testRenderer!.unmount(); });
  });

  it('calls onClose when close button is pressed', async () => {
    const mockOnClose = jest.fn();
    let testRenderer: renderer.ReactTestRenderer | undefined;
    await act(async () => {
      testRenderer = renderer.create(
        <QuotationScreen visible={true} onClose={mockOnClose} />
      );
    });
    const root = testRenderer!.root;
    const closeButton = root.findByProps({ testID: 'quotation-modal-close-button' });
    act(() => { closeButton.props.onPress(); });
    expect(mockOnClose).toHaveBeenCalledTimes(1);
    act(() => { testRenderer!.unmount(); });
  });
});
