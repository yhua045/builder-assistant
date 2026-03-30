/**
 * Unit tests for sortByPaidDateDesc utility
 * Run: npx jest sortByPaidDateDesc
 */
import { sortByPaidDateDesc } from '../../../src/utils/sortByPaymentPriority';
import type { Payment } from '../../../src/domain/entities/Payment';

const paid = (id: string, date: string): Payment => ({
  id,
  amount: 100,
  date,
  status: 'settled',
});

const noDate = (id: string): Payment => ({
  id,
  amount: 50,
  status: 'settled',
});

describe('sortByPaidDateDesc', () => {
  it('places newest date first', () => {
    const input: Payment[] = [
      paid('a', '2026-01-01'),
      paid('b', '2026-03-01'),
      paid('c', '2026-02-01'),
    ];
    const result = sortByPaidDateDesc(input);
    expect(result.map((p) => p.id)).toEqual(['b', 'c', 'a']);
  });

  it('places no-date items last', () => {
    const input: Payment[] = [paid('a', '2026-01-01'), noDate('nodate')];
    const result = sortByPaidDateDesc(input);
    expect(result[result.length - 1].id).toBe('nodate');
  });

  it('places a later date before an earlier date', () => {
    const input: Payment[] = [paid('early', '2025-06-01'), paid('late', '2026-01-01')];
    const result = sortByPaidDateDesc(input);
    expect(result[0].id).toBe('late');
    expect(result[1].id).toBe('early');
  });

  it('does not mutate the input array', () => {
    const input: Payment[] = [paid('a', '2026-01-01'), paid('b', '2026-03-01')];
    const copy = [...input];
    sortByPaidDateDesc(input);
    expect(input[0].id).toBe(copy[0].id);
    expect(input[1].id).toBe(copy[1].id);
  });

  it('returns empty array for empty input', () => {
    expect(sortByPaidDateDesc([])).toEqual([]);
  });
});
