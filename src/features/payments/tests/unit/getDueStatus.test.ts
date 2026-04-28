import { getDueStatus } from '../../../../utils/getDueStatus';

const MS_DAY = 1000 * 60 * 60 * 24;

describe('getDueStatus', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-03-12T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns "overdue" style for a date in the past', () => {
    const dueDate = new Date(Date.now() - 3 * MS_DAY).toISOString();
    const result = getDueStatus(dueDate);
    expect(result.style).toBe('overdue');
    expect(result.text).toMatch(/OVERDUE 3 DAYS/i);
  });

  it('uses singular "DAY" for exactly 1 day overdue', () => {
    const dueDate = new Date(Date.now() - MS_DAY).toISOString();
    const result = getDueStatus(dueDate);
    expect(result.style).toBe('overdue');
    expect(result.text).toBe('OVERDUE 1 DAY');
  });

  it('returns "due-soon" style for a date within 3 days', () => {
    const dueDate = new Date(Date.now() + 2 * MS_DAY).toISOString();
    const result = getDueStatus(dueDate);
    expect(result.style).toBe('due-soon');
    expect(result.text).toMatch(/Due in 2 days/);
  });

  it('returns "due-soon" for due today (0 days)', () => {
    const dueDate = new Date(Date.now()).toISOString();
    const result = getDueStatus(dueDate);
    expect(result.style).toBe('due-soon');
    expect(result.text).toMatch(/Due in 0 days/);
  });

  it('returns "on-time" style for a date more than 3 days away', () => {
    const dueDate = new Date(Date.now() + 10 * MS_DAY).toISOString();
    const result = getDueStatus(dueDate);
    expect(result.style).toBe('on-time');
    expect(result.text).toMatch(/Due in 10 days/);
  });

  it('uses singular "day" for exactly 1 day away', () => {
    const dueDate = new Date(Date.now() + MS_DAY).toISOString();
    const result = getDueStatus(dueDate);
    expect(result.style).toBe('due-soon');
    expect(result.text).toBe('Due in 1 day');
  });
});
