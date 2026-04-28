/**
 * Unit tests for sortByPaymentPriority utility
 * Run: npx jest sortByPaymentPriority
 */
import { sortByPaymentPriority } from '../../utils/sortByPaymentPriority';
import type { Payment } from '../../../../domain/entities/Payment';

const NOW = new Date('2026-03-30T12:00:00Z');

const overdue = (id: string, daysAgo: number): Payment => ({
  id,
  amount: 100,
  dueDate: new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString(),
  status: 'pending',
});

const future = (id: string, daysFromNow: number): Payment => ({
  id,
  amount: 100,
  dueDate: new Date(NOW.getTime() + daysFromNow * 86_400_000).toISOString(),
  status: 'pending',
});

const noDate = (id: string): Payment => ({
  id,
  amount: 100,
  status: 'pending',
});

describe('sortByPaymentPriority', () => {
  beforeAll(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
  });

  afterAll(() => {
    jest.useRealTimers();
  });

  it('places overdue items before future items', () => {
    const input = [future('future', 5), overdue('overdue', 3)];
    const result = sortByPaymentPriority(input);
    expect(result[0].id).toBe('overdue');
    expect(result[1].id).toBe('future');
  });

  it('sorts overdue items most overdue first (ascending dueDate)', () => {
    const input = [overdue('7days', 7), overdue('2days', 2), overdue('14days', 14)];
    const result = sortByPaymentPriority(input);
    expect(result.map((p) => p.id)).toEqual(['14days', '7days', '2days']);
  });

  it('sorts future items ascending by due date', () => {
    const input = [future('10days', 10), future('2days', 2), future('5days', 5)];
    const result = sortByPaymentPriority(input);
    expect(result.map((p) => p.id)).toEqual(['2days', '5days', '10days']);
  });

  it('places no-due-date items last', () => {
    const input = [noDate('nd'), future('f', 3), overdue('o', 2)];
    const result = sortByPaymentPriority(input);
    expect(result[result.length - 1].id).toBe('nd');
  });

  it('handles multiple no-date items trailing after dated items', () => {
    const input = [noDate('nd1'), overdue('o', 1), noDate('nd2'), future('f', 2)];
    const result = sortByPaymentPriority(input);
    expect(result[0].id).toBe('o');
    expect(result[1].id).toBe('f');
    const last2 = result.slice(-2).map((p) => p.id);
    expect(last2).toContain('nd1');
    expect(last2).toContain('nd2');
  });

  it('does not mutate the input array', () => {
    const input = [future('f', 3), overdue('o', 2)];
    const copy = [...input];
    sortByPaymentPriority(input);
    expect(input[0].id).toBe(copy[0].id);
    expect(input[1].id).toBe(copy[1].id);
  });

  it('returns empty array for empty input', () => {
    expect(sortByPaymentPriority([])).toEqual([]);
  });
});
