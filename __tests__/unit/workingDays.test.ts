import { addWorkingDays } from '../../src/utils/workingDays';

describe('addWorkingDays', () => {
  it('returns the same date for 0 days', () => {
    const start = new Date('2025-01-06'); // Monday
    const result = addWorkingDays(start, 0);
    expect(result.toISOString().slice(0, 10)).toBe('2025-01-06');
  });

  it('adds 1 working day on Monday → Tuesday', () => {
    const monday = new Date('2025-01-06');
    expect(addWorkingDays(monday, 1).toISOString().slice(0, 10)).toBe('2025-01-07');
  });

  it('skips Saturday and Sunday: Friday + 1 = Monday', () => {
    const friday = new Date('2025-01-10');
    expect(addWorkingDays(friday, 1).toISOString().slice(0, 10)).toBe('2025-01-13');
  });

  it('skips a full weekend: Friday + 3 = Wednesday', () => {
    const friday = new Date('2025-01-10');
    expect(addWorkingDays(friday, 3).toISOString().slice(0, 10)).toBe('2025-01-15');
  });

  it('adds 5 working days spanning one weekend', () => {
    const monday = new Date('2025-01-06');
    // Mon + 5 working days = Mon→Tue→Wed→Thu→Fri→Mon(next week)
    expect(addWorkingDays(monday, 5).toISOString().slice(0, 10)).toBe('2025-01-13');
  });

  it('does not mutate the input date', () => {
    const start = new Date('2025-01-06');
    const original = start.getTime();
    addWorkingDays(start, 3);
    expect(start.getTime()).toBe(original);
  });
});
