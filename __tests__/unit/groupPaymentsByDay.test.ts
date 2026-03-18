/**
 * Unit tests for getPaymentDateKey and groupPaymentsByDay.
 *
 * Covers:
 *  - getPaymentDateKey: dueDate preference, date fallback, null when neither
 *  - groupPaymentsByDay: bucketing, sorting, undated payments, empty input
 */

import {
  getPaymentDateKey,
  groupPaymentsByDay,
} from '../../src/hooks/usePaymentsTimeline';
import { Payment } from '../../src/domain/entities/Payment';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePayment(overrides: Partial<Payment> & { id: string }): Payment {
  return {
    amount: 0,
    ...overrides,
  };
}

// ─── getPaymentDateKey ────────────────────────────────────────────────────────

describe('getPaymentDateKey', () => {
  it('returns ISO date from dueDate when present', () => {
    const p = makePayment({ id: 'p1', dueDate: '2024-03-15T12:00:00.000Z' });
    expect(getPaymentDateKey(p)).toBe('2024-03-15');
  });

  it('falls back to date when dueDate is absent', () => {
    const p = makePayment({ id: 'p2', date: '2024-05-20T00:00:00.000Z' });
    expect(getPaymentDateKey(p)).toBe('2024-05-20');
  });

  it('prefers dueDate over date when both are set', () => {
    const p = makePayment({
      id: 'p3',
      dueDate: '2024-06-01T00:00:00Z',
      date: '2024-01-01T00:00:00Z',
    });
    expect(getPaymentDateKey(p)).toBe('2024-06-01');
  });

  it('returns null when neither dueDate nor date is set', () => {
    const p = makePayment({ id: 'p4' });
    expect(getPaymentDateKey(p)).toBeNull();
  });
});

// ─── groupPaymentsByDay ───────────────────────────────────────────────────────

describe('groupPaymentsByDay', () => {
  it('groups payments into separate day buckets', () => {
    const payments = [
      makePayment({ id: 'p1', dueDate: '2024-03-10T09:00:00Z' }),
      makePayment({ id: 'p2', dueDate: '2024-03-10T14:00:00Z' }),
      makePayment({ id: 'p3', dueDate: '2024-03-20T08:00:00Z' }),
    ];
    const groups = groupPaymentsByDay(payments);
    expect(groups).toHaveLength(2);
    expect(groups[0].date).toBe('2024-03-10');
    expect(groups[0].payments).toHaveLength(2);
    expect(groups[1].date).toBe('2024-03-20');
    expect(groups[1].payments).toHaveLength(1);
  });

  it('sorts day buckets ascending by date', () => {
    const payments = [
      makePayment({ id: 'p1', dueDate: '2025-01-05T08:00:00Z' }),
      makePayment({ id: 'p2', dueDate: '2024-12-20T09:00:00Z' }),
    ];
    const groups = groupPaymentsByDay(payments);
    expect(groups[0].date).toBe('2024-12-20');
    expect(groups[1].date).toBe('2025-01-05');
  });

  it('sorts payments within a day bucket by dueDate ascending', () => {
    const payments = [
      makePayment({ id: 'p1', amount: 200, dueDate: '2024-03-10T14:00:00Z' }),
      makePayment({ id: 'p2', amount: 100, dueDate: '2024-03-10T09:00:00Z' }),
    ];
    const groups = groupPaymentsByDay(payments);
    expect(groups[0].payments[0].amount).toBe(100);
    expect(groups[0].payments[1].amount).toBe(200);
  });

  it('appends undated payments in a trailing __nodate__ bucket', () => {
    const payments = [
      makePayment({ id: 'p1', dueDate: '2024-03-10T09:00:00Z' }),
      makePayment({ id: 'p2' }), // no date fields
    ];
    const groups = groupPaymentsByDay(payments);
    expect(groups).toHaveLength(2);
    expect(groups[groups.length - 1].date).toBe('__nodate__');
    expect(groups[groups.length - 1].label).toBe('No Date');
  });

  it('returns empty array for empty input', () => {
    expect(groupPaymentsByDay([])).toEqual([]);
  });

  it('uses date field as fallback when dueDate is absent', () => {
    const p = makePayment({ id: 'p1', date: '2024-04-22T00:00:00Z' });
    const groups = groupPaymentsByDay([p]);
    expect(groups[0].date).toBe('2024-04-22');
  });

  it('labels group with human-readable date string', () => {
    const p = makePayment({ id: 'p1', dueDate: '2024-03-15T00:00:00Z' });
    const groups = groupPaymentsByDay([p]);
    // "Fri 15 Mar" — just check the day and month appear
    expect(groups[0].label).toMatch(/15/);
    expect(groups[0].label).toMatch(/Mar/);
  });
});
