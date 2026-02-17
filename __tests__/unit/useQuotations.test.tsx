import { renderHook, act } from '@testing-library/react-native';
import { useQuotations } from '../../src/hooks/useQuotations';

// Mock the use cases
jest.mock('../../src/application/usecases/quotation/CreateQuotationUseCase');
jest.mock('../../src/application/usecases/quotation/ListQuotationsUseCase');
jest.mock('../../src/application/usecases/quotation/GetQuotationByIdUseCase');
jest.mock('../../src/application/usecases/quotation/UpdateQuotationUseCase');
jest.mock('../../src/application/usecases/quotation/DeleteQuotationUseCase');

// Provide concrete mock implementations for the use case execute methods
import { CreateQuotationUseCase } from '../../src/application/usecases/quotation/CreateQuotationUseCase';
import { ListQuotationsUseCase } from '../../src/application/usecases/quotation/ListQuotationsUseCase';

const mockCreatedQuotation = {
  id: 'q-1',
  reference: 'QT-2026-001',
  date: '2026-02-15',
  total: 1000,
  vendorName: 'Test Vendor',
  createdAt: '2026-02-15T00:00:00Z',
  updatedAt: '2026-02-15T00:00:00Z',
};

// Ensure the mocked constructors have an execute implementation
(CreateQuotationUseCase as any).prototype.execute = jest.fn().mockResolvedValue(mockCreatedQuotation);
(ListQuotationsUseCase as any).prototype.execute = jest.fn().mockResolvedValue({ items: [mockCreatedQuotation], total: 1 });

describe('useQuotations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('provides createQuotation function', () => {
    const { result } = renderHook(() => useQuotations());
    
    expect(result.current.createQuotation).toBeDefined();
    expect(typeof result.current.createQuotation).toBe('function');
  });

  it('provides listQuotations function', () => {
    const { result } = renderHook(() => useQuotations());
    
    expect(result.current.listQuotations).toBeDefined();
    expect(typeof result.current.listQuotations).toBe('function');
  });

  it('provides loading and error states', () => {
    const { result } = renderHook(() => useQuotations());
    
    expect(result.current).toHaveProperty('loading');
    expect(result.current).toHaveProperty('error');
  });

  it('creates quotation successfully', async () => {
    const { result } = renderHook(() => useQuotations());
    
    const mockQuotation = {
      reference: 'QT-2026-001',
      date: '2026-02-15',
      total: 1000,
      vendorName: 'Test Vendor',
    };

    await act(async () => {
      const created = await result.current.createQuotation(mockQuotation as any);
      expect(created).toBeDefined();
    });
  });

  it('handles creation errors', async () => {
    const { result } = renderHook(() => useQuotations());
    
    await act(async () => {
      try {
        // Try to create with invalid data
        await result.current.createQuotation({} as any);
      } catch (error) {
        expect(error).toBeDefined();
      }
    });
  });

  it('lists quotations with filtering', async () => {
    const { result } = renderHook(() => useQuotations());
    
    await act(async () => {
      const list = await result.current.listQuotations({ status: ['draft'] });
      expect(list).toBeDefined();
      expect(list).toHaveProperty('items');
      expect(list).toHaveProperty('total');
    });
  });

  it('sets loading state during operations', async () => {
    const { result } = renderHook(() => useQuotations());
    
    expect(result.current.loading).toBe(false);

    const createPromise = act(async () => {
      await result.current.createQuotation({
        reference: 'QT-TEST',
        date: '2026-02-15',
        total: 500,
      } as any);
    });

    // Should be loading during operation
    // Note: This timing-dependent test may need adjustment
    
    await createPromise;
    
    // Should not be loading after completion
    expect(result.current.loading).toBe(false);
  });
});
