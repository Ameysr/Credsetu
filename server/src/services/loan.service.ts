import type { Loan } from '@prisma/client';
import { prisma } from '../db';
import { notFound } from '../errors';
import type { CreateLoanInput, LoanStatus } from '../schemas/loan.schema';
import { toLoanDto, type LoanDto } from '../serializers/loan.serializer';
import { toMinor } from '../utils/money';
import { startOfToday } from '../utils/dates';

export async function createLoan(userId: string, input: CreateLoanInput): Promise<LoanDto> {
  const loan = await prisma.loan.create({
    data: {
      userId,
      friendName: input.friendName,
      amountMinor: toMinor(input.amount),
      currency: input.currency ?? 'INR',
      dueDate: input.dueDate,
      note: input.note ?? null,
    },
  });

  return toLoanDto(loan);
}

/**
 * Overdue is defined as "unrepaid and the due date is before today", so an
 * entry due today is still on time.
 */
function whereForStatus(userId: string, status: LoanStatus, now: Date) {
  const overdueFilter = { repaidAt: null, dueDate: { lt: startOfToday(now) } };

  switch (status) {
    case 'outstanding':
      return { userId, repaidAt: null };
    case 'repaid':
      return { userId, repaidAt: { not: null } };
    case 'overdue':
      return { userId, ...overdueFilter };
    case 'all':
    default:
      return { userId };
  }
}

export async function listLoans(
  userId: string,
  status: LoanStatus = 'all',
  now = new Date(),
): Promise<LoanDto[]> {
  const loans = await prisma.loan.findMany({
    where: whereForStatus(userId, status, now),
    // Unrepaid entries are what need attention, and the soonest due date is the
    // most urgent. Repaid entries are just a history, so newest first.
    orderBy: status === 'repaid' ? [{ repaidAt: 'desc' }] : [{ dueDate: 'asc' }, { createdAt: 'desc' }],
  });

  return loans.map((loan) => toLoanDto(loan, now));
}

/**
 * Loads a loan only if it belongs to the caller. Another user's loan id is
 * indistinguishable from a nonexistent one (404, not 403) so the API does not
 * leak which ids exist.
 */
export async function getOwnedLoan(id: string, userId: string): Promise<Loan> {
  const loan = await prisma.loan.findFirst({ where: { id, userId } });
  if (!loan) throw notFound('Loan not found');
  return loan;
}

export async function markLoanRepaid(id: string, userId: string): Promise<LoanDto> {
  const loan = await getOwnedLoan(id, userId);

  // Idempotent: replaying the request keeps the original repayment time.
  const repaid = loan.repaidAt
    ? loan
    : await prisma.loan.update({ where: { id: loan.id }, data: { repaidAt: new Date() } });

  return toLoanDto(repaid);
}

export async function attachReceipt(
  id: string,
  userId: string,
  receiptUrl: string,
): Promise<LoanDto> {
  const loan = await getOwnedLoan(id, userId);

  const updated = await prisma.loan.update({
    where: { id: loan.id },
    data: { receiptUrl },
  });

  return toLoanDto(updated);
}

export async function deleteLoan(id: string, userId: string): Promise<void> {
  await getOwnedLoan(id, userId);
  await prisma.loan.delete({ where: { id } });
}
