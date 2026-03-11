export function formatDate(date?: string | Date | null): string {
  if (!date) return 'TBD';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return 'TBD';
  return d.toISOString().slice(0, 10);
}

export default formatDate;
