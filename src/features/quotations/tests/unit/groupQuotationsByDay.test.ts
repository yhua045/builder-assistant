/**
 * Unit tests for getQuotationDateKey and groupQuotationsByDay.
 *
 * Covers:
 *  - getQuotationDateKey: date extraction, null when absent
 *  - groupQuotationsByDay: bucketing, sorting, undated quotations, empty input
 */

import {
  getQuotationDateKey,
  groupQuotationsByDay,
} from '../../../projects/hooks/useQuotationsTimeline';
import { Quotation } from '../../../../domain/entities/Quotation';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeQuotation(
  overrides: Partial<Quotation> & { id: string; date: string },
): Quotation {
  return {
    reference: `QT-${overrides.id}`,
    total: 0,
    currency: 'AUD',
    status: 'draft',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function makeUndatedQuotation(
  overrides: Omit<Partial<Quotation>, 'date'> & { id: string },
): Quotation {
  return {
    reference: `QT-${overrides.id}`,
    total: 0,
    currency: 'AUD',
    status: 'draft',
    date: undefined as unknown as string, // intentionally absent
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ─── getQuotationDateKey ──────────────────────────────────────────────────────

describe('getQuotationDateKey', () => {
  it('returns ISO date from quotation.date', () => {
    const q = makeQuotation({ id: 'q1', date: '2024-04-10T09:00:00.000Z' });
    expect(getQuotationDateKey(q)).toBe('2024-04-10');
  });

  it('returns null when date is absent', () => {
    const q = makeUndatedQuotation({ id: 'q2' });
    expect(getQuotationDateKey(q)).toBeNull();
  });
});

// ─── groupQuotationsByDay ─────────────────────────────────────────────────────

describe('groupQuotationsByDay', () => {
  it('groups quotations into separate day buckets', () => {
    const quotations = [
      makeQuotation({ id: 'q1', date: '2024-04-10T09:00:00Z' }),
      makeQuotation({ id: 'q2', date: '2024-04-10T15:00:00Z' }),
      makeQuotation({ id: 'q3', date: '2024-04-20T09:00:00Z' }),
    ];
    const groups = groupQuotationsByDay(quotations);
    expect(groups).toHaveLength(2);
    expect(groups[0].date).toBe('2024-04-10');
    expect(groups[0].quotations).toHaveLength(2);
    expect(groups[1].date).toBe('2024-04-20');
    expect(groups[1].quotations).toHaveLength(1);
  });

  it('sorts day buckets ascending by date', () => {
    const quotations = [
      makeQuotation({ id: 'q1', date: '2025-02-01T08:00:00Z' }),
      makeQuotation({ id: 'q2', date: '2024-11-15T09:00:00Z' }),
    ];
    const groups = groupQuotationsByDay(quotations);
    expect(groups[0].date).toBe('2024-11-15');
    expect(groups[1].date).toBe('2025-02-01');
  });

  it('sorts quotations within a day bucket by date ascending', () => {
    const quotations = [
      makeQuotation({ id: 'q1', total: 2000, date: '2024-04-10T15:00:00Z' }),
      makeQuotation({ id: 'q2', total: 1000, date: '2024-04-10T09:00:00Z' }),
    ];
    const groups = groupQuotationsByDay(quotations);
    expect(groups[0].quotations[0].total).toBe(1000);
    expect(groups[0].quotations[1].total).toBe(2000);
  });

  it('appends undated quotations in a trailing __nodate__ bucket', () => {
    const quotations = [
      makeQuotation({ id: 'q1', date: '2024-04-10T09:00:00Z' }),
      makeUndatedQuotation({ id: 'q2' }),
    ];
    const groups = groupQuotationsByDay(quotations);
    expect(groups).toHaveLength(2);
    expect(groups[groups.length - 1].date).toBe('__nodate__');
    expect(groups[groups.length - 1].label).toBe('No Date');
  });

  it('returns empty array for empty input', () => {
    expect(groupQuotationsByDay([])).toEqual([]);
  });

  it('labels group with human-readable date string', () => {
    const q = makeQuotation({ id: 'q1', date: '2024-04-12T00:00:00Z' });
    const groups = groupQuotationsByDay([q]);
    // "Fri 12 Apr"
    expect(groups[0].label).toMatch(/12/);
    expect(groups[0].label).toMatch(/Apr/);
  });
});
