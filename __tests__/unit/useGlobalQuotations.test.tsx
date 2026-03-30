/**
 * Unit tests for useGlobalQuotations hook
 * Run: npx jest useGlobalQuotations
 */
import { act } from '@testing-library/react-native';
import { useGlobalQuotations } from '../../src/hooks/useGlobalQuotations';
import { renderHookWithQuery } from '../utils/queryClientWrapper';
import type { Quotation } from '../../src/domain/entities/Quotation';

// Mock infrastructure layer
jest.mock('../../src/infrastructure/repositories/DrizzleQuotationRepository', () => ({
  DrizzleQuotationRepository: jest.fn().mockImplementation(() => ({})),
}));

// Mock the use case
jest.mock('../../src/application/usecases/quotation/ListQuotationsUseCase');
import { ListQuotationsUseCase } from '../../src/application/usecases/quotation/ListQuotationsUseCase';

const mockQuotations: Quotation[] = [
  {
    id: 'q1',
    reference: 'QT-001',
    date: '2026-03-20',
    total: 5000,
    vendorName: 'Ace Plumbing',
    status: 'sent',
    currency: 'AUD',
    createdAt: '2026-03-20T00:00:00Z',
    updatedAt: '2026-03-20T00:00:00Z',
  },
  {
    id: 'q2',
    reference: 'QT-002',
    date: '2026-01-10',
    total: 3000,
    vendorName: 'Beta Electric',
    status: 'accepted',
    currency: 'AUD',
    createdAt: '2026-01-10T00:00:00Z',
    updatedAt: '2026-01-10T00:00:00Z',
  },
  {
    id: 'q3',
    reference: 'QT-003',
    date: '2026-03-25',
    total: 7000,
    vendorName: 'Ace Builders',
    status: 'draft',
    currency: 'AUD',
    createdAt: '2026-03-25T00:00:00Z',
    updatedAt: '2026-03-25T00:00:00Z',
  },
];

describe('useGlobalQuotations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (ListQuotationsUseCase as any).prototype.execute = jest
      .fn()
      .mockResolvedValue({ items: mockQuotations, total: mockQuotations.length });
  });

  it('returns quotations sorted by date descending', async () => {
    const { result } = renderHookWithQuery(() => useGlobalQuotations());

    await act(async () => {
      await new Promise((r) => setTimeout(() => r(null), 50));
    });

    // q3 (Mar 25) → q1 (Mar 20) → q2 (Jan 10)
    expect(result.current.quotations[0].id).toBe('q3');
    expect(result.current.quotations[1].id).toBe('q1');
    expect(result.current.quotations[2].id).toBe('q2');
  });

  it('filters by vendorSearch case-insensitively', async () => {
    const { result } = renderHookWithQuery(() =>
      useGlobalQuotations({ vendorSearch: 'ace' }),
    );

    await act(async () => {
      await new Promise((r) => setTimeout(() => r(null), 50));
    });

    // Matches 'Ace Plumbing' and 'Ace Builders'
    expect(result.current.quotations).toHaveLength(2);
    expect(result.current.quotations.every((q: any) =>
      q.vendorName?.toLowerCase().includes('ace'),
    )).toBe(true);
  });

  it('returns all quotations when no vendorSearch provided', async () => {
    const { result } = renderHookWithQuery(() => useGlobalQuotations());

    await act(async () => {
      await new Promise((r) => setTimeout(() => r(null), 50));
    });

    expect(result.current.quotations).toHaveLength(3);
  });

  it('exposes a refresh function', () => {
    const { result } = renderHookWithQuery(() => useGlobalQuotations());
    expect(typeof result.current.refresh).toBe('function');
  });

  it('exposes a loading boolean', () => {
    const { result } = renderHookWithQuery(() => useGlobalQuotations());
    expect(typeof result.current.loading).toBe('boolean');
  });

  it('returns empty array while still loading', () => {
    (ListQuotationsUseCase as any).prototype.execute = jest
      .fn()
      .mockReturnValue(new Promise(() => {})); // never resolves

    const { result } = renderHookWithQuery(() => useGlobalQuotations());
    expect(result.current.quotations).toEqual([]);
  });
});
