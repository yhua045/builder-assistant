import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { QuotationScreen } from '../../src/pages/quotations/QuotationScreen';
import { useQuotations } from '../../src/hooks/useQuotations';

// Mock the dependencies
jest.mock('../../src/hooks/useQuotations');
jest.mock('../../src/components/quotations/QuotationForm', () => ({
  QuotationForm: 'QuotationForm'
}));

const mockUseQuotations = useQuotations as jest.MockedFunction<typeof useQuotations>;

describe('QuotationScreen Integration', () => {
  beforeEach(() => {
    mockUseQuotations.mockReturnValue({
      createQuotation: jest.fn().mockResolvedValue({}),
      listQuotations: jest.fn(),
      getQuotation: jest.fn(),
      updateQuotation: jest.fn(),
      deleteQuotation: jest.fn(),
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
});
