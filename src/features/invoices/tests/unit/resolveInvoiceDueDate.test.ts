import { resolveInvoiceDueDate } from '../../utils/resolveInvoiceDueDate';

describe('resolveInvoiceDueDate', () => {
  const baseInvoice = {
    dateDue: undefined as string | undefined,
    dueDate: undefined as string | undefined,
    dateIssued: undefined as string | undefined,
    issueDate: undefined as string | undefined,
    metadata: undefined as Record<string, any> | undefined,
  };

  it('returns dateDue when present', () => {
    const inv = { ...baseInvoice, dateDue: '2025-06-15' };
    expect(resolveInvoiceDueDate(inv)).toBe('2025-06-15');
  });

  it('falls back to dueDate when dateDue is absent', () => {
    const inv = { ...baseInvoice, dueDate: '2025-06-20' };
    expect(resolveInvoiceDueDate(inv)).toBe('2025-06-20');
  });

  it('uses taskStartDate + working days when no explicit date', () => {
    const inv = { ...baseInvoice };
    // Monday 2025-01-06 + 1 working day = Tuesday 2025-01-07
    const result = resolveInvoiceDueDate(inv, '2025-01-06', 1);
    expect(result).toBe('2025-01-07');
  });

  it('uses dateIssued + working days when taskStartDate is absent', () => {
    const inv = { ...baseInvoice, dateIssued: '2025-01-06' };
    // Monday + 1 working day = Tuesday
    expect(resolveInvoiceDueDate(inv, null, 1)).toBe('2025-01-07');
  });

  it('uses issueDate as fallback for dateIssued', () => {
    const inv = { ...baseInvoice, issueDate: '2025-01-06' };
    expect(resolveInvoiceDueDate(inv, null, 1)).toBe('2025-01-07');
  });

  it('prefers dateDue over taskStartDate', () => {
    const inv = { ...baseInvoice, dateDue: '2025-06-10' };
    const result = resolveInvoiceDueDate(inv, '2025-01-06', 5);
    expect(result).toBe('2025-06-10');
  });

  it('defaults to dueDatePeriodDays = 5 when not provided', () => {
    // With a known Monday anchor, 5 working days = next Monday
    const inv = { ...baseInvoice, dateIssued: '2025-01-06' }; // Monday
    const result = resolveInvoiceDueDate(inv, null);
    expect(result).toBe('2025-01-13');
  });
});
