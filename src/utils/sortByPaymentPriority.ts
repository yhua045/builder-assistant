import { Payment } from '../domain/entities/Payment';

/**
 * Sorts payments by urgency: ascending due date (overdue items first as they
 * have past dates), with no-due-date items trailing at the end.
 */
export function sortByPaymentPriority(payments: Payment[]): Payment[] {
  return [...payments].sort((a, b) => {
    const aMs = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const bMs = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    return aMs - bMs;
  });
}

/**
 * Sorts settled payments by paid date descending (newest first).
 * Items without a date sort to the end (treated as 0 epoch).
 */
export function sortByPaidDateDesc(payments: Payment[]): Payment[] {
  return [...payments].sort((a, b) => {
    const aMs = a.date ? new Date(a.date).getTime() : 0;
    const bMs = b.date ? new Date(b.date).getTime() : 0;
    return bMs - aMs;
  });
}
