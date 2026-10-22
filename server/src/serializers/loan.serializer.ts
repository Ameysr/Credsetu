import type { Loan, User } from '@prisma/client';
import { diffInDays, startOfToday } from '../utils/dates';
import { toMajor } from '../utils/money';

/** The shape the app consumes. Minor units stay authoritative; major is a convenience. */
export interface LoanDto {
  id: string;
  friendName: string;
  amountMinor: number;
  amount: number;
  currency: string;
  dueDate: string;
  repaidAt: string | null;
  isRepaid: boolean;
  isOverdue: boolean;
  daysOverdue: number;
  receiptUrl: string | null;
  note: string | null;
  createdAt: string;
}

/**
 * Overdue is derived, never stored: an entry is overdue when it has not been
 * repaid and its due date has passed. A stored flag would go stale the moment
 * the clock moved past midnight.
 */
export function isLoanOverdue(loan: Pick<Loan, 'repaidAt' | 'dueDate'>, now = new Date()): boolean {
  return loan.repaidAt === null && loan.dueDate.getTime() < startOfToday(now).getTime();
}

/** Whole days past due, counted in calendar days from the due date. */
export function daysOverdue(loan: Pick<Loan, 'repaidAt' | 'dueDate'>, now = new Date()): number {
  if (!isLoanOverdue(loan, now)) return 0;
  return diffInDays(loan.dueDate, now);
}

export function toLoanDto(loan: Loan, now = new Date()): LoanDto {
  return {
    id: loan.id,
    friendName: loan.friendName,
    amountMinor: loan.amountMinor,
    amount: toMajor(loan.amountMinor),
    currency: loan.currency,
    dueDate: loan.dueDate.toISOString(),
    repaidAt: loan.repaidAt?.toISOString() ?? null,
    isRepaid: loan.repaidAt !== null,
    isOverdue: isLoanOverdue(loan, now),
    daysOverdue: daysOverdue(loan, now),
    receiptUrl: loan.receiptUrl,
    note: loan.note,
    createdAt: loan.createdAt.toISOString(),
  };
}

export interface UserDto {
  id: string;
  phone: string;
  name: string | null;
  createdAt: string;
}

export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    phone: user.phone,
    name: user.name,
    createdAt: user.createdAt.toISOString(),
  };
}
