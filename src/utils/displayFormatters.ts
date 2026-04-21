export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(iso?: string | null | Date): string {
  if (!iso) return '—';
  try {
    const date = typeof iso === 'string' ? new Date(iso) : iso;
    if (isNaN(date.getTime())) return String(iso);
    
    return date.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return String(iso);
  }
}
