/**
 * Unit tests for getFeedItemDateKey and groupFeedItemsByDay.
 *
 * Ported from the original groupPaymentsByDay tests (issue #157) to reflect the
 * migration from Payment[] to PaymentFeedItem[] (issue #199).
 *
 * Covers:
 *  - getFeedItemDateKey: dueDate preference, date fallback, null when neither
 *  - groupFeedItemsByDay: bucketing, sorting, undated items, empty input
 */

import {
  getFeedItemDateKey,
  groupFeedItemsByDay,
} from '../../src/hooks/usePaymentsTimeline';
import { PaymentFeedItem } from '../../src/domain/entities/PaymentFeedItem';
import { Payment } from '../../src/domain/entities/Payment';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePaymentItem(overrides: Partial<Payment> & { id: string }): PaymentFeedItem {
  return {
    kind: 'payment',
    data: {
      amount: 0,
      ...overrides,
    },
  };
}

// ─── getFeedItemDateKey ───────────────────────────────────────────────────────

describe('getFeedItemDateKey', () => {
  it('returns ISO date from dueDate when present', () => {
    const item = makePaymentItem({ id: 'p1', dueDate: '2024-03-15T12:00:00.000Z' });
    expect(getFeedItemDateKey(item)).toBe('2024-03-15');
  });

  it('falls back to date when dueDate is absent', () => {
    const item = makePaymentItem({ id: 'p2', date: '2024-05-20T00:00:00.000Z' });
    expect(getFeedItemDateKey(item)).toBe('2024-05-20');
  });

  it('prefers dueDate over date when both are set', () => {
    const item = makePaymentItem({
      id: 'p3',
      dueDate: '2024-06-01T00:00:00Z',
      date: '2024-01-01T00:00:00Z',
    });
    expect(getFeedItemDateKey(item)).toBe('2024-06-01');
  });

  it('returns null when neither dueDate nor date is set', () => {
    const item = makePaymentItem({ id: 'p4' });
    expect(getFeedItemDateKey(item)).toBeNull();
  });
});

// ─── groupFeedItemsByDay ──────────────────────────────────────────────────────

describe('groupFeedItemsByDay', () => {
  it('groups payment items into separate day buckets', () => {
    const items = [
      makePaymentItem({ id: 'p1', dueDate: '2024-03-10T09:00:00Z' }),
      makePaymentItem({ id: 'p2', dueDate: '2024-03-10T14:00:00Z' }),
      makePaymentItem({ id: 'p3', dueDate: '2024-03-20T08:00:00Z' }),
    ];
    const groups = groupFeedItemsByDay(items);
    expect(groups).toHaveLength(2);
    expect(groups[0].date).toBe('2024-03-10');
    expect(groups[0].items).toHaveLength(2);
    expect(groups[1].date).toBe('2024-03-20');
    expect(groups[1].items).toHaveLength(1);
  });

  it('sorts day buckets ascending by date', () => {
    const items = [
      makePaymentItem({ id: 'p1', dueDate: '2025-01-05T08:00:00Z' }),
      makePaymentItem({ id: 'p2', dueDate: '2024-12-20T09:00:00Z' }),
    ];
    const groups = groupFeedItemsByDay(items);
    expect(groups[0].date).toBe('2024-12-20');
    expect(groups[1].date).toBe('2025-01-05');
  });

  it('appends undated items in a trailing __nodate__ bucket', () => {
    const items = [
      makePaymentItem({ id: 'p1', dueDate: '2024-03-10T09:00:00Z' }),
      makePaymentItem({ id: 'p2' }), // no date fields
    ];
    const groups = groupFeedItemsByDay(items);
    expect(groups).toHaveLength(2);
    expect(groups[groups.length - 1].date).toBe('__nodate__');
    expect(groups[groups.length - 1].label).toBe('No Date');
  });

  it('returns empty array for empty input', () => {
    expect(groupFeedItemsByDay([])).toEqual([]);
  });

  it('uses date field as fallback when dueDate is absent', () => {
    const item = makePaymentItem({ id: 'p1', date: '2024-04-22T00:00:00Z' });
    const groups = groupFeedItemsByDay([item]);
    expect(groups[0].date).toBe('2024-04-22');
  });

  it('labels group with human-readable date string', () => {
    const item = makePaymentItem({ id: 'p1', dueDate: '2024-03-15T00:00:00Z' });
    const groups = groupFeedItemsByDay([item]);
    // "Fri 15 Mar" — just check the day and month appear
    expect(groups[0].label).toMatch(/15/);
    expect(groups[0].label).toMatch(/Mar/);
  });
});
