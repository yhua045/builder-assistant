/**
 * Pure utility for deriving a due-status label and style from a due date string.
 * Extracted here so it can be unit-tested independently.
 */
export type DueStyle = 'overdue' | 'due-soon' | 'on-time';

export interface DueStatus {
  text: string;
  style: DueStyle;
}

export function getDueStatus(dueDate: string): DueStatus {
  const now = Date.now();
  const due = new Date(dueDate).getTime();
  const diffDays = Math.ceil((due - now) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const days = Math.abs(diffDays);
    return { text: `OVERDUE ${days} DAY${days !== 1 ? 'S' : ''}`, style: 'overdue' };
  }
  if (diffDays <= 3) {
    return { text: `Due in ${diffDays} day${diffDays !== 1 ? 's' : ''}`, style: 'due-soon' };
  }
  return { text: `Due in ${diffDays} days`, style: 'on-time' };
}
