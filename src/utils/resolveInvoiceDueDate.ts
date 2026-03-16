import { Invoice } from '../domain/entities/Invoice';
import { addWorkingDays } from './workingDays';

/**
 * Resolves the effective due date for a payment obligation derived from an invoice.
 *
 * Priority order:
 *   1. `inv.dateDue` — explicit due date stored on the invoice
 *   2. `inv.dueDate` — legacy alias for dateDue
 *   3. `taskStartDate` + `dueDatePeriodDays` working days
 *   4. `inv.dateIssued` / `inv.issueDate` + `dueDatePeriodDays` working days
 *   5. Today + `dueDatePeriodDays` working days (last-resort fallback)
 *
 * @param invoice          The invoice record
 * @param taskStartDate    Optional ISO date string of the linked task's start date
 * @param dueDatePeriodDays  Working days to add when no explicit date is available (default 5)
 * @returns ISO date string (YYYY-MM-DD)
 */
export function resolveInvoiceDueDate(
  invoice: Pick<Invoice, 'dateDue' | 'dueDate' | 'dateIssued' | 'issueDate' | 'metadata'>,
  taskStartDate?: string | null,
  dueDatePeriodDays: number = 5,
): string {
  // 1 & 2: explicit due date on invoice
  const explicit = invoice.dateDue ?? invoice.dueDate;
  if (explicit) return explicit;

  // 3: task start date as anchor
  if (taskStartDate) {
    const anchor = new Date(taskStartDate);
    if (!isNaN(anchor.getTime())) {
      return addWorkingDays(anchor, dueDatePeriodDays).toISOString().slice(0, 10);
    }
  }

  // 4: invoice issue date as anchor
  const issued = invoice.dateIssued ?? invoice.issueDate;
  if (issued) {
    const anchor = new Date(issued);
    if (!isNaN(anchor.getTime())) {
      return addWorkingDays(anchor, dueDatePeriodDays).toISOString().slice(0, 10);
    }
  }

  // 5: fallback to today
  return addWorkingDays(new Date(), dueDatePeriodDays).toISOString().slice(0, 10);
}
