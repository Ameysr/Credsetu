/** "12 Mar 2026" — short, unambiguous, locale-aware. */
export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** yyyy-mm-dd in local time, for the date input's value. */
export function toDateInputValue(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Status label for an entry, relative to today. Deliberately says nothing about
 * the absolute date — callers pair it with formatDate().
 */
export function describeDueDate(loan: { isRepaid: boolean; daysOverdue: number; dueDate: string }): string {
  if (loan.isRepaid) return 'Settled';

  if (loan.daysOverdue > 0) {
    return loan.daysOverdue === 1 ? '1 day overdue' : `${loan.daysOverdue} days overdue`;
  }

  const due = new Date(loan.dueDate);
  if (Number.isNaN(due.getTime())) return '—';

  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfDue = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const daysUntil = Math.round((startOfDue.getTime() - startOfToday.getTime()) / 86_400_000);

  if (daysUntil === 0) return 'Due today';
  if (daysUntil === 1) return 'Due tomorrow';
  return `${daysUntil} days left`;
}

/** Default due date for a new entry: a fortnight out. */
export function defaultDueDate(): Date {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  date.setHours(12, 0, 0, 0);
  return date;
}
