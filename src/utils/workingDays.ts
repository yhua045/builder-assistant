/**
 * Returns a new Date that is `days` calendar days after `start`.
 * Saturdays and Sundays are skipped so that the result always falls on a weekday.
 */
export function addWorkingDays(start: Date, days: number): Date {
  if (days <= 0) return new Date(start);
  const result = new Date(start);
  let remaining = days;
  while (remaining > 0) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) {
      remaining--;
    }
  }
  return result;
}
