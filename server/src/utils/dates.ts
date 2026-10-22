const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Midnight local time for the given day. */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Midnight today, the reference point for "is this overdue?". */
export function startOfToday(now = new Date()): Date {
  return startOfDay(now);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * MS_PER_DAY);
}

/** Whole days between two instants, floored, using calendar days. */
export function diffInDays(from: Date, to: Date): number {
  return Math.floor((startOfDay(to).getTime() - startOfDay(from).getTime()) / MS_PER_DAY);
}
